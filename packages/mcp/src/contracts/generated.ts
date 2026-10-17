import type { ZodObject, ZodRawShape } from "zod";
import type { ToolAnnotations } from "./capability.js";

/**
 * One operation from the Notploy OpenAPI document.
 *
 * The generated file contains only API metadata and a Zod input schema; risk,
 * environment availability, authorization and approval are decided at runtime
 * by the MCP policy engine, not inferred once at generation time.
 */
export interface GeneratedApiOperation {
  name: string;
  description: string;
  tag: string;
  method: "GET" | "POST";
  path: string;
  schema: ZodObject<ZodRawShape>;
  annotations?: ToolAnnotations;
}
