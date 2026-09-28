/**
 * Public entry point of `@notploy/sdk`.
 *
 * The generated code (see `pnpm generate`) lives in `./generated` and is
 * re-exported here so the package keeps a single, stable public surface.
 *
 * In addition to the generated operations, this module exposes the low-level
 * client runtime (`client`, `createClient`, `createConfig`). Multi-tenant
 * consumers — the CLI, the VS Code extension, MCP, tests — can build one client
 * per Notploy instance and pass it to any generated operation through the
 * `client` option, instead of mutating the process-wide `client` singleton:
 *
 * ```ts
 * import { createClient, projectAll } from "@notploy/sdk";
 *
 * const client = createClient({
 *   baseUrl: "https://notploy.example.com/api",
 *   headers: { "x-api-key": token },
 * });
 *
 * const { data } = await projectAll({ client });
 * ```
 */

export * from "./generated/index";
export { client } from "./generated/client.gen";
export { createClient, createConfig, mergeHeaders } from "./generated/client";
export type {
	Client,
	ClientOptions,
	Config,
	RequestOptions,
	RequestResult,
	ResponseStyle,
} from "./generated/client";
