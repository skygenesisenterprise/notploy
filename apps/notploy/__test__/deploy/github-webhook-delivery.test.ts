import type { IncomingMessage } from "node:http";
import { Readable } from "node:stream";
import { beforeEach, describe, expect, it, vi } from "vitest";

const asRequest = (chunks: Buffer[]) =>
	Readable.from(chunks) as unknown as IncomingMessage;

const mocks = vi.hoisted(() => ({
	insertReturning: vi.fn(),
	findFirst: vi.fn(),
	updateWhere: vi.fn(),
	updateSet: vi.fn(),
	updateReturning: vi.fn(),
}));

vi.mock("drizzle-orm", () => ({
	and: vi.fn((...conditions: unknown[]) => ({ conditions })),
	eq: vi.fn((field: unknown, value: unknown) => ({ field, value })),
	lt: vi.fn((field: unknown, value: unknown) => ({ field, value, lt: true })),
	sql: vi.fn(() => "attempts + 1"),
}));

vi.mock("@notploy/server/db/schema", () => ({
	githubWebhookDelivery: {
		githubId: "delivery.githubId",
		deliveryId: "delivery.deliveryId",
		status: "delivery.status",
		receivedAt: "delivery.receivedAt",
		attempts: "delivery.attempts",
	},
}));

vi.mock("@notploy/server/db", () => ({
	db: {
		insert: vi.fn(() => ({
			values: vi.fn(() => ({
				onConflictDoNothing: vi.fn(() => ({
					returning: mocks.insertReturning,
				})),
			})),
		})),
		update: vi.fn(() => ({
			set: mocks.updateSet,
		})),
		query: {
			githubWebhookDelivery: {
				findFirst: mocks.findFirst,
			},
		},
	},
}));

import {
	claimGithubDelivery,
	completeGithubDelivery,
	GITHUB_DELIVERY_STALE_AFTER_MS,
	GithubWebhookRequestError,
	MAX_GITHUB_DELIVERY_ATTEMPTS,
	readRawWebhookBody,
} from "@/server/utils/github-webhook";

const claim = (deliveryId = "delivery-1") =>
	claimGithubDelivery({
		githubId: "github-1",
		deliveryId,
		event: "push",
	});

const existing = (overrides: Record<string, unknown> = {}) => ({
	githubId: "github-1",
	deliveryId: "delivery-1",
	status: "processed",
	attempts: 1,
	receivedAt: new Date().toISOString(),
	...overrides,
});

describe("claimGithubDelivery", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.insertReturning.mockResolvedValue([{ deliveryId: "delivery-1" }]);
		mocks.updateSet.mockReturnValue({ where: mocks.updateWhere });
		mocks.updateWhere.mockReturnValue({ returning: mocks.updateReturning });
		mocks.updateReturning.mockResolvedValue([{ deliveryId: "delivery-1" }]);
	});

	it("claims a delivery that was never seen", async () => {
		await expect(claim()).resolves.toBe("claimed");
		expect(mocks.findFirst).not.toHaveBeenCalled();
	});

	it("ignores a delivery that was already processed", async () => {
		mocks.insertReturning.mockResolvedValue([]);
		mocks.findFirst.mockResolvedValue(existing());

		await expect(claim()).resolves.toBe("duplicate");
		expect(mocks.updateSet).not.toHaveBeenCalled();
	});

	it("ignores a delivery that is currently being processed", async () => {
		mocks.insertReturning.mockResolvedValue([]);
		mocks.findFirst.mockResolvedValue(
			existing({ status: "received", attempts: 1 }),
		);

		await expect(claim()).resolves.toBe("duplicate");
	});

	it("retries a failed delivery", async () => {
		mocks.insertReturning.mockResolvedValue([]);
		mocks.findFirst.mockResolvedValue(existing({ status: "failed", attempts: 2 }));

		await expect(claim()).resolves.toBe("retried");
		expect(mocks.updateSet).toHaveBeenCalledWith(
			expect.objectContaining({ status: "received" }),
		);
	});

	it("stops retrying after the attempt limit", async () => {
		mocks.insertReturning.mockResolvedValue([]);
		mocks.findFirst.mockResolvedValue(
			existing({
				status: "failed",
				attempts: MAX_GITHUB_DELIVERY_ATTEMPTS,
			}),
		);

		await expect(claim()).resolves.toBe("duplicate");
		expect(mocks.updateSet).not.toHaveBeenCalled();
	});

	it("reclaims a delivery whose worker died mid-processing", async () => {
		mocks.insertReturning.mockResolvedValue([]);
		mocks.findFirst.mockResolvedValue(
			existing({
				status: "received",
				receivedAt: new Date(
					Date.now() - GITHUB_DELIVERY_STALE_AFTER_MS - 1000,
				).toISOString(),
			}),
		);

		await expect(claim()).resolves.toBe("retried");
	});

	it("reports a race with a concurrent claim as a duplicate", async () => {
		mocks.insertReturning.mockResolvedValue([]);
		mocks.findFirst.mockResolvedValue(existing({ status: "failed" }));
		mocks.updateReturning.mockResolvedValue([]);

		await expect(claim()).resolves.toBe("duplicate");
	});

	it("starts over when the delivery row was cleaned up concurrently", async () => {
		mocks.insertReturning.mockResolvedValue([]);
		mocks.findFirst.mockResolvedValue(undefined);

		await expect(claim()).resolves.toBe("retried");
	});
});

describe("completeGithubDelivery", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.updateSet.mockReturnValue({ where: mocks.updateWhere });
		mocks.updateWhere.mockResolvedValue([]);
	});

	it("records a processed outcome", async () => {
		await completeGithubDelivery({
			githubId: "github-1",
			deliveryId: "delivery-1",
			status: "processed",
		});

		expect(mocks.updateSet).toHaveBeenCalledWith(
			expect.objectContaining({
				status: "processed",
				processedAt: expect.any(String),
				errorMessage: null,
			}),
		);
	});

	it("records a safe failure summary", async () => {
		await completeGithubDelivery({
			githubId: "github-1",
			deliveryId: "delivery-1",
			status: "failed",
			errorMessage: "GitHub webhook processing failed",
		});

		expect(mocks.updateSet).toHaveBeenCalledWith(
			expect.objectContaining({
				status: "failed",
				errorMessage: "GitHub webhook processing failed",
			}),
		);
	});
});

describe("readRawWebhookBody", () => {
	it("reads the raw body without parsing it", async () => {
		const body = '{"ref":"refs/heads/main"}';

		await expect(
			readRawWebhookBody(asRequest([Buffer.from(body)])),
		).resolves.toBe(body);
	});

	it("reassembles multi-chunk bodies", async () => {
		await expect(
			readRawWebhookBody(
				asRequest([Buffer.from("{\"a\":"), Buffer.from("1}")]),
			),
		).resolves.toBe('{"a":1}');
	});

	it("rejects an empty body", async () => {
		await expect(readRawWebhookBody(asRequest([]))).rejects.toMatchObject({
			status: 400,
		});
	});

	it("rejects an oversized body", async () => {
		const promise = readRawWebhookBody(
			asRequest([Buffer.from("0123456789"), Buffer.from("0123456789")]),
			10,
		);

		await expect(promise).rejects.toBeInstanceOf(GithubWebhookRequestError);
		await expect(promise).rejects.toMatchObject({ status: 413 });
	});
});
