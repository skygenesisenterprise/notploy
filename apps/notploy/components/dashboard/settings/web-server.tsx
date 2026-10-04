import { CircleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/utils/api";
import { ShowNotployActions } from "./servers/actions/show-notploy-actions";
import { ShowStorageActions } from "./servers/actions/show-storage-actions";
import { ShowTraefikActions } from "./servers/actions/show-traefik-actions";
import { ToggleDockerCleanup } from "./servers/actions/toggle-docker-cleanup";
import { WebDomain } from "./web-domain";
import { UpdateServer } from "./web-server/update-server";

export const WebServer = () => {
	const {
		data: runtime,
		isPending: isRuntimePending,
		isError: isRuntimeError,
		error: runtimeError,
		refetch: refetchRuntime,
	} = api.settings.getControlPlaneRuntime.useQuery();

	return (
		<Card className="min-h-[85vh] w-full rounded-xl bg-sidebar p-2.5">
			<div className="flex h-full min-h-[calc(85vh-1.25rem)] flex-col gap-6 rounded-xl bg-background p-4 shadow-md sm:p-6">
				<header className="flex flex-wrap items-center justify-between gap-3">
					<div className="space-y-1">
						<h1 className="text-3xl font-semibold tracking-tight">
							Web Server
						</h1>
						<p className="text-sm text-muted-foreground">
							Configure how this Notploy instance exposes its web interface and
							API.
						</p>
					</div>
				</header>

				{isRuntimePending ? (
					<div className="space-y-4">
						<Skeleton className="h-36 w-full" />
						<Skeleton className="h-64 w-full" />
						<Skeleton className="h-48 w-full" />
					</div>
				) : isRuntimeError || !runtime ? (
					<div
						role="alert"
						className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-md border p-6 text-center"
					>
						<CircleAlert className="size-7 text-destructive" aria-hidden />
						<p className="text-sm text-destructive">
							Unable to load Web Server runtime information
							{runtimeError?.message ? `: ${runtimeError.message}` : "."}
						</p>
						<Button
							variant="outline"
							size="sm"
							onClick={() => void refetchRuntime()}
						>
							Try again
						</Button>
					</div>
				) : (
					<>
						<WebDomain />
						<div className="grid gap-4 md:grid-cols-2">
							<ShowNotployActions />
							<ShowTraefikActions />
							<ShowStorageActions />
							<UpdateServer />
						</div>
						<div className="flex flex-wrap items-center justify-between gap-4">
							<ToggleDockerCleanup />
						</div>
					</>
				)}
			</div>
		</Card>
	);
};
