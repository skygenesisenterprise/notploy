import http from "node:http";
import type { AddressInfo } from "node:net";

/**
 * A tiny, in-process stand-in for the Notploy REST API.
 *
 * It speaks the same protocol as the real thing — Next.js routes under `/api`,
 * procedures addressed as `/<router>.<procedure>`, authentication through the
 * `x-api-key` header — so tests exercise the real SDK client and the real
 * request/error paths without needing a running Notploy instance.
 */
export interface MockServerOptions {
	/** When set, every request must present this key in `x-api-key`. */
	token?: string;
	/** `"<METHOD> <endpoint>"` → JSON payload or a function returning one. */
	data?: Record<string, unknown>;
	/** `"<METHOD> <endpoint>"` → HTTP status, to force failures. */
	status?: Record<string, number>;
	/** Simulates a network failure by destroying the socket. */
	failWith?: (path: string) => boolean;
}

export interface RecordedRequest {
	method: string;
	path: string;
	apiKey: string | undefined;
	query: URLSearchParams;
	body: unknown;
}

export interface MockServer {
	/** Origin, e.g. `http://127.0.0.1:54321` (no `/api`). */
	url: string;
	requests: RecordedRequest[];
	close(): Promise<void>;
}

export async function startNotployMockServer(
	options: MockServerOptions = {},
): Promise<MockServer> {
	const requests: RecordedRequest[] = [];

	const server = http.createServer((request, response) => {
		const url = new URL(request.url ?? "/", "http://127.0.0.1");
		const endpoint = url.pathname.replace(/^\/api\/?/, "");
		const apiKey = request.headers["x-api-key"] as string | undefined;

		const chunks: Buffer[] = [];
		request.on("data", (chunk: Buffer) => chunks.push(chunk));
		request.on("end", () => {
			const raw = Buffer.concat(chunks).toString("utf8");
			let body: unknown;
			try {
				body = raw ? JSON.parse(raw) : undefined;
			} catch {
				body = raw;
			}

			requests.push({
				method: request.method ?? "GET",
				path: endpoint,
				apiKey,
				query: url.searchParams,
				body,
			});

			if (options.failWith?.(endpoint)) {
				response.destroy();
				return;
			}

			const send = (status: number, payload: unknown): void => {
				const text = JSON.stringify(payload ?? null);
				response.writeHead(status, {
					"Content-Type": "application/json",
					"Content-Length": Buffer.byteLength(text),
				});
				response.end(text);
			};

			if (options.token && apiKey !== options.token) {
				send(401, { message: "Unauthorized", code: "UNAUTHORIZED" });
				return;
			}

			const key = `${request.method} ${endpoint}`;
			const forcedStatus = options.status?.[key];
			if (forcedStatus && forcedStatus >= 400) {
				send(forcedStatus, { message: "forced failure", code: "BAD_REQUEST" });
				return;
			}

			if (!(key in (options.data ?? {}))) {
				send(404, { message: `no handler for ${key}`, code: "NOT_FOUND" });
				return;
			}

			const value = options.data?.[key];
			send(
				forcedStatus ?? 200,
				typeof value === "function" ? (value as () => unknown)() : value,
			);
		});
	});

	await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
	const address = server.address() as AddressInfo;
	let closed = false;

	return {
		url: `http://127.0.0.1:${address.port}`,
		requests,
		async close(): Promise<void> {
			// Idempotent: a test may close the server to simulate an outage and the
			// teardown hook closes it again.
			if (closed || !server.listening) {
				closed = true;
				return;
			}
			closed = true;
			await new Promise<void>((resolve) => server.close(() => resolve()));
		},
	};
}
