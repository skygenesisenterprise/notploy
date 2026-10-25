import { getRedis, IS_CLOUD, isRedisEnabled } from "@notploy/server";
import { db } from "@notploy/server/db";
import {
	execAsync,
	execAsyncRemote,
} from "@notploy/server/utils/process/execAsync";
import { BullMqQueue } from "./bullmq-queue";
import { resolveBuildsConcurrency } from "./concurrency";
import { processDeploymentJob } from "./deployments-queue";
import { type InMemoryJob, InMemoryQueue } from "./in-memory-queue";
import type { DeploymentJob } from "./queue-types";

/**
 * Deployment queue.
 *
 * Self-hosted uses the in-memory, per-group FIFO queue by default, or a
 * Redis/BullMQ backend when `REDIS_URL` is configured (the Compose stack ships
 * a `redis` service). Cloud runs deployments directly in the background, so it
 * gets a no-op.
 */

interface DeploymentQueue {
	add: (
		name: string,
		data: DeploymentJob,
		opts?: Record<string, unknown>,
	) => Promise<{ id: string }>;
	getJobs: (states?: Array<"waiting" | "active">) => Promise<InMemoryJob[]>;
	close: () => Promise<void>;
	on: (...args: unknown[]) => void;
	run: () => Promise<void>;
	removeWaiting: (
		predicate: (data: DeploymentJob) => boolean,
	) => number | Promise<number>;
	clearWaiting: () => number | Promise<number>;
}

const createNoopQueue = (): DeploymentQueue => ({
	add: () => Promise.resolve({ id: "noop" }),
	getJobs: () => Promise.resolve([]),
	close: () => Promise.resolve(),
	on: () => {},
	run: () => Promise.resolve(),
	removeWaiting: () => 0,
	clearWaiting: () => 0,
});

const createInMemoryQueue = (): DeploymentQueue => {
	const queue = new InMemoryQueue({
		resolveConcurrency: resolveBuildsConcurrency,
	});
	queue.process(processDeploymentJob);

	return {
		add: (_name, data) => queue.add(data),
		getJobs: (states) => queue.getJobs(states),
		close: () => queue.close(),
		on: () => {},
		run: () => queue.run(),
		removeWaiting: (predicate) => queue.removeWaiting(predicate),
		clearWaiting: () => queue.clearWaiting(),
	};
};

/** Partitions that may still hold jobs when the worker boots (registered servers). */
const listServerPartitions = async (): Promise<string[]> => {
	try {
		const servers = await db.query.server.findMany({
			columns: { serverId: true },
		});
		return servers
			.map((row) => row.serverId)
			.filter((serverId): serverId is string => Boolean(serverId));
	} catch (error) {
		console.error("[queue] failed to list server partitions", error);
		return [];
	}
};

const createBullMqQueue = (): DeploymentQueue => {
	const redis = getRedis();
	if (!redis) {
		throw new Error("createBullMqQueue requires REDIS_URL to be set");
	}

	const queue = new BullMqQueue({
		processor: processDeploymentJob,
		resolveConcurrency: resolveBuildsConcurrency,
		redis,
		listPartitions: listServerPartitions,
	});

	return {
		add: (name, data) => queue.add(name, data),
		getJobs: (states) => queue.getJobs(states),
		close: () => queue.close(),
		on: () => {},
		run: () => queue.run(),
		removeWaiting: (predicate) => queue.removeWaiting(predicate),
		clearWaiting: () => queue.clearWaiting(),
	};
};

// Use a global singleton so the deployment queue is shared across every module
// instance. In dev (tsx/Next) the same file can be evaluated more than once
// (relative import in server.ts vs `@/` alias in the routers); without this the
// worker and the `add()` calls would land on different queue instances.
const globalForQueue = globalThis as unknown as {
	__notployDeploymentQueue?: DeploymentQueue;
};

// Managed Cloud production delegates deployments to an external service, so
// the queue is a no-op there. Everywhere else — including development runs
// with IS_CLOUD=true — a real local worker processes deployments. Without
// this, Deploy would acknowledge the queued job and never run anything.
const useNoopQueue = IS_CLOUD && process.env.NODE_ENV === "production";
if (!globalForQueue.__notployDeploymentQueue) {
	globalForQueue.__notployDeploymentQueue = !useNoopQueue
		? isRedisEnabled()
			? createBullMqQueue()
			: createInMemoryQueue()
		: createNoopQueue();
}

const myQueue: DeploymentQueue = globalForQueue.__notployDeploymentQueue;

/** Start processing jobs. Called once on server startup (self-hosted). */
export const startDeploymentWorker = () => myQueue.run();

export const getJobsByApplicationId = async (applicationId: string) => {
	const jobs = await myQueue.getJobs();
	return jobs.filter(
		(job) => (job.data as any)?.applicationId === applicationId,
	);
};

export const getJobsByComposeId = async (composeId: string) => {
	const jobs = await myQueue.getJobs();
	return jobs.filter((job) => (job.data as any)?.composeId === composeId);
};

if (!IS_CLOUD) {
	process.on("SIGTERM", () => {
		myQueue.close();
		process.exit(0);
	});
}

export const cleanQueuesByApplication = async (applicationId: string) => {
	const removed = await myQueue.removeWaiting(
		(data) => (data as any)?.applicationId === applicationId,
	);
	if (removed > 0) {
		console.log(
			`Removed ${removed} waiting job(s) for application ${applicationId}`,
		);
	}
};

export const cleanQueuesByCompose = async (composeId: string) => {
	const removed = await myQueue.removeWaiting(
		(data) => (data as any)?.composeId === composeId,
	);
	if (removed > 0) {
		console.log(`Removed ${removed} waiting job(s) for compose ${composeId}`);
	}
};

export const cleanAllDeploymentQueue = async () => {
	await myQueue.clearWaiting();
	return true;
};

export const killDockerBuild = async (
	type: "application" | "compose",
	serverId: string | null,
) => {
	try {
		if (type === "application") {
			const command = `pkill -2 -f "docker build"`;

			if (serverId) {
				await execAsyncRemote(serverId, command);
			} else {
				await execAsync(command);
			}
		} else if (type === "compose") {
			const command = `pkill -2 -f "docker compose"`;

			if (serverId) {
				await execAsyncRemote(serverId, command);
			} else {
				await execAsync(command);
			}
		}
	} catch (error) {
		console.error(error);
	}
};

export { myQueue };
