"use client";

import type { AdminTokenDto, TokenScope } from "@notploy/status";
import * as React from "react";
import { adminRequest } from "@/lib/admin-client";
import { useAdminResource } from "@/lib/use-admin";
import { useAdminToken } from "./admin-token-provider";
import { Button, Card, Field, Input, Notice } from "./ui";

const SCOPES: TokenScope[] = [
	"read",
	"write",
	"publish",
	"ingest",
	"tokens",
	"admin",
];

export const TokensAdmin = () => {
	const { token } = useAdminToken();
	const tokens = useAdminResource<{ items: AdminTokenDto[] }>(
		token,
		"/admin/tokens",
	);
	const [name, setName] = React.useState("");
	const [scopes, setScopes] = React.useState<TokenScope[]>(["read"]);
	const [created, setCreated] = React.useState<string | null>(null);
	const [error, setError] = React.useState<string | null>(null);
	const [busy, setBusy] = React.useState(false);

	const toggleScope = (scope: TokenScope): void => {
		setScopes((current) =>
			current.includes(scope)
				? current.filter((entry) => entry !== scope)
				: [...current, scope],
		);
	};

	const submit = async (event: React.FormEvent) => {
		event.preventDefault();
		if (!token) {
			return;
		}
		setBusy(true);
		setError(null);
		try {
			const result = await adminRequest<{ value: string }>(
				token,
				"/admin/tokens",
				{
					method: "POST",
					body: JSON.stringify({ name, scopes }),
				},
			);
			setCreated(result.value);
			setName("");
			tokens.reload();
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : "Request failed");
		} finally {
			setBusy(false);
		}
	};

	const revoke = async (tokenId: string) => {
		if (!token) {
			return;
		}
		try {
			await adminRequest(token, `/admin/tokens/${tokenId}`, {
				method: "DELETE",
			});
			tokens.reload();
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : "Request failed");
		}
	};

	return (
		<div className="flex flex-col gap-6">
			{created ? (
				<Card
					title="Token created"
					description="Copy it now — the value is shown exactly once."
				>
					<Input readOnly value={created} onFocus={(e) => e.target.select()} />
					<Button variant="ghost" onClick={() => setCreated(null)}>
						Dismiss
					</Button>
				</Card>
			) : null}

			<Card
				title="API tokens"
				description="Machine credentials used by the console, monitoring agents and this UI."
			>
				{tokens.loading ? (
					<p className="text-sm text-muted-foreground">Loading…</p>
				) : null}
				{tokens.error ? <Notice tone="error">{tokens.error}</Notice> : null}
				<ul className="flex flex-col divide-y divide-border">
					{tokens.data?.items.map((entry) => (
						<li
							key={entry.id}
							className="flex flex-wrap items-center justify-between gap-3 py-3"
						>
							<div className="flex flex-col gap-0.5">
								<span className="font-medium">{entry.name}</span>
								<span className="text-xs text-muted-foreground">
									{entry.prefix}… · {entry.scopes.join(", ")}
									{entry.revokedAt ? " · revoked" : ""}
								</span>
							</div>
							{entry.revokedAt ? null : (
								<Button variant="danger" onClick={() => revoke(entry.id)}>
									Revoke
								</Button>
							)}
						</li>
					))}
				</ul>
			</Card>

			<Card
				title="Create a token"
				description="Grant only the scopes you need."
			>
				<form onSubmit={submit} className="flex flex-col gap-3">
					<Field label="Name">
						<Input
							value={name}
							onChange={(event) => setName(event.target.value)}
							placeholder="Console"
							required
						/>
					</Field>
					<fieldset className="flex flex-col gap-2">
						<legend className="text-sm font-medium">Scopes</legend>
						<div className="flex flex-wrap gap-3">
							{SCOPES.map((scope) => (
								<label
									key={scope}
									className="inline-flex items-center gap-2 text-sm"
								>
									<input
										type="checkbox"
										checked={scopes.includes(scope)}
										onChange={() => toggleScope(scope)}
									/>
									{scope}
								</label>
							))}
						</div>
					</fieldset>
					{error ? <Notice tone="error">{error}</Notice> : null}
					<Button
						type="submit"
						variant="primary"
						disabled={busy || scopes.length === 0}
					>
						Create token
					</Button>
				</form>
			</Card>
		</div>
	);
};
