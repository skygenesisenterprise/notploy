/**
 * Instance configuration shared by services.
 *
 * Tags, TLS certificates, SSH keys, container registries and backup
 * destinations. They are gathered in one service because they are one kind of
 * thing operationally — "what does this instance have configured for the
 * services that run on it?" — and because they share a property that matters
 * more than their shape: **every one of them carries credential material on the
 * wire**.
 *
 * Stripping that material is the client's job (`NotployClient.tags()` and its
 * siblings normalise each record field by field), and this service adds nothing
 * to what the client returns. That is deliberate: there is exactly one place
 * where a private key could leak into the renderer, and it is the normalizer,
 * where it is tested.
 *
 * All five are read-only here. Creating any of them means submitting key
 * material or a password, and the dashboard already owns those forms — see
 * `docs/desktop/parity.md`.
 */

import type {
	Certificate,
	Destination,
	Registry,
	SshKey,
	Tag,
} from "@/shared/domain";
import type { ConnectionManager } from "../connection/connection-manager";

export class OperationsService {
	constructor(private readonly manager: ConnectionManager) {}

	async tags(): Promise<Tag[]> {
		const client = await this.manager.authenticatedClient();
		return await client.tags();
	}

	async certificates(): Promise<Certificate[]> {
		const client = await this.manager.authenticatedClient();
		return await client.certificates();
	}

	async sshKeys(): Promise<SshKey[]> {
		const client = await this.manager.authenticatedClient();
		return await client.sshKeys();
	}

	async registries(): Promise<Registry[]> {
		const client = await this.manager.authenticatedClient();
		return await client.registries();
	}

	async destinations(): Promise<Destination[]> {
		const client = await this.manager.authenticatedClient();
		return await client.destinations();
	}
}
