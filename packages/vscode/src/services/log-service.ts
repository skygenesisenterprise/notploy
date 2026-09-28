import * as vscode from "vscode";
import { CancellationError, sleep } from "../core/async";
import { isNotployError } from "../core/errors";
import type { Logger } from "../core/logger";

export interface LogTarget {
	/** Unique key, e.g. `application:<id>`. */
	key: string;
	/** Channel name, e.g. `Notploy: website (logs)`. */
	label: string;
	/** Fetches the current log text. */
	fetch: () => Promise<string>;
}

interface LogSession {
	target: LogTarget;
	channel: vscode.OutputChannel;
	/** Bounded buffer of the lines kept for Copy. */
	buffer: string[];
	/** Last full payload, used to compute the delta between polls. */
	lastText: string;
	following: boolean;
	abort?: AbortController;
	consecutiveFailures: number;
}

/** Beyond this, the "previous payload" is truncated to bound memory. */
const LAST_TEXT_LIMIT = 512 * 1024;

/**
 * Logs in VS Code Output Channels.
 *
 * The Notploy API has no streaming endpoint — no WebSocket, no SSE — so
 * following a deployment means polling. That is the mechanism the API actually
 * provides, and this service uses it rather than inventing a parallel one.
 *
 * Memory is bounded on purpose: only the last `notploy.logMaxLines` lines are
 * kept, and the previous payload used for diffing is truncated so a long build
 * cannot grow the buffer without limit.
 */
export class LogService implements vscode.Disposable {
	private readonly sessions = new Map<string, LogSession>();
	private readonly changeEmitter = new vscode.EventEmitter<string>();
	/** Fired with the session key whenever following starts or stops. */
	readonly onDidChangeFollowing: vscode.Event<string> =
		this.changeEmitter.event;

	constructor(private readonly logger: Logger) {}

	private maxLines(): number {
		const value = vscode.workspace
			.getConfiguration("notploy")
			.get<number>("logMaxLines", 5_000);
		return Number.isFinite(value) && value >= 100 ? Math.floor(value) : 5_000;
	}

	private followIntervalMs(): number {
		const value = vscode.workspace
			.getConfiguration("notploy")
			.get<number>("logFollowInterval", 3);
		const seconds = Number.isFinite(value) && value >= 1 ? value : 3;
		return seconds * 1_000;
	}

	/** Opens (or focuses) the channel for a target and writes fresh content. */
	async open(target: LogTarget, reveal = true): Promise<void> {
		const session = this.sessionFor(target);
		if (reveal) session.channel.show(true);
		await this.refresh(session);
	}

	/** Opens the channel and polls until stopped. */
	async follow(target: LogTarget): Promise<void> {
		const session = this.sessionFor(target);
		session.channel.show(true);
		await this.refresh(session);
		if (session.following) return;
		session.following = true;
		session.consecutiveFailures = 0;
		session.abort = new AbortController();
		this.changeEmitter.fire(session.target.key);
		this.logger.info(`Following logs: ${target.label}`);
		void this.loop(session);
	}

	async unfollow(key: string): Promise<void> {
		const session = this.sessions.get(key);
		if (!session) return;
		this.stopFollowing(session, "Stopped following logs.");
	}

	unfollowAll(): void {
		for (const session of this.sessions.values()) {
			if (session.following) this.stopFollowing(session);
		}
	}

	isFollowing(key: string): boolean {
		return this.sessions.get(key)?.following ?? false;
	}

	/** Clears the channel for a target. VS Code has no clear API, so the channel is recreated. */
	async clear(key: string): Promise<void> {
		const session = this.sessions.get(key);
		if (!session) return;
		const wasFollowing = session.following;
		const abort = session.abort;
		abort?.abort();
		session.channel.dispose();
		session.channel = vscode.window.createOutputChannel(session.target.label);
		session.buffer = [];
		session.lastText = "";
		session.following = false;
		session.abort = undefined;
		session.channel.show(true);
		await this.refresh(session);
		if (wasFollowing) {
			await this.follow(session.target);
		}
	}

	async copy(key: string): Promise<void> {
		const session = this.sessions.get(key);
		if (!session || session.buffer.length === 0) return;
		await vscode.env.clipboard.writeText(session.buffer.join("\n"));
	}

	hasSession(key: string): boolean {
		return this.sessions.has(key);
	}

	/** Force a one-shot refresh, without changing the follow state. */
	async refreshKey(key: string): Promise<void> {
		const session = this.sessions.get(key);
		if (session) await this.refresh(session);
	}

	private sessionFor(target: LogTarget): LogSession {
		const existing = this.sessions.get(target.key);
		if (existing) {
			// Keep the latest fetcher: the tree re-creates closures on refresh.
			existing.target = target;
			return existing;
		}
		const session: LogSession = {
			target,
			channel: vscode.window.createOutputChannel(target.label),
			buffer: [],
			lastText: "",
			following: false,
			consecutiveFailures: 0,
		};
		this.sessions.set(target.key, session);
		return session;
	}

	private stopFollowing(session: LogSession, note?: string): void {
		session.following = false;
		session.abort?.abort();
		session.abort = undefined;
		if (note) session.channel.appendLine(`— ${note} —`);
		this.changeEmitter.fire(session.target.key);
	}

	private async loop(session: LogSession): Promise<void> {
		const signal = session.abort?.signal;
		while (session.following && signal && !signal.aborted) {
			try {
				await sleep(this.followIntervalMs(), signal);
				if (!session.following) break;
				await this.refresh(session);
				session.consecutiveFailures = 0;
			} catch (error) {
				if (error instanceof CancellationError) break;
				if (!session.following) break;
				session.consecutiveFailures += 1;
				if (session.consecutiveFailures >= 5) {
					session.channel.appendLine(
						"⚠ Stopped following logs after repeated failures. See the Notploy output channel for details.",
					);
					this.stopFollowing(session);
					return;
				}
				this.logger.warn(
					`Log follow retry ${session.consecutiveFailures} for ${session.target.label}`,
				);
			}
		}
	}

	private async refresh(session: LogSession): Promise<void> {
		let text: string;
		try {
			text = await session.target.fetch();
		} catch (error) {
			if (isNotployError(error)) {
				session.channel.appendLine(`⚠ ${error.userMessage}`);
				if (error.code === "unauthorized" || error.code === "unsupported") {
					this.stopFollowing(session);
					return;
				}
			} else {
				session.channel.appendLine("⚠ Unable to read logs.");
				this.logger.error("Reading logs failed", error);
			}
			throw error;
		}

		this.append(session, text);
		session.channel.appendLine(
			`— updated ${new Date().toLocaleTimeString()} —`,
		);
	}

	private append(session: LogSession, text: string): void {
		const normalized = text.replace(/\r\n/g, "\n");
		if (!normalized) return;

		const lineLimit = this.maxLines();
		// `readLogs` always returns the last `tail` lines, so when the new payload
		// extends the previous one we only append what is new. Otherwise the
		// container restarted or the window rotated and we print the whole thing.
		const delta =
			session.lastText && normalized.startsWith(session.lastText)
				? normalized.slice(session.lastText.length)
				: normalized;

		const lines = delta.split("\n").filter((line) => line.length > 0);
		for (const line of lines) {
			session.channel.appendLine(line);
			session.buffer.push(line);
		}
		if (session.buffer.length > lineLimit) {
			session.buffer = session.buffer.slice(session.buffer.length - lineLimit);
		}

		session.lastText =
			normalized.length > LAST_TEXT_LIMIT
				? normalized.slice(normalized.length - LAST_TEXT_LIMIT)
				: normalized;
	}

	dispose(): void {
		for (const session of this.sessions.values()) {
			session.abort?.abort();
			session.channel.dispose();
		}
		this.sessions.clear();
		this.changeEmitter.dispose();
	}
}
