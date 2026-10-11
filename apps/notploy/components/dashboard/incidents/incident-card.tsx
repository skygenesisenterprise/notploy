import { HistoryIcon, Loader2, Trash2Icon } from "lucide-react";
import { useRouter } from "next/router";
import * as React from "react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { Badge } from "@/components/ui/badge";
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
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/utils/api";
import type {
	AdminIncidentDto,
	AdminComponentDto,
	IncidentState,
} from "@/lib/status";
import {
	IncidentStateBadge,
	PublicationBadge,
	SeverityBadge,
} from "./status-badges";

const OPEN_STATES: Array<{ value: IncidentState; label: string }> = [
	{ value: "investigating", label: "Investigating" },
	{ value: "identified", label: "Identified" },
	{ value: "monitoring", label: "Monitoring" },
	{ value: "resolved", label: "Resolved" },
];

const formatDateTime = (value: string): string =>
	new Date(value).toLocaleString(undefined, {
		dateStyle: "medium",
		timeStyle: "short",
	});

/** Full timeline of an incident, internal entries included. */
const IncidentTimelineDialog = ({
	incidentId,
}: {
	incidentId: string;
}) => {
	const [open, setOpen] = React.useState(false);
	const { data, isLoading, error, refetch } = api.status.timeline.useQuery(
		{ incidentId },
		{ enabled: open },
	);

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button variant="outline" size="sm">
					<HistoryIcon className="h-4 w-4" />
					Timeline
				</Button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-2xl">
				<DialogHeader>
					<DialogTitle>Incident timeline</DialogTitle>
					<DialogDescription>
						Every entry recorded on the status platform, wherever it came
						from — console, status page or monitoring.
					</DialogDescription>
				</DialogHeader>
				{isLoading ? (
					<div className="flex min-h-[20vh] items-center justify-center gap-2 text-sm text-muted-foreground">
						<span>Loading...</span>
						<Loader2 className="size-4 animate-spin" />
					</div>
				) : error ? (
					<Alert variant="destructive">
						<AlertTitle>Unable to load the timeline</AlertTitle>
						<AlertDescription>{error.message}</AlertDescription>
					</Alert>
				) : !data || data.items.length === 0 ? (
					<p className="py-8 text-center text-sm text-muted-foreground">
						No timeline entry yet.
					</p>
				) : (
					<div className="max-h-[50vh] space-y-3 overflow-y-auto">
						{data.items.map((entry) => (
							<div key={entry.id} className="rounded-lg border p-3">
								<div className="flex flex-wrap items-center gap-2">
									<Badge variant="blank">
										{entry.type.replace(/_/g, " ")}
									</Badge>
									<Badge
										variant={entry.visibility === "public" ? "green" : "blank"}
									>
										{entry.visibility}
									</Badge>
									{entry.state ? (
										<span className="text-xs text-muted-foreground">
											{entry.state.replace("_", " ")}
										</span>
									) : null}
									<span className="ml-auto text-xs text-muted-foreground">
										{formatDateTime(entry.createdAt)}
									</span>
								</div>
								<p className="mt-2 text-sm">{entry.message}</p>
								<p className="mt-1 text-xs text-muted-foreground">
									by {entry.actorLabel}
								</p>
							</div>
						))}
					</div>
				)}
			</DialogContent>
		</Dialog>
	);
};

/** Append a public or internal update to the incident timeline. */
const AddUpdateDialog = ({
	incidentId,
	disabled,
}: {
	incidentId: string;
	disabled: boolean;
}) => {
	const router = useRouter();
	const [open, setOpen] = React.useState(false);
	const [message, setMessage] = React.useState("");
	const [visibility, setVisibility] = React.useState<"public" | "private">(
		"public",
	);
	const [state, setState] = React.useState<"none" | IncidentState>("none");

	const addUpdate = api.status.addIncidentUpdate.useMutation({
		onSuccess: () => {
			toast.success("Update added");
		},
		onError: (error) => {
			toast.error(error.message || "Failed to add the update");
		},
	});

	const canSubmit = message.trim().length > 0;

	const submit = async () => {
		if (!canSubmit) return;
		try {
			await addUpdate.mutateAsync({
				incidentId,
				message: message.trim(),
				visibility,
				state: state === "none" ? undefined : state,
			});
			setOpen(false);
			setMessage("");
			setState("none");
			await router.replace(router.asPath);
		} catch {
			// Surfaced through the mutation's onError toast.
		}
	};

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button variant="outline" size="sm" disabled={disabled}>
					Add Update
				</Button>
			</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Add an update</DialogTitle>
					<DialogDescription>
						Appended to the incident timeline; public updates are shown on
						the status page.
					</DialogDescription>
				</DialogHeader>
				<Textarea
					placeholder="e.g., The fix is rolling out; error rates are recovering."
					value={message}
					onChange={(event) => setMessage(event.target.value)}
				/>
				<Select
					onValueChange={(value) =>
						setVisibility(value as "public" | "private")
					}
					defaultValue="public"
				>
					<SelectTrigger className="w-full">
						<SelectValue placeholder="Visibility" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="public">Public</SelectItem>
						<SelectItem value="private">Internal</SelectItem>
					</SelectContent>
				</Select>
				<Select
					onValueChange={(value) => setState(value as "none" | IncidentState)}
					value={state}
				>
					<SelectTrigger className="w-full">
						<SelectValue placeholder="Update the state (optional)" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="none">No state change</SelectItem>
						{OPEN_STATES.map((option) => (
							<SelectItem key={option.value} value={option.value}>
								{option.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<DialogFooter>
					<Button variant="outline" onClick={() => setOpen(false)}>
						Cancel
					</Button>
					<Button
						onClick={submit}
						disabled={!canSubmit || addUpdate.isPending}
					>
						{addUpdate.isPending ? "Adding..." : "Add update"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};

/** Transition the incident state, `resolved` being terminal. */
const ChangeStateDialog = ({
	incidentId,
	disabled,
}: {
	incidentId: string;
	disabled: boolean;
}) => {
	const router = useRouter();
	const [open, setOpen] = React.useState(false);
	const [state, setState] = React.useState<IncidentState>("investigating");
	const [message, setMessage] = React.useState("");

	const setStateMutation = api.status.setIncidentState.useMutation({
		onSuccess: () => {
			toast.success("State updated");
		},
		onError: (error) => {
			toast.error(error.message || "Failed to update the state");
		},
	});

	const submit = async () => {
		try {
			await setStateMutation.mutateAsync({
				incidentId,
				state,
				message: message.trim() || undefined,
			});
			setOpen(false);
			setMessage("");
			await router.replace(router.asPath);
		} catch {
			// Surfaced through the mutation's onError toast.
		}
	};

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button variant="outline" size="sm" disabled={disabled}>
					Change State
				</Button>
			</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Change the state</DialogTitle>
					<DialogDescription>
						Resolving is final: reopening an incident means declaring a new
						one.
					</DialogDescription>
				</DialogHeader>
				<Select
					onValueChange={(value) => setState(value as IncidentState)}
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
				<Textarea
					placeholder="Optional message attached to the transition."
					value={message}
					onChange={(event) => setMessage(event.target.value)}
				/>
				<DialogFooter>
					<Button variant="outline" onClick={() => setOpen(false)}>
						Cancel
					</Button>
					<Button
						onClick={submit}
						disabled={setStateMutation.isPending}
					>
						{setStateMutation.isPending ? "Saving..." : "Save"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};

export const IncidentCard = ({
	incident,
	components,
}: {
	incident: AdminIncidentDto;
	components: AdminComponentDto[];
}) => {
	const router = useRouter();

	const publishIncident = api.status.publishIncident.useMutation({
		onSuccess: (updated) => {
			toast.success(
				updated.published ? "Incident published" : "Incident withdrawn",
			);
		},
		onError: (error) => {
			toast.error(error.message || "Failed to update the publication");
		},
	});

	const deleteIncident = api.status.deleteIncident.useMutation({
		onSuccess: () => {
			toast.success("Incident deleted");
		},
		onError: (error) => {
			toast.error(error.message || "Failed to delete the incident");
		},
	});

	const isResolved = incident.state === "resolved";
	const affectedNames = incident.componentIds
		.map((id) => components.find((component) => component.id === id)?.name)
		.filter((name): name is string => Boolean(name));

	const togglePublication = async () => {
		try {
			await publishIncident.mutateAsync({
				incidentId: incident.id,
				published: !incident.published,
				// Publishing a private draft makes it public in one gesture;
				// withdrawing keeps the visibility untouched.
				visibility: !incident.published ? "public" : undefined,
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
						<span className="font-medium">{incident.title}</span>
						<SeverityBadge severity={incident.severity} />
						<IncidentStateBadge state={incident.state} />
						<PublicationBadge
							published={incident.published}
							visibility={incident.visibility}
						/>
					</div>
					<p className="text-xs text-muted-foreground">
						Started {formatDateTime(incident.startedAt)}
						{incident.resolvedAt
							? ` — resolved ${formatDateTime(incident.resolvedAt)}`
							: ""}
						{affectedNames.length > 0
							? ` — affects ${affectedNames.join(", ")}`
							: ""}
					</p>
				</div>
				<div className="flex flex-wrap items-center gap-2">
					<IncidentTimelineDialog incidentId={incident.id} />
					<AddUpdateDialog
						incidentId={incident.id}
						disabled={isResolved}
					/>
					<ChangeStateDialog
						incidentId={incident.id}
						disabled={isResolved}
					/>
					<Button
						variant={incident.published ? "outline" : "default"}
						size="sm"
						disabled={publishIncident.isPending}
						onClick={togglePublication}
					>
						{incident.published ? "Withdraw" : "Publish"}
					</Button>
					{incident.published ? null : (
						<AlertDialog>
							<AlertDialogTrigger asChild>
								<Button
									variant="outline"
									size="sm"
									disabled={deleteIncident.isPending}
								>
									<Trash2Icon className="h-4 w-4" />
								</Button>
							</AlertDialogTrigger>
							<AlertDialogContent>
								<AlertDialogHeader>
									<AlertDialogTitle>Delete this incident?</AlertDialogTitle>
									<AlertDialogDescription>
										This draft has never been published; deleting it removes
										its timeline for good.
									</AlertDialogDescription>
								</AlertDialogHeader>
								<AlertDialogFooter>
									<AlertDialogCancel>Cancel</AlertDialogCancel>
									<AlertDialogAction
										onClick={async () => {
											try {
												await deleteIncident.mutateAsync({
													incidentId: incident.id,
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
			{incident.description ? (
				<p className="mt-2 text-sm text-muted-foreground">
					{incident.description}
				</p>
			) : null}
		</div>
	);
};
