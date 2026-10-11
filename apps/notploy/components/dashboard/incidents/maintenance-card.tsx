import { Trash2Icon } from "lucide-react";
import { useRouter } from "next/router";
import * as React from "react";
import { toast } from "sonner";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { api } from "@/utils/api";
import type {
	AdminComponentDto,
	AdminMaintenanceDto,
	MaintenanceState,
} from "@/lib/status";
import { MaintenanceStateBadge, PublicationBadge } from "./status-badges";

const OPEN_STATES: Array<{ value: MaintenanceState; label: string }> = [
	{ value: "in_progress", label: "In progress" },
	{ value: "completed", label: "Completed" },
	{ value: "cancelled", label: "Cancelled" },
];

const TERMINAL_STATES: MaintenanceState[] = ["completed", "cancelled"];

const formatWindow = (
	startAt: string,
	endAt: string,
	timeZone: string,
): string => {
	const start = new Date(startAt).toLocaleString(undefined, {
		dateStyle: "medium",
		timeStyle: "short",
	});
	const end = new Date(endAt).toLocaleString(undefined, {
		dateStyle: "medium",
		timeStyle: "short",
	});
	return `${start} → ${end} (${timeZone})`;
};

export const MaintenanceCard = ({
	maintenance,
	components,
}: {
	maintenance: AdminMaintenanceDto;
	components: AdminComponentDto[];
}) => {
	const router = useRouter();
	const [stateOpen, setStateOpen] = React.useState(false);
	const [state, setState] = React.useState<MaintenanceState>("in_progress");

	const setStateMutation = api.status.setMaintenanceState.useMutation({
		onSuccess: () => {
			toast.success("Maintenance updated");
		},
		onError: (error) => {
			toast.error(error.message || "Failed to update the maintenance");
		},
	});

	const publishMaintenance = api.status.publishMaintenance.useMutation({
		onSuccess: (updated) => {
			toast.success(
				updated.published
					? "Maintenance published"
					: "Maintenance withdrawn",
			);
		},
		onError: (error) => {
			toast.error(error.message || "Failed to update the publication");
		},
	});

	const deleteMaintenance = api.status.deleteMaintenance.useMutation({
		onSuccess: () => {
			toast.success("Maintenance deleted");
		},
		onError: (error) => {
			toast.error(error.message || "Failed to delete the maintenance");
		},
	});

	const isTerminal = TERMINAL_STATES.includes(maintenance.state);
	const affectedNames = maintenance.componentIds
		.map((id) => components.find((component) => component.id === id)?.name)
		.filter((name): name is string => Boolean(name));

	const changeState = async () => {
		try {
			await setStateMutation.mutateAsync({
				maintenanceId: maintenance.id,
				state,
			});
			setStateOpen(false);
			await router.replace(router.asPath);
		} catch {
			// Surfaced through the mutation's onError toast.
		}
	};

	const togglePublication = async () => {
		try {
			await publishMaintenance.mutateAsync({
				maintenanceId: maintenance.id,
				published: !maintenance.published,
				visibility: !maintenance.published ? "public" : undefined,
			});
			await router.replace(router.asPath);
		} catch {
			// Surfaced through the mutation's onError toast.
		}
	};

	return (
		<div className="rounded-lg border p-4">
			<div className="flex flex-wrap items-start justify-between gap-2">
				<div className="space-y-1">
					<div className="flex flex-wrap items-center gap-2">
						<span className="font-medium">{maintenance.title}</span>
						<MaintenanceStateBadge state={maintenance.state} />
						<PublicationBadge
							published={maintenance.published}
							visibility={maintenance.visibility}
						/>
					</div>
					<p className="text-xs text-muted-foreground">
						{formatWindow(
							maintenance.startAt,
							maintenance.endAt,
							maintenance.timeZone,
						)}
						{affectedNames.length > 0
							? ` — affects ${affectedNames.join(", ")}`
							: ""}
					</p>
				</div>
				<div className="flex flex-wrap items-center gap-2">
					<Dialog open={stateOpen} onOpenChange={setStateOpen}>
						<DialogTrigger asChild>
							<Button
								variant="outline"
								size="sm"
								disabled={isTerminal || setStateMutation.isPending}
							>
								Change State
							</Button>
						</DialogTrigger>
						<DialogContent>
							<DialogHeader>
								<DialogTitle>Change the state</DialogTitle>
								<DialogDescription>
									Completion and cancellation are final.
								</DialogDescription>
							</DialogHeader>
							<Select
								onValueChange={(value) =>
									setState(value as MaintenanceState)
								}
								value={state}
							>
								<SelectTrigger className="w-full">
									<SelectValue placeholder="New state" />
								</SelectTrigger>
								<SelectContent>
									{OPEN_STATES.map((option) => (
										<SelectItem key={option.value} value={option.value}>
											{option.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							<DialogFooter>
								<Button
									variant="outline"
									onClick={() => setStateOpen(false)}
								>
									Cancel
								</Button>
								<Button onClick={changeState}>
									{setStateMutation.isPending ? "Saving..." : "Save"}
								</Button>
							</DialogFooter>
						</DialogContent>
					</Dialog>
					<Button
						variant={maintenance.published ? "outline" : "default"}
						size="sm"
						disabled={publishMaintenance.isPending}
						onClick={togglePublication}
					>
						{maintenance.published ? "Withdraw" : "Publish"}
					</Button>
					{maintenance.published ? null : (
						<AlertDialog>
							<AlertDialogTrigger asChild>
								<Button
									variant="outline"
									size="sm"
									disabled={deleteMaintenance.isPending}
								>
									<Trash2Icon className="h-4 w-4" />
								</Button>
							</AlertDialogTrigger>
							<AlertDialogContent>
								<AlertDialogHeader>
									<AlertDialogTitle>Delete this maintenance?</AlertDialogTitle>
									<AlertDialogDescription>
										This window has never been published; deleting it removes
										it for good.
									</AlertDialogDescription>
								</AlertDialogHeader>
								<AlertDialogFooter>
									<AlertDialogCancel>Cancel</AlertDialogCancel>
									<AlertDialogAction
										onClick={async () => {
											try {
												await deleteMaintenance.mutateAsync({
													maintenanceId: maintenance.id,
												});
												await router.replace(router.asPath);
											} catch {
												// Surfaced through the mutation's onError toast.
											}
										}}
									>
										Delete
									</AlertDialogAction>
								</AlertDialogFooter>
							</AlertDialogContent>
						</AlertDialog>
					)}
				</div>
			</div>
			{maintenance.description ? (
				<p className="mt-2 text-sm text-muted-foreground">
					{maintenance.description}
				</p>
			) : null}
		</div>
	);
};
