/**
 * TLS opt-out, scoped to one connection.
 *
 * Some self-hosted installs sit behind a self-signed certificate. The user can
 * accept that per connection, and nothing else changes: only the requests of
 * that connection skip verification, through a Chromium session created for it
 * alone. Every other connection keeps the default, verifying session.
 *
 * The session is created lazily because a connection that never needs the opt
 * out must not pay for a partition, and `setCertificateVerifyProc` is installed
 * exactly once per partition — installing it twice on the same session would
 * stack callbacks.
 */

import { net, session } from "electron";

const configured = new Set<string>();

function partitionFor(connectionId: string): string {
	// `persist:` is deliberately not used: the trust decision is re-evaluated on
	// every launch and lives only as long as the process.
	return `notploy-insecure-${connectionId}`;
}

export function createInsecureFetch(
	connectionId: string,
): typeof globalThis.fetch {
	const partition = partitionFor(connectionId);
	const target = session.fromPartition(partition);

	if (!configured.has(partition)) {
		configured.add(partition);
		target.setCertificateVerifyProc((_request, callback) => {
			// 0 = accept, -3 = use Chromium's default verification.
			callback(0);
		});
	}

	// The `fetch` signature is taken from the platform itself rather than from
	// `lib.dom`, which the Node side of the app deliberately does not include:
	// `RequestInfo` is not a global in the Node type definitions.
	type FetchInput = Parameters<typeof globalThis.fetch>[0];
	type FetchInit = Parameters<typeof globalThis.fetch>[1];

	const insecureFetch = (async (input: FetchInput, init?: FetchInit) =>
		await net.fetch(
			input as string,
			{
				...(init as Record<string, unknown>),
				session: target,
			} as never,
		)) as unknown as typeof globalThis.fetch;

	return insecureFetch;
}
