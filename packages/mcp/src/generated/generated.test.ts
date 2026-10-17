import { describe, expect, it } from "vitest";
import { generatedOperations } from "./operations.js";
import { generatedMetadata } from "./meta.js";

describe("generated catalog artifacts", () => {
  it("exposes metadata consistent with the generated operations", () => {
    expect(generatedMetadata.operationCount).toBe(generatedOperations.length);
    expect(generatedMetadata.specVersion).toBeTruthy();
    expect(generatedMetadata.specHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("has unique, stable names and API paths", () => {
    const names = new Set<string>();
    for (const operation of generatedOperations) {
      expect(operation.name, "operation name").toBeTruthy();
      expect(names.has(operation.name), `duplicate ${operation.name}`).toBe(false);
      names.add(operation.name);
      expect(operation.path.startsWith("/")).toBe(true);
      expect(operation.path).not.toContain("..");
      expect(["GET", "POST"]).toContain(operation.method);
      expect(operation.description.length).toBeGreaterThan(0);
      expect(operation.tag.length).toBeGreaterThan(0);
    }
  });

  it("validates input types and preserves required parameters", () => {
    let operationsWithRequiredFields = 0;

    for (const operation of generatedOperations) {
      expect(operation.schema.shape, operation.name).toBeTypeOf("object");
      // A generated tool never accepts a non-object payload.
      expect(operation.schema.safeParse(null).success, operation.name).toBe(false);
      if (!operation.schema.safeParse({}).success) operationsWithRequiredFields += 1;
    }

    expect(operationsWithRequiredFields).toBeGreaterThan(0);
  });

  it("keeps annotations consistent with the HTTP method", () => {
    for (const operation of generatedOperations) {
      expect(operation.annotations?.readOnlyHint, operation.name).toBe(
        operation.method === "GET",
      );
      expect(operation.annotations?.openWorldHint, operation.name).toBe(true);
    }
  });
});
