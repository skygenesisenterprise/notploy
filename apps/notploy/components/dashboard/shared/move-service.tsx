import type { ServiceType } from "@notploy/server/db/schema";
import { FolderInput } from "lucide-react";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertBlock } from "@/components/shared/alert-block";
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
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { api } from "@/utils/api";

interface Props {
	id: string;
	type: ServiceType | "application";
	currentEnvironmentId?: string;
}

const NANOCPUS_PER_CORE = 1_000_000_000;
const BYTES_PER_MIB = 1024 * 1024;

const formatMeter = (meter: string, value: number) =>
	meter === "cpuLimit" || meter === "cpuReservation"
		? `${Number((value / NANOCPUS_PER_CORE).toFixed(2))} CPU`
		: `${Number((value / BYTES_PER_MIB).toFixed(2))} MiB`;

const METER_LABELS: Record<string, string> = {
	cpuLimit: "CPU limit",
	cpuReservation: "CPU reservation",
	memoryLimit: "Memory limit",
	memoryReservation: "Memory reservation",
};

export const MoveService = ({ id, type, currentEnvironmentId }: Props) => {
	const router = useRouter();
	const utils = api.useUtils();
	const [isOpen, setIsOpen] = useState(false);
	const [targetProjectId, setTargetProjectId] = useState("");
	const [targetEnvironmentId, setTargetEnvironmentId] = useState("");

	const { data: permissions } = api.user.getPermissions.useQuery();
	const { data: projects = [] } = api.project.all.useQuery(undefined, {
		enabled: isOpen,
	});

	// Declare every mutation unconditionally to keep the hook order stable.
	const applicationMove = api.application.move.useMutation();
	const composeMove = api.compose.move.useMutation();
	const postgresMove = api.postgres.move.useMutation();
	const mysqlMove = api.mysql.move.useMutation();
	const mariadbMove = api.mariadb.move.useMutation();
	const mongoMove = api.mongo.move.useMutation();
	const redisMove = api.redis.move.useMutation();
	const libsqlMove = api.libsql.move.useMutation();

	const selectedProject = useMemo(
		() => projects.find((project) => project.projectId === targetProjectId),
		[projects, targetProjectId],
	);

	const preview = api.service.movePreview.useQuery(
		{
			serviceType: type,
			serviceId: id,
			targetEnvironmentId,
		},
		{
			enabled: isOpen && !!targetEnvironmentId,
			retry: false,
		},
	);

	useEffect(() => {
		if (!isOpen) {
			setTargetProjectId("");
			setTargetEnvironmentId("");
		}
	}, [isOpen]);

	const isSameEnvironment = targetEnvironmentId === currentEnvironmentId;
	const isPending = [
		applicationMove,
		composeMove,
		postgresMove,
		mysqlMove,
		mariadbMove,
		mongoMove,
		redisMove,
		libsqlMove,
	].some((mutation) => mutation.isPending);

	const runMove = () => {
		const target = { targetEnvironmentId };
		switch (type) {
			case "application":
				return applicationMove.mutateAsync({ applicationId: id, ...target });
			case "compose":
				return composeMove.mutateAsync({ composeId: id, ...target });
			case "postgres":
				return postgresMove.mutateAsync({ postgresId: id, ...target });
			case "mysql":
				return mysqlMove.mutateAsync({ mysqlId: id, ...target });
			case "mariadb":
				return mariadbMove.mutateAsync({ mariadbId: id, ...target });
			case "mongo":
				return mongoMove.mutateAsync({ mongoId: id, ...target });
			case "redis":
				return redisMove.mutateAsync({ redisId: id, ...target });
			case "libsql":
				return libsqlMove.mutateAsync({ libsqlId: id, ...target });
		}
	};

	const handleMove = async () => {
		if (!preview.data || isSameEnvironment) {
			return;
		}

		try {
			await runMove();
			await utils.invalidate();
			toast.success("Service moved successfully");
			setIsOpen(false);
			router.push(
				`/dashboard/project/${preview.data.target.projectId}/environment/${preview.data.target.environmentId}`,
			);
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Error moving the service",
			);
		}
	};

	if (!permissions?.service.create) {
		return null;
	}

	return (
		<Dialog open={isOpen} onOpenChange={setIsOpen}>
			<DialogTrigger asChild>
				<Button variant="ghost" size="icon" className="group">
					<FolderInput className="size-4" />
				</Button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-2xl">
				<DialogHeader>
					<DialogTitle>Move service</DialogTitle>
					<DialogDescription>
						Change the project/environment that owns this service. Only the
						ownership changes: the service keeps its identity, app name,
						volumes, domains and networks, and is not redeployed.
					</DialogDescription>
				</DialogHeader>

				<div className="grid gap-4 sm:grid-cols-2">
					<div className="space-y-2">
						<Label>Target project</Label>
						<Select
							value={targetProjectId}
							onValueChange={(value) => {
								setTargetProjectId(value);
								setTargetEnvironmentId("");
							}}
						>
							<SelectTrigger>
								<SelectValue placeholder="Select a project" />
							</SelectTrigger>
							<SelectContent>
								<SelectGroup>
									{projects.map((project) => (
										<SelectItem
											key={project.projectId}
											value={project.projectId}
										>
											{project.name}
										</SelectItem>
									))}
								</SelectGroup>
							</SelectContent>
						</Select>
					</div>

					<div className="space-y-2">
						<Label>Target environment</Label>
						<Select
							value={targetEnvironmentId}
							onValueChange={setTargetEnvironmentId}
							disabled={!selectedProject}
						>
							<SelectTrigger>
								<SelectValue placeholder="Select an environment" />
							</SelectTrigger>
							<SelectContent>
								<SelectGroup>
									{(selectedProject?.environments ?? []).map((environment) => (
										<SelectItem
											key={environment.environmentId}
											value={environment.environmentId}
										>
											{environment.name}
											{environment.environmentId === currentEnvironmentId
												? " (current)"
												: ""}
										</SelectItem>
									))}
								</SelectGroup>
							</SelectContent>
						</Select>
					</div>
				</div>

				{preview.error && (
					<AlertBlock type="error">{preview.error.message}</AlertBlock>
				)}

				{preview.data && (
					<div className="space-y-3 rounded-md border p-4 text-sm">
						<div className="grid gap-2 sm:grid-cols-2">
							<div>
								<p className="text-xs text-muted-foreground">From</p>
								<p className="font-medium">{preview.data.source.projectName}</p>
								<p className="text-muted-foreground">
									{preview.data.source.environmentName}
								</p>
							</div>
							<div>
								<p className="text-xs text-muted-foreground">To</p>
								<p className="font-medium">{preview.data.target.projectName}</p>
								<p className="text-muted-foreground">
									{preview.data.target.environmentName}
								</p>
							</div>
						</div>

						<Separator />

						<div className="flex flex-wrap gap-1.5">
							{["Identity", "App name", "Volumes", "Domains", "Networks"].map(
								(item) => (
									<Badge key={item} variant="secondary">
										{item} preserved
									</Badge>
								),
							)}
						</div>

						<p className="text-xs text-muted-foreground">
							Access is recalculated from the target project after the move. No
							redeploy is required.
						</p>

						{isSameEnvironment && (
							<AlertBlock type="info">
								This is the service&apos;s current environment. Pick another one
								to move it.
							</AlertBlock>
						)}

						{!preview.data.quota.withinQuota && (
							<AlertBlock type="warning">
								<p>
									The target project quota would be exceeded. Lower the service
									limits or raise the target project quota first.
								</p>
								<ul className="mt-2 list-disc space-y-1 pl-5">
									{preview.data.quota.violations.map((violation) => (
										<li key={violation.meter}>
											{METER_LABELS[violation.meter] ?? violation.meter}:{" "}
											{formatMeter(violation.meter, violation.total)} would be
											used for a quota of{" "}
											{formatMeter(violation.meter, violation.quota)}.
										</li>
									))}
								</ul>
							</AlertBlock>
						)}
					</div>
				)}

				<DialogFooter>
					<Button variant="outline" onClick={() => setIsOpen(false)}>
						Cancel
					</Button>
					<Button
						isLoading={isPending || preview.isFetching}
						disabled={
							!preview.data ||
							isSameEnvironment ||
							!preview.data.quota.withinQuota
						}
						onClick={handleMove}
					>
						Move service
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};
