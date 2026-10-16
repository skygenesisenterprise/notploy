import { PenBoxIcon, Play, RotateCw, Square } from "lucide-react";
import { toast } from "sonner";
import { DeleteOnionService } from "@/components/dashboard/compose/onion/delete-onion-service";
import { EditOnionService } from "@/components/dashboard/compose/onion/edit-onion-service";
import {
	type OnionServiceListItem,
	OnionStatusBadge,
} from "@/components/dashboard/compose/onion/onion-status";
import { Button } from "@/components/ui/button";
import { api } from "@/utils/api";

interface Props {
	onionService: OnionServiceListItem;
	/**
	 * When provided the Edit action is delegated to the caller (the Onion
	 * Services manager edits in place); otherwise a dialog is opened.
	 */
	onEdit?: (onionServiceId: string) => void;
	withStatus?: boolean;
}

/**
 * Start / stop / restart / edit / delete for one managed Onion Service. Shared
 * by the domains list and the Onion Services manager so the behaviour is
 * identical wherever the resource shows up.
 */
export const OnionRowActions = ({
	onionService,
	onEdit,
	withStatus = false,
}: Props) => {
	const utils = api.useUtils();
	const { data: permissions } = api.user.getPermissions.useQuery();
	const { data: runtime } = api.onion.status.useQuery(
		{ onionServiceId: onionService.onionServiceId },
		{ refetchInterval: 10000 },
	);

	const { mutateAsync: start, isPending: isStarting } =
		api.onion.start.useMutation();
	const { mutateAsync: stop, isPending: isStopping } =
		api.onion.stop.useMutation();
	const { mutateAsync: restart, isPending: isRestarting } =
		api.onion.restart.useMutation();

	const runLifecycle = async (message: string, run: () => Promise<unknown>) => {
		try {
			await run();
			toast.success(message);
			await utils.onion.list.invalidate({ composeId: onionService.composeId });
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: "The Tor runtime rejected the action",
			);
		}
	};

	const status = runtime?.status ?? onionService.status;
	const onionServiceId = onionService.onionServiceId;
	const isBusy = isStarting || isStopping || isRestarting;

	return (
		<div className="flex items-center gap-1">
			{withStatus && <OnionStatusBadge status={status} />}

			{permissions?.service.create && (
				<>
					{status === "running" ? (
						<>
							<Button
								variant="ghost"
								size="icon"
								className="group h-8 w-8 hover:bg-blue-500/10"
								disabled={isBusy}
								title="Restart the Tor container"
								onClick={() =>
									runLifecycle("Onion Service restarted", () =>
										restart({ onionServiceId }),
									)
								}
							>
								<RotateCw className="size-4 text-primary group-hover:text-blue-500" />
							</Button>
							<Button
								variant="ghost"
								size="icon"
								className="group h-8 w-8 hover:bg-orange-500/10"
								disabled={isBusy}
								title="Stop the Tor container"
								onClick={() =>
									runLifecycle("Onion Service stopped", () =>
										stop({ onionServiceId }),
									)
								}
							>
								<Square className="size-4 text-primary group-hover:text-orange-500" />
							</Button>
						</>
					) : (
						<Button
							variant="ghost"
							size="icon"
							className="group h-8 w-8 hover:bg-green-500/10"
							disabled={isBusy}
							title="Start the Tor container"
							onClick={() =>
								runLifecycle("Onion Service started", () =>
									start({ onionServiceId }),
								)
							}
						>
							<Play className="size-4 text-primary group-hover:text-green-500" />
						</Button>
					)}

					{onEdit ? (
						<Button
							variant="ghost"
							size="icon"
							className="group h-8 w-8 hover:bg-blue-500/10"
							title="Edit the Onion Service"
							onClick={() => onEdit(onionServiceId)}
						>
							<PenBoxIcon className="size-3.5 text-primary group-hover:text-blue-500" />
						</Button>
					) : (
						<EditOnionService
							composeId={onionService.composeId}
							onionServiceId={onionServiceId}
						>
							<Button
								variant="ghost"
								size="icon"
								className="group h-8 w-8 hover:bg-blue-500/10"
								title="Edit the Onion Service"
							>
								<PenBoxIcon className="size-3.5 text-primary group-hover:text-blue-500" />
							</Button>
						</EditOnionService>
					)}
				</>
			)}

			{permissions?.service.delete && (
				<DeleteOnionService
					composeId={onionService.composeId}
					onionServiceId={onionServiceId}
					trigger="icon"
				/>
			)}
		</div>
	);
};
