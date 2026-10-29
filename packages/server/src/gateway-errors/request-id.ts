import { randomBytes } from "node:crypto";

const REQUEST_ID_PATTERN = /^np_[0-9a-f]{32}$/;

export const createGatewayRequestId = (): string =>
	`np_${randomBytes(16).toString("hex")}`;

export const isGatewayRequestId = (value: unknown): value is string =>
	typeof value === "string" && REQUEST_ID_PATTERN.test(value);
