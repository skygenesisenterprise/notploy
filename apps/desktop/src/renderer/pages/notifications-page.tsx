/**
 * Notification providers configured on the instance.
 *
 * Read-only on purpose. The API can create and update providers, but each one has
 * its own credential shape (Slack webhook, Telegram token and chat, SMTP
 * credentials, …) and the dashboard already owns those forms. Shipping a partial
 * form here would be a worse way to add a webhook than the existing one, so the
 * desktop client shows what is configured and links to where it is edited.
 */

import { Bell, ExternalLink, RefreshCw } from "lucide-react";
import {
	Button,
	EmptyState,
	ErrorNote,
	LoadingState,
	PageHeader,
	Panel,
	PanelHeader,
	TableShell,
	Td,
	Th,
	Tr,
} from "@/renderer/components/ui/primitives";
import { useAsync } from "@/renderer/hooks/use-async";
import { getBridge } from "@/renderer/lib/bridge";
import { relativeTime } from "@/renderer/lib/format";
import type { InstancePageProps } from "@/renderer/lib/page-props";

export function NotificationsPage({
	connection,
	refreshToken,
}: InstancePageProps) {
	const state = useAsync(
		() => getBridge().notifications.list(),
		[connection?.id, refreshToken],
	);

	const providers = state.data ?? [];

	return (
		<div className="flex h-full flex-col">
			<PageHeader
				title="Notifications"
				description="Notification providers configured on this instance, from notification.all."
				actions={
					<>
						<Button
							onClick={() =>
								void getBridge().app.openExternal(
									`${connection?.url ?? ""}/dashboard/settings/notifications`,
								)
							}
						>
							<ExternalLink aria-hidden className="size-3.5" />
							Manage in the dashboard
						</Button>
						<Button onClick={state.reload} busy={state.loading}>
							<RefreshCw aria-hidden className="size-3.5" />
							Refresh
						</Button>
					</>
				}
			/>

			<div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
				{state.error ? (
					<ErrorNote error={state.error} onRetry={state.reload} />
				) : null}
				{state.loading && !state.data ? <LoadingState /> : null}

				{state.data && providers.length === 0 ? (
					<EmptyState
						icon={<Bell aria-hidden className="size-8" />}
						title="No notification provider"
						description="This instance has no provider configured. Deployment notifications can be added from the dashboard."
					/>
				) : null}

				{providers.length > 0 ? (
					<Panel>
						<PanelHeader
							title="Providers"
							description="Configured notification channels and when they were added."
						/>
						<TableShell
							head={
								<>
									<Th>Name</Th>
									<Th>Type</Th>
									<Th>Created</Th>
								</>
							}
						>
							{providers.map((provider, index) => (
								<Tr key={String(provider.notificationId ?? index)}>
									<Td>{provider.name ?? "—"}</Td>
									<Td className="text-content-muted">{provider.type ?? "—"}</Td>
									<Td className="text-content-muted">
										{relativeTime(provider.createdAt)}
									</Td>
								</Tr>
							))}
						</TableShell>
					</Panel>
				) : null}
			</div>
		</div>
	);
}
