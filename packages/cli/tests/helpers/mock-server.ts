import * as http from "node:http";
import type { AddressInfo } from "node:net";

export interface RecordedRequest {
	method: string;
	endpoint: string;
	headers: http.IncomingHttpHeaders;
	body: unknown;
	query: unknown;
}

export interface MockServer {
	url: string;
	requests: RecordedRequest[];
	close: () => Promise<void>;
}

function readBody(request: http.IncomingMessage): Promise<string> {
	return new Promise((resolve, reject) => {
		let body = "";
		request.setEncoding("utf8");
		request.on("data", (chunk) => {
			body += chunk;
		});
		request.on("end", () => resolve(body));
		request.on("error", reject);
	});
}

/**
 * Starts an in-process Notploy API stub. Only `valid-key` authenticates.
 */
export async function startMockServer(
	options: { delayMs?: number } = {},
): Promise<MockServer> {
	const requests: RecordedRequest[] = [];

	const server = http.createServer(async (request, response) => {
		const url = new URL(request.url ?? "/", "http://127.0.0.1");
		const endpoint = url.pathname.split("/").pop() ?? "";
		const raw = await readBody(request);
		let body: unknown = null;
		if (raw) {
			try {
				body = JSON.parse(raw);
			} catch {
				body = raw;
			}
		}

		let query: unknown = null;
		const input = url.searchParams.get("input");
		if (input) {
			try {
				query = JSON.parse(input);
			} catch {
				query = input;
			}
		}

		requests.push({
			method: request.method ?? "",
			endpoint,
			headers: request.headers,
			body,
			query,
		});

		if (options.delayMs) {
			await new Promise((resolve) => setTimeout(resolve, options.delayMs));
		}

		response.setHeader("content-type", "application/json");

		const key = request.headers["x-api-key"];
		if (key !== "valid-key") {
			response.statusCode = 401;
			response.end(
				JSON.stringify({
					error: {
						json: {
							message: "UNAUTHORIZED",
							data: { code: "UNAUTHORIZED" },
						},
					},
				}),
			);
			return;
		}

		if (endpoint === "server.getServerMetrics") {
			response.statusCode = 500;
			response.end(
				JSON.stringify({
					error: {
						json: {
							message: "INTERNAL_SERVER_ERROR",
							data: { code: "INTERNAL_SERVER_ERROR" },
						},
					},
				}),
			);
			return;
		}

		if (endpoint === "trpc.error") {
			response.end(
				JSON.stringify({
					error: {
						json: {
							message: "TRPC_FAILURE",
							data: { code: "INTERNAL_SERVER_ERROR" },
						},
					},
				}),
			);
			return;
		}

		const json = (value: unknown) =>
			JSON.stringify({ result: { data: { json: value } } });

		if (endpoint === "user.get") {
			response.end(json({ id: "user_1", email: "dev@example.com" }));
			return;
		}
		if (endpoint === "server.getServerTime") {
			response.end(json("2026-10-17T12:00:00.000Z"));
			return;
		}
		if (endpoint === "project.all") {
			response.end(json([{ id: "project_1", name: "Demo" }]));
			return;
		}

		const received =
			body &&
			typeof body === "object" &&
			Object.hasOwn(body as Record<string, unknown>, "json")
				? (body as Record<string, unknown>).json
				: body;

		response.end(
			json({
				ok: true,
				endpoint,
				query,
				received,
			}),
		);
	});

	await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
	const address = server.address() as AddressInfo;

	return {
		url: `http://127.0.0.1:${address.port}`,
		requests,
		close: () =>
			new Promise<void>((resolve, reject) => {
				server.close((error) => {
					if (error) reject(error);
					else resolve();
				});
			}),
	};
}
