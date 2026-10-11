/**
 * A tiny, in-process stand-in for the Notploy REST API.
 *
 * It speaks the same protocol as the real thing — procedures under `/api`
 * addressed as `/<router>.<procedure>`, authentication through the `x-api-key`
 * header — so the tests exercise the real `@notploy/sdk` client and the real
 * request/error paths without a running Notploy instance.
 */

import http from "node:http";
import type { AddressInfo } from "node:net";

export interface MockServerOptions {
	/** When set, every request must present this key in `x-api-key`. */
	token?: string;
	/** `"<METHOD> <endpoint>"` → JSON payload, or a function returning one. */
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
				// The real API answers with the tRPC code that matches the status, and
				// the client maps a failure by that code when no numeric status comes
				// back. Sending BAD_REQUEST for a 403 would make the mock lie.
				send(forcedStatus, {
					message: "forced failure",
					code: tRpcCodeForStatus(forcedStatus),
				});
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

/** The tRPC error code the real API pairs with an HTTP status. */
function tRpcCodeForStatus(status: number): string {
	switch (status) {
		case 401:
			return "UNAUTHORIZED";
		case 403:
			return "FORBIDDEN";
		case 404:
			return "NOT_FOUND";
		case 422:
			return "UNPROCESSABLE_CONTENT";
		case 429:
			return "TOO_MANY_REQUESTS";
		case 500:
			return "INTERNAL_SERVER_ERROR";
		case 503:
			return "SERVICE_UNAVAILABLE";
		default:
			return "BAD_REQUEST";
	}
}

/** An OpenAPI document exposing the given routers, as an instance returns it. */
export function openApiDocument(routers: string[]): {
	info: { title: string; version: string };
	paths: Record<string, unknown>;
} {
	return {
		info: { title: "Notploy", version: "1.0.0" },
		paths: Object.fromEntries(routers.map((router) => [`/${router}.all`, {}])),
	};
}
