import { ArrowLeft, HardDrive, Loader2, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { AlertBlock } from "@/components/shared/alert-block";
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
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { api } from "@/utils/api";
import { HandleObjectStorageBucket } from "./handle-object-storage-bucket";
import { objectStorageProviderLabel } from "./object-storage-meta";

interface Props {
	objectStorageProviderId: string;
}

export const ShowObjectStorageBuckets = ({
	objectStorageProviderId,
}: Props) => {
	const [removingId, setRemovingId] = useState<string | null>(null);
	const utils = api.useUtils();
	const { mutateAsync } = api.objectStorage.removeBucket.useMutation();
	const { data: permissions } = api.user.getPermissions.useQuery();
	const { data: provider } = api.objectStorage.provider.useQuery({
		objectStorageProviderId,
	});
	const {
		data: allBuckets,
		isPending,
		isError,
		error,
	} = api.objectStorage.buckets.useQuery();

	const buckets = allBuckets?.filter(
		(bucket) => bucket.objectStorageProviderId === objectStorageProviderId,
	);

	return (
		<div className="w-full">
			<Card className="h-full bg-sidebar p-2.5 rounded-xl">
				<div className="rounded-xl bg-background shadow-md">
					<div className="flex flex-wrap items-center justify-between gap-4 p-6">
						<div className="flex flex-1 flex-row items-center gap-3">
							<Button variant="ghost" size="icon" asChild>
								<Link href="/dashboard/settings/destinations">
									<ArrowLeft className="size-4" />
									<span className="sr-only">Back to object storage</span>
								</Link>
							</Button>
							<CardHeader className="flex-1 p-0">
								<CardTitle className="text-xl">
									{provider?.name ?? "Buckets"}
								</CardTitle>
								<CardDescription>
									{provider
										? `${objectStorageProviderLabel(provider.providerType)} · Buckets backups and applications can consume.`
										: "Buckets exposed by this provider."}
								</CardDescription>
							</CardHeader>
						</div>
						{permissions?.objectStorage.create && (
							<HandleObjectStorageBucket
								objectStorageProviderId={objectStorageProviderId}
							/>
						)}
					</div>

					<CardContent className="flex min-h-[60vh] flex-col gap-4 border-t py-8">
						{isError && <AlertBlock type="error">{error?.message}</AlertBlock>}
						{isPending ? (
							<div className="flex flex-1 flex-row items-center justify-center gap-2 text-sm text-muted-foreground">
								<span>Loading...</span>
								<Loader2 className="animate-spin size-4" />
							</div>
						) : (buckets?.length ?? 0) === 0 ? (
							<div className="flex min-h-[45vh] w-full flex-col items-center justify-center gap-4 rounded-lg border border-dashed p-8">
								<div className="rounded-full bg-muted p-4">
									<HardDrive className="size-10 text-muted-foreground" />
								</div>
								<div className="space-y-1 text-center">
									<p className="text-sm font-medium">No buckets yet</p>
									<p className="max-w-sm text-sm text-muted-foreground">
										Add a bucket from this provider so backups can reference it
										instead of raw credentials.
									</p>
								</div>
							</div>
						) : (
							<ul className="flex flex-col gap-2">
								{buckets?.map((bucket) => (
									<li
										key={bucket.objectStorageBucketId}
										className="group relative flex items-center gap-3 rounded-lg border bg-background px-4 py-3 transition-colors duration-150 ease-out hover:border-foreground/20 hover:bg-muted/50 focus-within:border-ring"
									>
										<HardDrive className="size-6 shrink-0 text-muted-foreground" />
										<div className="flex min-w-0 flex-col gap-0.5">
											<span className="truncate text-sm font-medium">
												{bucket.name}
											</span>
											<span className="truncate text-xs text-muted-foreground">
												{bucket.bucket}
												{bucket.region ? ` · ${bucket.region}` : ""}
											</span>
										</div>

										<div className="relative z-10 ml-auto flex flex-row items-center gap-1">
											{bucket.versioning && (
												<Badge variant="secondary">Versioned</Badge>
											)}
											{bucket.usedBy > 0 && (
												<Badge variant="outline" className="tabular-nums">
													{bucket.usedBy}{" "}
													{bucket.usedBy === 1 ? "backup" : "backups"}
												</Badge>
											)}
											{permissions?.objectStorage.update && (
												<HandleObjectStorageBucket
													objectStorageProviderId={objectStorageProviderId}
													objectStorageBucketId={bucket.objectStorageBucketId}
												/>
											)}
											{permissions?.objectStorage.delete && (
												<Tooltip>
													<DialogAction
														title="Delete Bucket"
														description="Backups that use this bucket will need to be re-pointed first. Are you sure?"
														type="destructive"
														onClick={async () => {
															setRemovingId(bucket.objectStorageBucketId);
															await mutateAsync({
																objectStorageBucketId:
																	bucket.objectStorageBucketId,
															})
																.then(() => {
																	toast.success("Bucket deleted");
																	utils.objectStorage.buckets.invalidate();
																	utils.objectStorage.providers.invalidate();
																})
																.catch(() => {
																	toast.error("Error deleting the bucket");
																})
																.finally(() => setRemovingId(null));
														}}
													>
														<TooltipTrigger asChild>
															<Button
																variant="ghost"
																size="icon"
																className="text-muted-foreground hover:bg-red-500/10 hover:text-red-500"
																isLoading={
																	removingId === bucket.objectStorageBucketId
																}
															>
																<Trash2 className="size-4" />
																<span className="sr-only">Delete bucket</span>
															</Button>
														</TooltipTrigger>
													</DialogAction>
													<TooltipContent>Delete bucket</TooltipContent>
												</Tooltip>
											)}
										</div>
									</li>
								))}
							</ul>
						)}
					</CardContent>
				</div>
			</Card>
		</div>
	);
};
