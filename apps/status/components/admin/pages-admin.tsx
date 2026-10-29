"use client";

import type { AdminPageDto } from "@notploy/status";
import Link from "next/link";
import * as React from "react";
import { adminRequest } from "@/lib/admin-client";
import { useAdminResource } from "@/lib/use-admin";
import { StatusBadge } from "../status-badge";
import { useAdminToken } from "./admin-token-provider";
import { Button, Card, Field, Input, Notice } from "./ui";

export const PagesAdmin = () => {
	const { token } = useAdminToken();
	const pages = useAdminResource<{ items: AdminPageDto[] }>(
		token,
		"/admin/pages",
	);
	const [form, setForm] = React.useState({
		slug: "",
		name: "",
		description: "",
	});
	const [error, setError] = React.useState<string | null>(null);
	const [busy, setBusy] = React.useState(false);

	const submit = async (event: React.FormEvent) => {
		event.preventDefault();
		if (!token) {
			return;
		}
		setBusy(true);
		setError(null);
		try {
			await adminRequest(token, "/admin/pages", {
				method: "POST",
				body: JSON.stringify(form),
			});
			setForm({ slug: "", name: "", description: "" });
			pages.reload();
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : "Request failed");
		} finally {
			setBusy(false);
		}
	};

	return (
		<div className="flex flex-col gap-6">
			<Card
				title="Status pages"
				description="Each page is an independent publication scope."
			>
				{pages.loading ? (
					<p className="text-sm text-muted-foreground">Loading…</p>
				) : null}
				{pages.error ? <Notice tone="error">{pages.error}</Notice> : null}
				{pages.data?.items.length === 0 ? (
					<p className="text-sm text-muted-foreground">
						No status page yet — create the first one below.
					</p>
				) : null}
				<ul className="flex flex-col divide-y divide-border">
					{pages.data?.items.map((page) => (
						<li
							key={page.id}
							className="flex flex-wrap items-center justify-between gap-3 py-3"
						>
							<div className="flex flex-col gap-0.5">
								<Link
									href={`/admin/${page.slug}`}
									className="font-medium hover:underline"
								>
									{page.name}
								</Link>
								<span className="text-xs text-muted-foreground">
									/p/{page.slug} · {page.description || "No description"}
								</span>
							</div>
							<StatusBadge status={page.status} scope="page" />
						</li>
					))}
				</ul>
			</Card>

			<Card
				title="Create a status page"
				description="The slug becomes the public URL segment (/p/{slug})."
			>
				<form onSubmit={submit} className="flex flex-col gap-3">
					<div className="grid gap-3 sm:grid-cols-2">
						<Field label="Slug">
							<Input
								value={form.slug}
								onChange={(event) =>
									setForm({ ...form, slug: event.target.value })
								}
								placeholder="notploy"
								pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
								required
							/>
						</Field>
						<Field label="Name">
							<Input
								value={form.name}
								onChange={(event) =>
									setForm({ ...form, name: event.target.value })
								}
								placeholder="Notploy Status"
								required
							/>
						</Field>
					</div>
					<Field label="Description">
						<Input
							value={form.description}
							onChange={(event) =>
								setForm({ ...form, description: event.target.value })
							}
							placeholder="Real-time status of the platform services"
						/>
					</Field>
					{error ? <Notice tone="error">{error}</Notice> : null}
					<Button type="submit" variant="primary" disabled={busy}>
						Create page
					</Button>
				</form>
			</Card>
		</div>
	);
};
