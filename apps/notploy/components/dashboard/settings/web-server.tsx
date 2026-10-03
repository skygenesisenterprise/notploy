import {
	Activity,
	ArrowUpRight,
	CheckCircle2,
	CircleAlert,
	Clock3,
	Database,
	Globe2,
	HeartPulse,
	LockKeyhole,
	RefreshCw,
	RotateCw,
	Server,
	Shield,
	Waypoints,
	XCircle,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { DialogAction } from "@/components/shared/dialog-action";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/utils/api";
import { useUrl } from "@/utils/hooks/use-url";
import { WebDomain } from "./web-domain";

function formatUptime(totalSeconds: number) {
	const days = Math.floor(totalSeconds / 86_400);
	const hours = Math.floor((totalSeconds % 86_400) / 3_600);
	const minutes = Math.floor((totalSeconds % 3_600) / 60);
	return (
		[
			days ? `${days}d` : null,
			hours ? `${hours}h` : null,
			!days && minutes ? `${minutes}m` : null,
		]
			.filter(Boolean)
			.join(" ") || "Less than a minute"
	);
}

function Status({
	label,
	state,
}: {
	label: string;
	state: "healthy" | "unhealthy" | "pending" | "unknown";
}) {
	const Icon =
		state === "healthy"
			? CheckCircle2
			: state === "unhealthy"
				? XCircle
				: state === "pending"
					? RefreshCw
					: CircleAlert;
	const color =
		state === "healthy"
			? "text-emerald-600 dark:text-emerald-400"
			: state === "unhealthy"
				? "text-destructive"
				: "text-muted-foreground";

	return (
		<span className="inline-flex items-center gap-2">
			<Icon
				className={`size-4 shrink-0 ${color} ${state === "pending" ? "animate-spin" : ""}`}
				aria-hidden
			/>
			<span>{label}</span>
		</span>
	);
}

function RuntimeFact({ label, value }: { label: string; value: string }) {
	return (
		<div className="min-w-0 space-y-1">
			<p className="text-xs text-muted-foreground">{label}</p>
			<p className="break-words text-sm font-medium">{value}</p>
		</div>
	);
}

export const WebServer = () => {
	const utils = api.useUtils();
	const baseUrl = useUrl();
	const [isRestarting, setIsRestarting] = useState(false);
	const {
		data: runtime,
		isPending: isRuntimePending,
		isError: isRuntimeError,
		error: runtimeError,
	} = api.settings.getControlPlaneRuntime.useQuery();
	const {
		data: databaseHealth,
		isPending: isDatabasePending,
		isError: isDatabaseError,
		refetch: refetchDatabaseHealth,
	} = api.settings.health.useQuery();
	const {
		data: infrastructureHealth,
		isPending: isInfrastructurePending,
		isError: isInfrastructureError,
		refetch: refetchInfrastructureHealth,
	} = api.settings.checkInfrastructureHealth.useQuery();
	const {
		data: trustedOrigins = [],
		isPending: areOriginsPending,
		isError: areOriginsError,
	} = api.sso.getTrustedOrigins.useQuery();
	const {
		data: currentUser,
		isPending: isAuthPending,
		isError: isAuthError,
	} = api.user.get.useQuery();
	const { mutateAsync: reloadServer } = api.settings.reloadServer.useMutation();

	const publicUrl = useMemo(() => {
		if (!runtime?.host) return baseUrl;
		return `${runtime.https ? "https" : "http"}://${runtime.host}`;
	}, [baseUrl, runtime?.host, runtime?.https]);

	const handleRefresh = async () => {
		await Promise.all([
			utils.settings.getControlPlaneRuntime.invalidate(),
			refetchDatabaseHealth(),
			refetchInfrastructureHealth(),
			utils.sso.getTrustedOrigins.invalidate(),
			utils.user.get.invalidate(),
		]);
	};

	const handleRestart = async () => {
		setIsRestarting(true);
		try {
			await reloadServer();
			await new Promise((resolve) => setTimeout(resolve, 5_000));

			let recovered = false;
			for (let attempt = 0; attempt < 30; attempt++) {
				try {
					const response = await fetch("/api/health", { cache: "no-store" });
					if (response.ok) {
						recovered = true;
						break;
					}
				} catch {
					// The control plane is expected to be temporarily unreachable while restarting.
				}
				await new Promise((resolve) => setTimeout(resolve, 2_000));
			}

			if (!recovered) {
				toast.error(
					"Restart was requested, but the control plane did not respond within 60 seconds.",
				);
				return;
			}

			toast.success("Web Server restarted and is responding.");
			await handleRefresh();
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: "Unable to restart the Web Server",
			);
		} finally {
			setIsRestarting(false);
		}
	};

	const webServerState = isRuntimePending
		? "pending"
		: isRuntimeError
			? "unhealthy"
			: "healthy";
	const databaseState = isDatabasePending
		? "pending"
		: isDatabaseError || databaseHealth?.status !== "ok"
			? "unhealthy"
			: "healthy";
	const authState = isAuthPending
		? "pending"
		: isAuthError || !currentUser
			? "unhealthy"
			: "healthy";
	const proxyState = isInfrastructurePending
		? "pending"
		: isInfrastructureError
			? "unknown"
			: infrastructureHealth?.traefik.status === "healthy"
				? "healthy"
				: "unhealthy";

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
					<div className="flex flex-wrap items-center gap-3">
						<Badge
							variant={webServerState === "healthy" ? "green" : "outline"}
							className="gap-1.5"
						>
							<Status
								label={
									webServerState === "healthy"
										? "Running"
										: webServerState === "pending"
											? "Checking"
											: "Unavailable"
								}
								state={webServerState}
							/>
						</Badge>
						{publicUrl && (
							<a
								href={publicUrl}
								className="max-w-full break-all text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
							>
								{publicUrl}
							</a>
						)}
						<Button
							variant="outline"
							size="sm"
							onClick={() => void handleRefresh()}
							disabled={
								isRuntimePending || isDatabasePending || isInfrastructurePending
							}
						>
							<RefreshCw className="mr-2 size-4" />
							Refresh
						</Button>
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
							onClick={() => void handleRefresh()}
						>
							Try again
						</Button>
					</div>
				) : (
					<>
						<section className="space-y-3">
							<div className="flex items-center gap-2">
								<Server className="size-5 text-muted-foreground" aria-hidden />
								<h2 className="text-lg font-semibold">Runtime</h2>
							</div>
							<div className="grid gap-4 rounded-md border p-4 sm:grid-cols-2 lg:grid-cols-4">
								<RuntimeFact
									label="Status"
									value={isRuntimeError ? "Unavailable" : "Running"}
								/>
								<RuntimeFact
									label="Public endpoint"
									value={publicUrl || "Unavailable"}
								/>
								<RuntimeFact
									label="Version"
									value={runtime.version || "Unavailable"}
								/>
								<RuntimeFact
									label="Process uptime"
									value={formatUptime(runtime.uptimeSeconds)}
								/>
							</div>
						</section>

						<section className="space-y-3">
							<div className="flex items-center gap-2">
								<Waypoints
									className="size-5 text-muted-foreground"
									aria-hidden
								/>
								<h2 className="text-lg font-semibold">Listener</h2>
							</div>
							<div className="grid gap-4 rounded-md border p-4 sm:grid-cols-2 lg:grid-cols-4">
								<RuntimeFact label="Bind address" value={runtime.bindAddress} />
								<RuntimeFact
									label="HTTP port"
									value={String(runtime.httpPort)}
								/>
								<RuntimeFact label="HTTPS listener" value="Not exposed" />
								<RuntimeFact label="Protocol" value="HTTP" />
								<p className="text-xs text-muted-foreground sm:col-span-2 lg:col-span-4">
									The listener is configured by the HOST and PORT environment
									variables and requires a container restart to change. Public
									HTTPS is configured at the instance ingress below.
								</p>
							</div>
						</section>

						<WebDomain />

						<div className="grid gap-4 xl:grid-cols-2">
							<Card className="bg-transparent shadow-none">
								<CardHeader className="pb-3">
									<CardTitle className="flex items-center gap-2 text-lg">
										<LockKeyhole
											className="size-5 text-muted-foreground"
											aria-hidden
										/>
										TLS
									</CardTitle>
									<CardDescription>
										TLS is terminated at the instance ingress, not by the
										Notploy HTTP listener.
									</CardDescription>
								</CardHeader>
								<CardContent className="space-y-4 border-t pt-4">
									<div className="grid gap-4 sm:grid-cols-2">
										<RuntimeFact
											label="HTTPS routing"
											value={runtime.https ? "Configured" : "Not configured"}
										/>
										<RuntimeFact
											label="Certificate provider"
											value={
												runtime.certificateType === "none"
													? "Not configured"
													: runtime.certificateType === "letsencrypt"
														? "Let's Encrypt"
														: "Custom"
											}
										/>
										<RuntimeFact
											label="Certificate status"
											value="Unavailable from current runtime"
										/>
										<RuntimeFact
											label="Certificate expiration"
											value="Unavailable from current runtime"
										/>
									</div>
									<Button variant="outline" size="sm" asChild>
										<Link href="/dashboard/settings/certificates">
											Manage certificates
											<ArrowUpRight className="ml-2 size-4" />
										</Link>
									</Button>
								</CardContent>
							</Card>

							<Card className="bg-transparent shadow-none">
								<CardHeader className="pb-3">
									<CardTitle className="flex items-center gap-2 text-lg">
										<Activity
											className="size-5 text-muted-foreground"
											aria-hidden
										/>
										API
									</CardTitle>
									<CardDescription>
										Control plane API endpoint and documentation.
									</CardDescription>
								</CardHeader>
								<CardContent className="space-y-4 border-t pt-4">
									<div className="grid gap-4 sm:grid-cols-2">
										<RuntimeFact
											label="Endpoint"
											value={publicUrl ? `${publicUrl}/api` : "Unavailable"}
										/>
										<RuntimeFact label="API status" value="Responding" />
										<RuntimeFact label="API version" value={runtime.version} />
									</div>
									<Button variant="outline" size="sm" asChild>
										<Link href="/swagger">
											Open API documentation
											<ArrowUpRight className="ml-2 size-4" />
										</Link>
									</Button>
								</CardContent>
							</Card>
						</div>

						<section className="space-y-3">
							<div className="flex items-center gap-2">
								<Shield className="size-5 text-muted-foreground" aria-hidden />
								<h2 className="text-lg font-semibold">Security and access</h2>
							</div>
							<div className="space-y-3 rounded-md border p-4">
								<div className="flex flex-wrap items-center justify-between gap-2">
									<div>
										<p className="text-sm font-medium">Trusted origins</p>
										<p className="text-xs text-muted-foreground">
											Authentication origins only; these are not CORS or
											trusted-proxy settings.
										</p>
									</div>
									<Button variant="outline" size="sm" asChild>
										<Link href="/dashboard/settings/sso">
											Manage in SSO settings
										</Link>
									</Button>
								</div>
								{areOriginsPending ? (
									<Skeleton className="h-10 w-full" />
								) : areOriginsError ? (
									<p className="text-sm text-muted-foreground">
										Trusted origins are unavailable.
									</p>
								) : trustedOrigins.length ? (
									<ul className="divide-y rounded-md border">
										{trustedOrigins.map((origin) => (
											<li
												key={origin}
												className="break-all px-3 py-2 font-mono text-sm"
											>
												{origin}
											</li>
										))}
									</ul>
								) : (
									<p className="text-sm text-muted-foreground">
										No trusted origins are configured.
									</p>
								)}
								<div className="grid gap-4 border-t pt-3 sm:grid-cols-2">
									<RuntimeFact
										label="Trusted proxies"
										value="Not configurable through Notploy"
									/>
									<RuntimeFact
										label="CORS"
										value="No separate CORS configuration exposed"
									/>
								</div>
							</div>
						</section>

						<section className="space-y-3">
							<div className="flex items-center justify-between gap-3">
								<div className="flex items-center gap-2">
									<HeartPulse
										className="size-5 text-muted-foreground"
										aria-hidden
									/>
									<h2 className="text-lg font-semibold">Diagnostics</h2>
								</div>
								<Button
									variant="outline"
									size="sm"
									onClick={() => void handleRefresh()}
								>
									<RefreshCw className="mr-2 size-4" />
									Run diagnostics
								</Button>
							</div>
							<div className="divide-y rounded-md border">
								<DiagnosticRow
									icon={Server}
									name="Web Server"
									state={webServerState}
									detail={
										webServerState === "healthy"
											? "Control plane runtime information is responding."
											: "The control plane runtime could not be queried."
									}
								/>
								<DiagnosticRow
									icon={Activity}
									name="API"
									state={webServerState}
									detail={
										webServerState === "healthy"
											? "The authenticated API is responding."
											: "The API health endpoint is unavailable."
									}
								/>
								<DiagnosticRow
									icon={Database}
									name="Database"
									state={databaseState}
									detail={
										isDatabaseError
											? "Unable to verify the database connection."
											: databaseHealth?.status === "ok"
												? "Database query completed successfully."
												: "Database health is unavailable."
									}
								/>
								<DiagnosticRow
									icon={LockKeyhole}
									name="Authentication"
									state={authState}
									detail={
										authState === "healthy"
											? "The current administrator session is valid."
											: "The current authentication session could not be verified."
									}
								/>
								<DiagnosticRow
									icon={Globe2}
									name="Instance ingress"
									state={proxyState}
									detail={
										isInfrastructureError
											? "Ingress health could not be checked."
											: infrastructureHealth?.traefik.message ||
												(infrastructureHealth?.traefik.status === "healthy"
													? "Ingress container health check passed."
													: "Ingress is not healthy.")
									}
								/>
								<DiagnosticRow
									icon={LockKeyhole}
									name="TLS certificate"
									state="unknown"
									detail="Certificate validity is not exposed by the current runtime."
								/>
							</div>
						</section>

						<section className="space-y-3 rounded-md border border-destructive/40 p-4">
							<div className="space-y-1">
								<h2 className="flex items-center gap-2 text-lg font-semibold">
									<RotateCw className="size-5 text-destructive" aria-hidden />
									Danger zone
								</h2>
								<p className="text-sm text-muted-foreground">
									Restart the Notploy control plane. The web interface and API
									will be temporarily unavailable.
								</p>
							</div>
							<DialogAction
								title="Restart Web Server?"
								description="This restarts the Notploy control plane and can make the UI and API unavailable for a short time. Continue only if you can reconnect to this instance afterward."
								type="destructive"
								disabled={isRestarting}
								onClick={handleRestart}
							>
								<Button variant="destructive" disabled={isRestarting}>
									<RotateCw
										className={`mr-2 size-4 ${isRestarting ? "animate-spin" : ""}`}
									/>
									{isRestarting ? "Restarting..." : "Restart Web Server"}
								</Button>
							</DialogAction>
						</section>
					</>
				)}
			</div>
		</Card>
	);
};

function DiagnosticRow({
	icon: Icon,
	name,
	state,
	detail,
}: {
	icon: typeof Server;
	name: string;
	state: "healthy" | "unhealthy" | "pending" | "unknown";
	detail: string;
}) {
	return (
		<div className="flex flex-col gap-1 p-3 sm:flex-row sm:items-center sm:gap-4">
			<div className="flex min-w-40 items-center gap-2">
				<Icon className="size-4 text-muted-foreground" aria-hidden />
				<span className="text-sm font-medium">{name}</span>
			</div>
			<p className="flex-1 text-sm text-muted-foreground">{detail}</p>
			<Status
				label={
					state === "healthy"
						? "Healthy"
						: state === "unhealthy"
							? "Unavailable"
							: state === "pending"
								? "Checking"
								: "Unknown"
				}
				state={state}
			/>
		</div>
	);
}
