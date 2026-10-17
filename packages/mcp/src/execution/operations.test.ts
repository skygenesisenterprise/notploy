import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { OperationStore } from "./operations.js";

const SCOPE = { identityId: "user-1", organizationId: "org-1" };

async function createRunning(store: OperationStore, capability = "execute_deployment") {
  return store.create({
    capability,
    status: "running",
    identityId: SCOPE.identityId,
    organizationId: SCOPE.organizationId,
    environment: "self",
    requestId: "req-1",
  });
}

describe("OperationStore", () => {
  const cleanups: (() => Promise<void>)[] = [];

  afterEach(async () => {
    for (const cleanup of cleanups.splice(0)) await cleanup();
  });

  it("scopes operations to the identity and organization", async () => {
    const store = new OperationStore({ retentionMs: 60_000 });
    const operation = await createRunning(store);

    expect(await store.getScoped(operation.id, SCOPE)).toBeDefined();
    expect(
      await store.getScoped(operation.id, { identityId: "user-2", organizationId: "org-1" }),
    ).toBeUndefined();
    expect(
      await store.getScoped(operation.id, { identityId: "user-1", organizationId: "org-2" }),
    ).toBeUndefined();
    expect(await store.getScoped("missing", SCOPE)).toBeUndefined();
  });

  it("updates status, result and completion time", async () => {
    const store = new OperationStore({ retentionMs: 60_000 });
    const operation = await createRunning(store);

    const updated = await store.update(operation.id, {
      status: "succeeded",
      data: { result: "ok" },
      verification: { status: "verified", message: "done" },
    });

    expect(updated?.status).toBe("succeeded");
    expect(updated?.data).toEqual({ result: "ok" });
    expect(updated?.completedAt).toBeDefined();
    expect(updated?.verification?.status).toBe("verified");
  });

  it("persists operations and marks interrupted runs after a restart", async () => {
    const directory = await mkdtemp(join(tmpdir(), "notploy-mcp-operations-"));
    cleanups.push(() => rm(directory, { recursive: true, force: true }));
    const path = join(directory, "operations.json");

    const first = new OperationStore({ path, retentionMs: 60_000 });
    await first.init();
    const operation = await createRunning(first);
    await first.close();

    const second = new OperationStore({ path, retentionMs: 60_000 });
    await second.init();
    expect((await second.getScoped(operation.id, SCOPE))?.status).toBe("running");

    await second.markRunningAsInterrupted();
    const interrupted = await second.getScoped(operation.id, SCOPE);
    expect(interrupted?.status).toBe("interrupted");
    expect(interrupted?.error?.retryable).toBe(true);
    await second.close();
  });

  it("prunes operations past the retention window", async () => {
    const store = new OperationStore({ retentionMs: 1 });
    const oldOperation = await createRunning(store);
    await new Promise((resolve) => setTimeout(resolve, 10));
    await createRunning(store, "another_capability");

    expect(await store.getScoped(oldOperation.id, SCOPE)).toBeUndefined();
  });

  it("finds operations by idempotency key", async () => {
    const store = new OperationStore({ retentionMs: 60_000 });
    const operation = await store.create({
      capability: "execute_deployment",
      status: "running",
      identityId: SCOPE.identityId,
      organizationId: SCOPE.organizationId,
      environment: "self",
      requestId: "req-1",
      idempotencyKey: "key-12345",
    });

    expect((await store.findByIdempotencyKey("key-12345"))?.id).toBe(operation.id);
    expect(await store.findByIdempotencyKey("other-key")).toBeUndefined();
  });
});
