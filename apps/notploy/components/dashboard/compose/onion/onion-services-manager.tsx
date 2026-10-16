import { useState } from "react";
import { OnionRowActions } from "@/components/dashboard/compose/onion/onion-row-actions";
import { OnionServiceForm } from "@/components/dashboard/compose/onion/onion-service-form";
import {
	type OnionServiceListItem,
	OnionStatusBadge,
} from "@/components/dashboard/compose/onion/onion-status";
import { Button } from "@/components/ui/button";
import { api } from "@/utils/api";

const OnionServiceRow = ({
	onionService,
	onEdit,
	isEditing,
}: {
	onionService: OnionServiceListItem;
	onEdit: (onionServiceId: string) => void;
	isEditing: boolean;
}) => {
	const { data: runtime } = api.onion.status.useQuery(
		{ onionServiceId: onionService.onionServiceId },
		{ refetchInterval: 10000 },
	);

	const status = runtime?.status ?? onionService.status;
	const address = runtime?.onionAddress ?? onionService.onionAddress;

	return (
		<div className="flex flex-col gap-3 rounded-lg border p-3">
			<div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
				<div className="flex min-w-0 flex-col gap-1">
					<div className="flex flex-wrap items-center gap-2">
						<span className="font-medium text-sm">{onionService.name}</span>
						<OnionStatusBadge status={status} />
					</div>
					<span className="text-muted-foreground text-xs">
						{onionService.serviceName}:{onionService.targetPort} → onion port{" "}
						{onionService.virtualPort}
					</span>
					{address && <code className="truncate text-xs">{address}</code>}
					{onionService.lastError && status === "error" && (
						<span className="text-destructive text-xs">
							{onionService.lastError}
						</span>
					)}
				</div>

				<OnionRowActions
					onionService={onionService}
					onEdit={isEditing ? undefined : onEdit}
				/>
			</div>
		</div>
	);
};

/**
 * Onion Service management, embedded in the Compose "Add Domain" dialog: the
 * Tor address is another way to expose a service, so it is created, updated and
 * operated next to the DNS domains instead of in a section of its own.
 */
export const OnionServicesManager = ({ composeId }: { composeId: string }) => {
	const { data: onionServices } = api.onion.list.useQuery({ composeId });
	const [editingId, setEditingId] = useState<string | null>(null);

	const isEditing = !!editingId;

	return (
		<div className="flex flex-col gap-4">
			{onionServices && onionServices.length > 0 && (
				<div className="flex flex-col gap-2">
					<span className="font-medium text-sm">Existing Onion Services</span>
					{onionServices.map((onionService) => (
						<OnionServiceRow
							key={onionService.onionServiceId}
							onionService={onionService}
							isEditing={editingId === onionService.onionServiceId}
							onEdit={setEditingId}
						/>
					))}
				</div>
			)}

			<div className="flex flex-row items-center justify-between">
				<span className="font-medium text-sm">
					{isEditing ? "Update Onion Service" : "New Onion Service"}
				</span>
				{isEditing && (
					<Button variant="ghost" size="sm" onClick={() => setEditingId(null)}>
						Cancel edit
					</Button>
				)}
			</div>

			<OnionServiceForm
				key={editingId ?? "new-onion-service"}
				composeId={composeId}
				onionServiceId={editingId ?? undefined}
				onDone={() => setEditingId(null)}
			/>
		</div>
	);
};
