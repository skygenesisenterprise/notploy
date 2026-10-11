import { randomUUID } from "node:crypto";
import { DelayedError, type Job, type JobType, Queue, Worker } from "bullmq";
import type { Redis } from "ioredis";
import {
	getGroup,
	getPartition,
	type InMemoryJob,
	LOCAL_PARTITION,
} from "./in-memory-queue";
import type { DeploymentJob } from "./queue-types";

/**
 * Redis-backed deployment queue for self-hosted instances.
 *
 * BullMQ has no notion of per-service grouping, so this backend keeps one
 * queue per partition (server) and enforces grouping itself:
 *
 * - a `Worker` processes up to `buildsConcurrency` jobs in parallel, so
 *   different apps deploy at the same time;
 * - before running a job the worker takes a Redis lock keyed by the job's
 *   group (`application:<id>` / `compose:<id>`). If the lock is held, the job
 *   is moved to the delayed set and retried shortly after, freeing the worker
 *   slot for other groups.
 *
 * The queue is shared across processes and survives restarts. Ordering inside
 * a group is best-effort rather than strict FIFO, and a partition's
 * concurrency is fixed when its worker is created.
 */

const PREFIX = "notploy";
const LOCK_TTL_MS = 30 * 60 * 1000;
const LOCK_HEARTBEAT_MS = LOCK_TTL_MS / 3;
const RETRY_DELAY_MS = 1000;

const RELEASE_LOCK_SCRIPT = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
end
return 0`;

const sanitize = (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, "_");
const queueName = (partition: string) => `deployments-${sanitize(partition)}`;
const lockKey = (group: string) => `${PREFIX}:lock:group:${sanitize(group)}`;

type Processor = (job: InMemoryJob) => Promise<void>;

export interface BullMqQueueOptions {
	processor: Processor;
	resolveConcurrency: (partition: string) => Promise<number> | number;
	/** Redis connection; must have `maxRetriesPerRequest: null`. */
	redis: Redis;
	/** Extra partitions that may already hold jobs (e.g. registered servers). */
	listPartitions?: () => Promise<string[]> | string[];
}

interface PartitionEntry {
	queue: Queue;
	worker: Worker;
}

const toInMemoryJob = (job: Job<DeploymentJob>): InMemoryJob => ({
	id: String(job.id),
	name: job.name,
	data: job.data,
	timestamp: job.timestamp,
	processedOn: job.processedOn,
	finishedOn: job.finishedOn,
	failedReason: job.failedReason,
	getState: () => job.getState() as Promise<"waiting" | "active">,
	remove: () => job.remove(),
});

export class BullMqQueue {
	private readonly partitions = new Map<string, PartitionEntry>();
	private readonly pending = new Map<string, Promise<PartitionEntry>>();
	private readonly processor: Processor;
	private readonly resolveConcurrency: BullMqQueueOptions["resolveConcurrency"];
	private readonly redis: Redis;
	private readonly listPartitions: BullMqQueueOptions["listPartitions"];

	constructor(options: BullMqQueueOptions) {
		this.processor = options.processor;
		this.resolveConcurrency = options.resolveConcurrency;
		this.redis = options.redis;
		this.listPartitions = options.listPartitions;
	}

	async add(name: string, data: DeploymentJob): Promise<{ id: string }> {
		const entry = await this.ensurePartition(getPartition(data));
		const job = await entry.queue.add(name, data);
		return { id: String(job.id) };
	}

	async getJobs(states?: JobType[]): Promise<InMemoryJob[]> {
		const jobs: InMemoryJob[] = [];
		for (const entry of this.partitions.values()) {
			const partitionJobs = await entry.queue.getJobs(
				states ?? ["waiting", "active"],
			);
			jobs.push(...partitionJobs.map(toInMemoryJob));
		}
		return jobs;
	}

	async removeWaiting(
		predicate: (data: DeploymentJob) => boolean,
	): Promise<number> {
		let removed = 0;
		for (const entry of this.partitions.values()) {
			const jobs = await entry.queue.getJobs(["waiting", "delayed"]);
			for (const job of jobs) {
				if (predicate(job.data as DeploymentJob)) {
					await job.remove();
					removed += 1;
				}
			}
		}
		return removed;
	}

	async clearWaiting(): Promise<number> {
		let removed = 0;
		for (const entry of this.partitions.values()) {
			removed += (await entry.queue.getJobs(["waiting"])).length;
			removed += (await entry.queue.getJobs(["delayed"])).length;
			await entry.queue.drain();
		}
		return removed;
	}

	async run(): Promise<void> {
		const partitions = new Set<string>([LOCAL_PARTITION]);
		try {
			if (this.listPartitions) {
				for (const partition of await this.listPartitions()) {
					partitions.add(partition);
				}
			}
		} catch (error) {
			console.error("[queue] failed to enumerate partitions", error);
		}
		await Promise.all(
			[...partitions].map((partition) => this.ensurePartition(partition)),
		);
	}

	on() {
		// No-op: kept for API compatibility with the in-memory queue.
	}

	async close(): Promise<void> {
		const entries = [...this.partitions.values()];
		this.partitions.clear();
		this.pending.clear();
		await Promise.all(entries.map((entry) => entry.worker.close()));
		await Promise.all(entries.map((entry) => entry.queue.close()));
	}

	private ensurePartition(partition: string): Promise<PartitionEntry> {
		const existing = this.partitions.get(partition);
		if (existing) {
			return Promise.resolve(existing);
		}
		const inFlight = this.pending.get(partition);
		if (inFlight) {
			return inFlight;
		}
		const created = this.createPartition(partition).finally(() => {
			this.pending.delete(partition);
		});
		this.pending.set(partition, created);
		return created;
	}

	private async createPartition(partition: string): Promise<PartitionEntry> {
		const name = queueName(partition);
		const concurrency = Math.max(1, await this.resolveConcurrency(partition));

		const queue = new Queue<DeploymentJob>(name, {
			connection: this.redis,
			prefix: PREFIX,
		});
		const worker = new Worker<DeploymentJob>(
			name,
			(job, token) => this.handle(job, token),
			{ connection: this.redis, prefix: PREFIX, concurrency },
		);

		worker.on("error", (error) => {
			console.error(`[queue] worker error (${partition})`, error);
		});
		worker.on("failed", (job, error) => {
			console.error(`[queue] job ${job?.id} failed (${partition})`, error);
		});

		const entry: PartitionEntry = { queue, worker };
		this.partitions.set(partition, entry);
		return entry;
	}

	private async handle(job: Job<DeploymentJob>, token?: string) {
		const group = getGroup(job.data);
		const key = lockKey(group);
		const owner = randomUUID();

		const acquired = await this.redis.set(key, owner, "PX", LOCK_TTL_MS, "NX");
		if (acquired !== "OK") {
			if (token) {
				await job.moveToDelayed(Date.now() + RETRY_DELAY_MS, token);
			}
			throw new DelayedError();
		}

		const heartbeat = setInterval(() => {
			this.redis.pexpire(key, LOCK_TTL_MS).catch(() => {});
		}, LOCK_HEARTBEAT_MS);

		try {
			await this.processor(toInMemoryJob(job));
		} finally {
			clearInterval(heartbeat);
			await this.redis
				.eval(RELEASE_LOCK_SCRIPT, 1, key, owner)
				.catch((error) => {
					console.error("[queue] failed to release group lock", error);
				});
		}
	}
}
