/**
 * Add / edit a connection.
 *
 * The flow mirrors how the API actually works, instead of pretending there is an
 * interactive login:
 *
 * 1. the metadata (name, URL, kind, TLS, timeout) is saved;
 * 2. an optional API key is *verified* by calling `user.session` — a key the
 *    instance rejects is never stored;
 * 3. the connection is checked so the switcher shows a real status.
 *
 * Editing never displays a stored key: it can be replaced or cleared, but it is
 * never read back into the UI.
 */

import * as React from "react";
import {
	Button,
	Checkbox,
	Field,
	Input,
	Select,
} from "@/renderer/components/ui/primitives";
import {
	asFailure,
	type BridgeFailure,
	failureHint,
	getBridge,
} from "@/renderer/lib/bridge";
import type { ConnectionKind, ConnectionSummary } from "@/shared/domain";

const KIND_LABELS: Array<{
	value: ConnectionKind;
	label: string;
	url?: string;
}> = [
	{ value: "cloud", label: "Notploy Cloud", url: "https://app.notploy.com" },
	{
		value: "self-hosted",
		label: "Self-hosted",
		url: "https://notploy.example.com",
	},
	{ value: "local", label: "Local", url: "http://localhost:3000" },
	{ value: "custom", label: "Other" },
];

export interface ConnectionFormProps {
	/** Absent when adding. */
	connection?: ConnectionSummary;
	onClose: () => void;
	onSaved: () => Promise<void> | void;
}

export function ConnectionForm({
	connection,
	onClose,
	onSaved,
}: ConnectionFormProps) {
	const editing = Boolean(connection);
	const [name, setName] = React.useState(connection?.name ?? "");
	const [url, setUrl] = React.useState(connection?.url ?? "");
	const [kind, setKind] = React.useState<ConnectionKind>(
		connection?.kind ?? "self-hosted",
	);
	const [allowInsecureTls, setAllowInsecureTls] = React.useState(
		connection?.allowInsecureTls ?? false,
	);
	const [timeout, setTimeoutMs] = React.useState(connection?.timeout ?? 30_000);
	const [apiKey, setApiKey] = React.useState("");
	const [busy, setBusy] = React.useState(false);
	const [failure, setFailure] = React.useState<BridgeFailure | undefined>();
	const [notice, setNotice] = React.useState<string | undefined>();

	const applyKind = (next: ConnectionKind) => {
		setKind(next);
		const preset = KIND_LABELS.find((entry) => entry.value === next)?.url;
		if (preset && !url.trim()) setUrl(preset);
	};

	const submit = async (event: React.FormEvent) => {
		event.preventDefault();
		setFailure(undefined);
		setNotice(undefined);

		if (!name.trim()) {
			setFailure({ code: "bad-request", message: "A name is required." });
			return;
		}
		if (!url.trim()) {
			setFailure({
				code: "bad-request",
				message: "An instance URL is required.",
			});
			return;
		}

		setBusy(true);
		const bridge = getBridge();
		try {
			if (editing && connection) {
				await bridge.connections.update(connection.id, {
					name,
					url,
					kind,
					allowInsecureTls,
					timeout,
					// An empty field means "leave the stored key alone"; the explicit
					// clear action is a separate control.
					apiKey: apiKey.trim() ? apiKey.trim() : undefined,
				});
				if (apiKey.trim()) {
					await bridge.connections.login(connection.id, apiKey.trim());
				}
				const summary = await bridge.connections.test(connection.id);
				setNotice(
					summary.status === "connected"
						? "Saved. The instance answered with this API key."
						: `Saved. ${summary.error ?? "The instance did not accept the credential."}`,
				);
			} else {
				const created = await bridge.connections.add({
					name,
					url,
					kind,
					allowInsecureTls,
					timeout,
					apiKey: apiKey.trim() ? apiKey.trim() : undefined,
				});
				if (apiKey.trim()) {
					await bridge.connections.login(created.id, apiKey.trim());
				}
				const summary = await bridge.connections.test(created.id);
				setNotice(
					summary.status === "connected"
						? `${created.name} is connected.`
						: `Added. ${summary.error ?? "The instance did not accept the credential."}`,
				);
			}

			await onSaved();
			// Closing on success keeps the flow short; the status is now visible in
			// the switcher and on the Connections page.
			onClose();
		} catch (caught) {
			setFailure(asFailure(caught));
		} finally {
			setBusy(false);
		}
	};

	return (
		<div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/60 p-6">
			{/*
				The click-away surface is a real button rather than a div with an
				onClick: dismissing the form is an action, and a button is reachable by
				keyboard and announced as a control.
			*/}
			<button
				type="button"
				aria-label="Close without saving"
				onClick={onClose}
				className="absolute inset-0 cursor-default"
			/>
			<form
				onSubmit={submit}
				className="relative mt-10 w-full max-w-lg rounded-lg border border-border bg-surface-raised p-5 shadow-2xl"
			>
				<h2 className="text-base font-semibold text-content">
					{editing ? `Edit ${connection?.name}` : "Add a connection"}
				</h2>
				<p className="mt-1 text-xs text-content-muted">
					The URL is the instance origin, without <code>/api</code>. The API key
					is stored in the operating system keychain.
				</p>

				<div className="mt-4 space-y-4">
					<Field label="Name" htmlFor="connection-name">
						<Input
							id="connection-name"
							value={name}
							onChange={(event) => setName(event.target.value)}
							placeholder="Production"
							autoFocus
						/>
					</Field>

					<Field label="Kind" htmlFor="connection-kind">
						<Select
							id="connection-kind"
							value={kind}
							onChange={(event) =>
								applyKind(event.target.value as ConnectionKind)
							}
						>
							{KIND_LABELS.map((entry) => (
								<option key={entry.value} value={entry.value}>
									{entry.label}
								</option>
							))}
						</Select>
					</Field>

					<Field
						label="Instance URL"
						htmlFor="connection-url"
						hint="Only http and https origins are accepted; an https:// prefix is added when it is missing."
					>
						<Input
							id="connection-url"
							value={url}
							onChange={(event) => setUrl(event.target.value)}
							placeholder="https://notploy.example.com"
							spellCheck={false}
						/>
					</Field>

					<Field
						label={editing ? "Replace API key" : "API key"}
						htmlFor="connection-key"
						hint={
							editing
								? "Leave empty to keep the stored key. Use Remove API key on the Connections page to clear it."
								: "Generate one in the Notploy dashboard under Settings → API Keys. It is verified before being stored."
						}
					>
						<Input
							id="connection-key"
							type="password"
							value={apiKey}
							onChange={(event) => setApiKey(event.target.value)}
							placeholder={editing ? "••••••••" : "Paste the API key"}
							autoComplete="off"
							spellCheck={false}
						/>
					</Field>

					<Field
						label="Request timeout (ms)"
						htmlFor="connection-timeout"
						hint="Between 1 and 10 minutes. A slow instance may need more than the 30 second default."
					>
						<Input
							id="connection-timeout"
							type="number"
							min={1000}
							max={600_000}
							step={1000}
							value={timeout}
							onChange={(event) =>
								setTimeoutMs(Number(event.target.value) || 30_000)
							}
						/>
					</Field>

					<Checkbox
						label="Allow an untrusted TLS certificate"
						description="Only for an instance you control on a trusted network. Certificate verification is skipped for this connection alone, through its own Chromium session."
						checked={allowInsecureTls}
						onChange={(event) => setAllowInsecureTls(event.target.checked)}
					/>
				</div>

				{failure ? (
					<div className="mt-4 rounded-md border border-danger/30 bg-danger-soft/60 px-3 py-2">
						<p className="text-sm text-content">{failure.message}</p>
						{failureHint(failure.code) ? (
							<p className="mt-1 text-xs text-content-muted">
								{failureHint(failure.code)}
							</p>
						) : null}
					</div>
				) : null}

				{notice ? (
					<p className="mt-4 text-xs text-content-muted">{notice}</p>
				) : null}

				<div className="mt-5 flex justify-end gap-2">
					<Button variant="ghost" onClick={onClose} disabled={busy}>
						Close
					</Button>
					<Button type="submit" variant="primary" busy={busy}>
						{editing ? "Save and test" : "Add and test"}
					</Button>
				</div>
			</form>
		</div>
	);
}
