"use client";

import type { AuditLogDto } from "@notploy/status";
import { useAdminResource } from "@/lib/use-admin";
import { formatDateTime } from "@/lib/view-model";
import { useAdminToken } from "./admin-token-provider";
import { Card, Notice } from "./ui";

export const AuditAdmin = () => {
	const { token } = useAdminToken();
	const audit = useAdminResource<{
		items: AuditLogDto[];
		nextCursor: string | null;
	}>(token, "/admin/audit?limit=50");

	return (
		<Card
			title="Audit log"
			description="Every sensitive operation, most recent first."
		>
			{audit.loading ? (
				<p className="text-sm text-muted-foreground">Loading…</p>
			) : null}
			{audit.error ? <Notice tone="error">{audit.error}</Notice> : null}
			{audit.data?.items.length === 0 ? (
				<p className="text-sm text-muted-foreground">Nothing recorded yet.</p>
			) : null}
			<ul className="flex flex-col divide-y divide-border">
				{audit.data?.items.map((entry) => (
					<li key={entry.id} className="flex flex-col gap-0.5 py-3">
						<div className="flex flex-wrap items-center gap-2 text-sm">
							<span className="font-medium">{entry.action}</span>
							<span className="text-muted-foreground">
								{entry.subjectType}
								{entry.subjectId ? ` ${entry.subjectId}` : ""}
							</span>
						</div>
						<span className="text-xs text-muted-foreground">
							{entry.actorLabel} · {formatDateTime(entry.at)}
						</span>
					</li>
				))}
			</ul>
		</Card>
	);
};
