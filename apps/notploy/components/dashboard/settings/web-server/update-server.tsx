import type { IUpdateStatusData } from "@notploy/server/index";
import {
	Bug,
	Download,
	Hourglass,
	Info,
	RefreshCcw,
	Server,
	Sparkles,
	Stars,
	X,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { api } from "@/utils/api";
import { ToggleAutoCheckUpdates } from "./toggle-auto-check-updates";
import { UpdateWebServer } from "./update-webserver";

interface Props {
	/** Kept for backward compatibility; the status query is authoritative. */
	updateData?: IUpdateStatusData;
	children?: React.ReactNode;
	isOpen?: boolean;
	onOpenChange?: (open: boolean) => void;
}

/**
 * Release tags are also container image tags and carry the self-hosted suffix
 * (`v1.2.3-app`); the version shown to the user is normalized without it.
 */
const displayVersion = (version: string) => version.replace(/-app$/, "");

export const UpdateServer = ({
	updateData: initialUpdateData,
	children,
	isOpen: isOpenProp,
	onOpenChange: onOpenChangeProp,
}: Props) => {
	const [updateData, setUpdateData] = useState<IUpdateStatusData | null>(
		initialUpdateData ?? null,
	);
	const [hasCheckedUpdate, setHasCheckedUpdate] = useState(
		!!initialUpdateData,
	);
	const [isChecking, setIsChecking] = useState(false);
	const { refetch: refetchUpdateStatus } =
		api.settings.getUpdateStatus.useQuery(undefined, { enabled: false });
	const { data: notployVersion } = api.settings.getNotployVersion.useQuery();
	const { data: releaseTag } = api.settings.getReleaseTag.useQuery();
	const [isOpenInternal, setIsOpenInternal] = useState(false);

	const status = updateData?.status ?? "up_to_date";
	const latestVersion = updateData?.latestNormalizedVersion ?? null;
	const isReady = status === "ready" && !!updateData?.latestVersion;
	const isWaitingForAssets = status === "waiting_for_assets";

	const handleCheckUpdates = async () => {
		setIsChecking(true);
		try {
			const { data } = await refetchUpdateStatus();
			if (data) {
				setUpdateData(data);
				if (data.status === "ready") {
					toast.success(displayVersion(data.latestNormalizedVersion ?? ""), {
						description: "New version available!",
					});
				} else if (data.status === "waiting_for_assets") {
					toast.info("Update is being prepared", {
						description:
							"A new version was released but its package is not ready yet.",
					});
				} else {
					toast.info("No updates available");
				}
			}
		} catch (error) {
			console.error("Error checking for updates:", error);
			toast.error(
				"An error occurred while checking for updates, please try again.",
			);
		} finally {
			setHasCheckedUpdate(true);
			setIsChecking(false);
		}
	};

	const isOpen = isOpenInternal || isOpenProp;
	const onOpenChange = (open: boolean) => {
		setIsOpenInternal(open);
		onOpenChangeProp?.(open);
	};

	return (
		<Dialog open={isOpen} onOpenChange={onOpenChange}>
			<DialogTrigger asChild>
				{children ? (
					children
				) : (
					<TooltipProvider delayDuration={0}>
						<Tooltip>
							<TooltipTrigger asChild>
								<Button
									variant={updateData ? "outline" : "secondary"}
									size="sm"
									onClick={() => onOpenChange?.(true)}
								>
									<Download className="h-4 w-4 shrink-0" />
									<span className="font-medium truncate group-data-[collapsible=icon]:hidden">
										{updateData ? "Update Available" : "Check for updates"}
									</span>
									{updateData && (
										<span className="absolute right-2 flex h-2 w-2 group-data-[collapsible=icon]:hidden">
											<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
											<span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
										</span>
									)}
								</Button>
							</TooltipTrigger>
							{updateData && (
								<TooltipContent side="right" sideOffset={10}>
									<p>Update Available</p>
								</TooltipContent>
							)}
						</Tooltip>
					</TooltipProvider>
				)}
			</DialogTrigger>
			<DialogContent className="max-w-lg" showCloseButton={false}>
				<div className="flex items-center gap-2 mb-8">
					<DialogTitle className="text-2xl font-semibold mr-auto">
						Web Server Update
					</DialogTitle>
					{notployVersion && (
						<div className="flex items-center gap-1.5 rounded-full px-3 py-1 bg-muted">
							<Server className="h-4 w-4 text-muted-foreground" />
							<span className="text-sm text-muted-foreground">
								{notployVersion}{" "}
								{(releaseTag === "canary" || releaseTag === "feature") &&
									`(${releaseTag})`}
							</span>
						</div>
					)}
					<DialogClose asChild>
						<Button variant="ghost" size="icon-sm" className="shrink-0">
							<X />
							<span className="sr-only">Close</span>
						</Button>
					</DialogClose>
				</div>

				{/* Initial state */}
				{!hasCheckedUpdate && (
					<div className="mb-8">
						<p className="text text-muted-foreground">
							Check for new releases and update Notploy.
							<br />
							<br />
							We recommend checking for updates regularly to ensure you have the
							latest features and security improvements.
						</p>
					</div>
				)}

				{/* Update ready to install */}
				{isReady && latestVersion && (
					<div className="mb-8">
						<div className="inline-flex items-center gap-2 rounded-lg px-3 py-2 border border-emerald-900 bg-emerald-900 dark:bg-emerald-900/40 mb-4 w-full">
							<div className="flex items-center gap-1.5">
								<Download className="h-4 w-4 text-emerald-400" />
								<span className="text font-medium text-emerald-400 ">
									New version available:
								</span>
							</div>
							<span className="text font-semibold text-emerald-300">
								{latestVersion}
							</span>
						</div>

						<div className="space-y-4 text-muted-foreground">
							<p className="text">
								A new version of the server software is available. Consider
								updating if you:
							</p>
							<ul className="space-y-3">
								<li className="flex items-start gap-2">
									<Stars className="h-5 w-5 mt-0.5 text-[#5B9DFF]" />
									<span className="text">
										Want to access the latest features and improvements
									</span>
								</li>
								<li className="flex items-start gap-2">
									<Bug className="h-5 w-5 mt-0.5 text-[#5B9DFF]" />
									<span className="text">
										Are experiencing issues that may be resolved in the new
										version
									</span>
								</li>
							</ul>
						</div>
					</div>
				)}

				{/* A newer release exists but its package is not published yet */}
				{isWaitingForAssets && (
					<div className="mb-8">
						<div className="inline-flex items-center gap-2 rounded-lg px-3 py-2 border border-amber-500/40 bg-amber-500/10 mb-4 w-full">
							<Hourglass className="h-4 w-4 text-amber-500" />
							<span className="text font-medium text-amber-600 dark:text-amber-400">
								Update detected
							</span>
							{latestVersion && (
								<span className="text font-semibold text-amber-600 dark:text-amber-400">
									{latestVersion}
								</span>
							)}
						</div>
						<p className="text text-muted-foreground">
							Version {latestVersion} has been released, but the update package
							is not ready yet. We&apos;ll check again automatically.
						</p>
					</div>
				)}

				{/* Up to date state */}
				{hasCheckedUpdate &&
					!isReady &&
					!isWaitingForAssets &&
					!isChecking && (
						<div className="mb-8">
							<div className="flex flex-col items-center gap-6 mb-6">
								<div className="rounded-full p-4 bg-emerald-400/40">
									<Sparkles className="h-8 w-8 text-emerald-400" />
								</div>
								<div className="text-center space-y-2">
									<h3 className="text-lg font-medium">
										You are using the latest version
									</h3>
									<p className="text text-muted-foreground">
										Your server is up to date with all the latest features and
										security improvements.
									</p>
								</div>
							</div>
						</div>
					)}

				{isChecking && (
					<div className="mb-8">
						<div className="flex flex-col items-center gap-6 mb-6">
							<div className="rounded-full p-4 bg-[#5B9DFF]/40 text-foreground">
								<RefreshCcw className="h-8 w-8 animate-spin" />
							</div>
							<div className="text-center space-y-2">
								<h3 className="text-lg font-medium">Checking for updates...</h3>
								<p className="text text-muted-foreground">
									Please wait while we pull the latest version information from
									GitHub.
								</p>
							</div>
						</div>
					</div>
				)}

				{isReady && (
					<div className="rounded-lg bg-[#16254D] p-4 mb-8">
						<div className="flex gap-2">
							<Info className="h-5 w-5 shrink-0 text-[#5B9DFF]" />
							<div className="text-[#5B9DFF]">
								We recommend reviewing the{" "}
								<Link
									href={
										updateData?.releaseUrl ??
										"https://github.com/skygenesisenterprise/notploy/releases"
									}
									target="_blank"
									className="text-white underline hover:text-zinc-200"
								>
									release notes
								</Link>{" "}
								for any breaking changes before updating.
							</div>
						</div>
					</div>
				)}

				<div className="flex items-center justify-between pt-2">
					<ToggleAutoCheckUpdates disabled={isChecking} />
				</div>

				<div className="flex items-center justify-end mt-4">
					<div className="flex items-center gap-2">
						<Button variant="outline" onClick={() => onOpenChange?.(false)}>
							Cancel
						</Button>
						{/* "Update now" only exists once the release is actually installable. */}
						{isReady ? (
							<UpdateWebServer buttonClassName="w-auto" />
						) : (
							<Button
								variant="secondary"
								onClick={handleCheckUpdates}
								disabled={isChecking}
							>
								{isChecking ? (
									<>
										<RefreshCcw className="h-4 w-4 animate-spin" />
										Checking for updates
									</>
								) : (
									<>
										<RefreshCcw className="h-4 w-4" />
										Check for updates
									</>
								)}
							</Button>
						)}
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
};

export default UpdateServer;