import { describe, expect, it } from "vitest";
import { classifyOperation, isAllowedByProfile, type OperationLike } from "./classification.js";

function operation(overrides: Partial<OperationLike> = {}): OperationLike {
  return {
    name: "application-create",
    tag: "application",
    method: "POST",
    ...overrides,
  };
}

describe("classifyOperation", () => {
  it("classifies GET operations as read-only", () => {
    const classification = classifyOperation(
      operation({ name: "project-all", tag: "project", method: "GET" }),
    );
    expect(classification.risk).toBe(0);
    expect(classification.effects.readOnly).toBe(true);
    expect(classification.effects.idempotent).toBe(true);
    expect(classification.effects.destructive).toBe(false);
  });

  it("classifies delete/remove/clean operations as destructive high risk", () => {
    for (const name of ["application-delete", "project-remove", "settings-cleanAll"]) {
      const classification = classifyOperation(operation({ name, tag: "settings" }));
      expect(classification.risk, name).toBe(2);
      expect(classification.effects.destructive, name).toBe(true);
    }
  });

  it("classifies platform and credential mutations as high risk", () => {
    const settings = classifyOperation(
      operation({ name: "settings-toggleDashboard", tag: "settings" }),
    );
    expect(settings.risk).toBe(2);

    const serverSetup = classifyOperation(operation({ name: "server-setup", tag: "server" }));
    expect(serverSetup.risk).toBe(2);

    const userPermissions = classifyOperation(
      operation({ name: "user-assignPermissions", tag: "user" }),
    );
    expect(userPermissions.risk).toBe(2);
  });

  it("classifies deployment operations as high risk", () => {
    const deploy = classifyOperation(operation({ name: "application-deploy", tag: "application" }));
    expect(deploy.risk).toBe(2);
    expect(deploy.effects.destructive).toBe(false);
  });

  it("classifies ordinary mutations as reversible writes", () => {
    const update = classifyOperation(operation({ name: "project-update", tag: "project" }));
    expect(update.risk).toBe(1);
    expect(update.effects.readOnly).toBe(false);
  });

  it("honors explicit overrides", () => {
    const start = classifyOperation(operation({ name: "application-start", tag: "application" }));
    expect(start.risk).toBe(1);

    const duplicate = classifyOperation(operation({ name: "project-duplicate", tag: "project" }));
    expect(duplicate.risk).toBe(1);
  });

  it("never marks generated operations as having idempotency keys or long-running tracking", () => {
    const classification = classifyOperation(operation());
    expect(classification.effects.supportsIdempotencyKey).toBe(false);
    expect(classification.effects.longRunning).toBe(false);
  });
});

describe("isAllowedByProfile", () => {
  const read = operation({ name: "project-all", method: "GET" });
  const write = operation({ name: "project-update" });
  const deploy = operation({ name: "application-deploy" });
  const destructive = operation({ name: "application-delete" });

  it("exposes only reads in the read-only profile", () => {
    expect(isAllowedByProfile("read-only", read, classifyOperation(read))).toBe(true);
    expect(isAllowedByProfile("read-only", write, classifyOperation(write))).toBe(false);
    expect(isAllowedByProfile("read-only", deploy, classifyOperation(deploy))).toBe(false);
  });

  it("exposes deployment workflow mutations in the deploy profile", () => {
    expect(isAllowedByProfile("deploy", write, classifyOperation(write))).toBe(true);
    expect(isAllowedByProfile("deploy", deploy, classifyOperation(deploy))).toBe(true);
    expect(isAllowedByProfile("deploy", destructive, classifyOperation(destructive))).toBe(false);

    const settingsWrite = operation({ name: "settings-toggleDashboard", tag: "settings" });
    expect(isAllowedByProfile("deploy", settingsWrite, classifyOperation(settingsWrite))).toBe(
      false,
    );
  });

  it("exposes everything in the full profile", () => {
    for (const operationToCheck of [read, write, deploy, destructive]) {
      expect(
        isAllowedByProfile("full", operationToCheck, classifyOperation(operationToCheck)),
      ).toBe(true);
    }
  });
});
