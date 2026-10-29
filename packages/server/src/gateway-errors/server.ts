import http, {
	type IncomingMessage,
	type ServerResponse,
} from "node:http";
import {
	getGatewayErrorPageConfig,
	type GatewayErrorPageConfig,
} from "./config";
import {
	renderFallbackGatewayErrorPage,
	renderGatewayErrorPage,
} from "./render";
import { resolveGatewayError } from "./registry";
import { createGatewayRequestId } from "./request-id";

const DEFAULT_PORT = 8080;
const RETRY_AFTER_SECONDS = "30";
const SAFE_PATH_PATTERN = /^\/[A-Za-z0-9/_.~%:-]{0,200}$/;

export interface GatewayErrorLogRecord {
	event: "gateway_error";
	requestId: string;
	code: string;
	status: number;
	timestamp: string;
	method: string;
	path?: string;
}

export interface GatewayErrorHandlerOptions {
	env?: Record<string, string | undefined>;
	config?: GatewayErrorPageConfig;
	now?: () => Date;
	logger?: (record: GatewayErrorLogRecord) => void;
}

const defaultLogger = (record: GatewayErrorLogRecord): void => {
	console.log(JSON.stringify(record));
};

const parseStatus = (value: string | null): number => {
	if (!value) return 404;
	const parsed = Number.parseInt(value, 10);
	return Number.isInteger(parsed) && parsed >= 400 && parsed <= 599
		? parsed
		: 404;
};

const splitRequestTarget = (
	requestUrl: string | undefined,
): { pathname: string; query: URLSearchParams } => {
	const target = requestUrl ?? "/";
	const queryIndex = target.indexOf("?");
	const pathname = queryIndex >= 0 ? target.slice(0, queryIndex) : target;
	const queryString = queryIndex >= 0 ? target.slice(queryIndex + 1) : "";
	return {
		pathname: pathname || "/",
		query: new URLSearchParams(queryString),
	};
};

const safeLogPath = (pathname: string): string | undefined =>
	SAFE_PATH_PATTERN.test(pathname) ? pathname : undefined;

export const handleGatewayErrorRequest = (
	request: IncomingMessage,
	response: ServerResponse,
	options: GatewayErrorHandlerOptions = {},
): void => {
	const { pathname, query } = splitRequestTarget(request.url);

	if (pathname === "/healthz") {
		const body = "ok\n";
		response.statusCode = 200;
		response.setHeader("Content-Type", "text/plain; charset=utf-8");
		response.setHeader("Content-Length", Buffer.byteLength(body));
		response.setHeader("Cache-Control", "no-store");
		response.setHeader("X-Content-Type-Options", "nosniff");
		response.end(request.method === "HEAD" ? undefined : body);
		return;
	}

	const config =
		options.config ??
		getGatewayErrorPageConfig(options.env ?? process.env);
	const definition = resolveGatewayError(
		parseStatus(query.get("status")),
		query.get("code"),
	);
	const requestId = createGatewayRequestId();
	const timestamp = options.now?.() ?? new Date();

	let body: string;
	try {
		body = renderGatewayErrorPage({
			error: definition,
			requestId,
			timestamp,
			config,
		});
	} catch (error) {
		console.error(
			JSON.stringify({
				event: "gateway_error_render_failed",
				message: error instanceof Error ? error.message : "unknown",
			}),
		);
		body = renderFallbackGatewayErrorPage();
	}

	response.statusCode = definition.httpStatus;
	response.setHeader("Content-Type", "text/html; charset=utf-8");
	response.setHeader("Content-Length", Buffer.byteLength(body));
	response.setHeader("Cache-Control", "no-store, max-age=0");
	response.setHeader("Pragma", "no-cache");
	response.setHeader("X-Content-Type-Options", "nosniff");
	response.setHeader("X-Frame-Options", "DENY");
	response.setHeader("Referrer-Policy", "no-referrer");
	response.setHeader("X-Robots-Tag", "noindex, nofollow");
	response.setHeader("X-Notploy-Error-Code", definition.code);
	response.setHeader("X-Notploy-Request-Id", requestId);
	response.setHeader(
		"Content-Security-Policy",
		"default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
	);
	if (definition.retryable) {
		response.setHeader("Retry-After", RETRY_AFTER_SECONDS);
	}

	const logger = options.logger ?? defaultLogger;
	logger({
		event: "gateway_error",
		requestId,
		code: definition.code,
		status: definition.httpStatus,
		timestamp: timestamp.toISOString(),
		method: (request.method ?? "GET").slice(0, 16),
		path: safeLogPath(pathname),
	});

	response.end(request.method === "HEAD" ? undefined : body);
};

export interface StartGatewayErrorsServerOptions {
	port?: number;
	host?: string;
	env?: Record<string, string | undefined>;
	config?: GatewayErrorPageConfig;
	now?: () => Date;
	logger?: (record: GatewayErrorLogRecord) => void;
}

const resolvePort = (value: string | undefined): number => {
	const parsed = Number.parseInt(value ?? "", 10);
	return Number.isInteger(parsed) && parsed > 0 && parsed <= 65535
		? parsed
		: DEFAULT_PORT;
};

export const startGatewayErrorsServer = (
	options: StartGatewayErrorsServerOptions = {},
) => {
	const env = options.env ?? process.env;
	const port = options.port ?? resolvePort(env.NOTPLOY_GATEWAY_PORT);
	const host = options.host ?? "0.0.0.0";

	const server = http.createServer((request, response) => {
		handleGatewayErrorRequest(request, response, {
			env,
			config: options.config,
			now: options.now,
			logger: options.logger,
		});
	});

	server.listen(port, host, () => {
		console.log(
			JSON.stringify({
				event: "gateway_errors_listening",
				host,
				port,
			}),
		);
	});

	return server;
};
