import {
	Boxes,
	Copy,
	Fingerprint,
	Loader2,
	ScanSearch,
	Search,
	Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { DialogAction } from "@/components/shared/dialog-action";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/utils/api";
import { RegistryCapabilityMatrix } from "./registry-capability-matrix";
import { registryHealthLabels } from "./registry-provider-meta";

interface Props {
	registryId: string;
	registryName: string;
	/** Project / owner configured on the registry, used to prefill a lookup. */
	namespace?: string | null;
	canDelete: boolean;
}

/**
 * Turns what the user pasted into a repository reference.
 *
 * `ghcr.io/acme/api:1.2` and `acme/api:1.2` both mean the repository `acme/api`
 * with the tag `1.2`: the registry host is already known here, and the tag is
 * selected once the tag list arrives.
 */
const parseRepositoryInput = (value: string) => {
	const trimmed = value.trim().replace(/^https?:\/\//i, "");
	const withoutHost = (() => {
		const firstSlash = trimmed.indexOf("/");
		if (firstSlash <= 0) return trimmed;
		const head = trimmed.slice(0, firstSlash);
		return head.includes(".") || head.includes(":")
			? trimmed.slice(firstSlash + 1)
			: trimmed;
	})();
	const [repository = "", tag] = withoutHost.split(":");
	return {
		repository: repository.replace(/^\/+|\/+$/g, ""),
		tag: tag || null,
	};
};

/**
 * Registry inspector.
 *
 * Repository, tag, manifest and digest are distinct objects in the OCI model, so
 * the dialog walks them in that order. A repository can always be opened by
 * name: the OCI catalogue (`/v2/_catalog`) is optional, and registries such as
 * GHCR never expose it, so browsing only the catalogue would make their images
 * unreachable from the Console.
 */
export const RegistryInspectDialog = ({
	registryId,
	registryName,
	namespace,
	canDelete,
}: Props) => {
	const [open, setOpen] = useState(false);
	const [search, setSearch] = useState("");
	const [lookup, setLookup] = useState(namespace ? `${namespace}/` : "");
	const [repository, setRepository] = useState<string | null>(null);
	const [reference, setReference] = useState<string | null>(null);

	const { data: health } = api.registry.health.useQuery(
		{ registryId },
		{ enabled: open, retry: false, refetchOnWindowFocus: false },
	);
	const {
		data: repositories,
		isPending: isLoadingRepositories,
		error: repositoriesError,
	} = api.registry.listRepositories.useQuery(
		{ registryId },
		{ enabled: open, retry: false, refetchOnWindowFocus: false },
	);
	const {
		data: tags,
		isPending: isLoadingTags,
		error: tagsError,
	} = api.registry.listTags.useQuery(
		{ registryId, repository: repository ?? "" },
		{ enabled: open && !!repository, retry: false },
	);
	const { data: manifest, isPending: isLoadingManifest } =
		api.registry.getManifest.useQuery(
			{ registryId, repository: repository ?? "", reference: reference ?? "" },
			{ enabled: open && !!repository && !!reference, retry: false },
		);
	const { mutateAsync: deleteImage } = api.registry.deleteImage.useMutation();

	const catalogued = useMemo(
		() => (repositories ?? []).map((entry) => entry.name),
		[repositories],
	);
	// A repository opened by name is shown even when the registry has no
	// (readable) catalogue, so what the user typed is always visible.
	const knownRepositories = useMemo(() => {
		const names = new Set(catalogued);
		if (repository) names.add(repository);
		return [...names].sort();
	}, [catalogued, repository]);

	const filteredRepositories = knownRepositories.filter((name) =>
		name.toLowerCase().includes(search.trim().toLowerCase()),
	);

	const openRepository = (name: string, tag: string | null = null) => {
		setRepository(name);
		setReference(tag);
	};

	const submitLookup = () => {
		const parsed = parseRepositoryInput(lookup);
		if (!parsed.repository) return;
		openRepository(parsed.repository, parsed.tag);
	};

	const copyDigest = async (digest: string) => {
		await navigator.clipboard.writeText(digest);
		toast.success("Digest copied");
	};

	const removeImage = async (digest: string) => {
		if (!repository) return;
		await deleteImage({ registryId, repository, digest })
			.then(() => {
				toast.success(`Deleted ${repository}@${digest}`);
			})
			.catch((error) => {
				toast.error(
					error instanceof Error ? error.message : "Error deleting the image",
				);
			});
	};

	return (
		<Dialog
			open={open}
			onOpenChange={(next) => {
				setOpen(next);
				if (!next) {
					setRepository(null);
					setReference(null);
					setSearch("");
				}
			}}
		>
			<DialogTrigger asChild>
				<Button
					variant="ghost"
					size="icon"
					className="text-muted-foreground"
					title="Inspect registry"
				>
					<ScanSearch className="size-4" />
					<span className="sr-only">Inspect registry</span>
				</Button>
			</DialogTrigger>

			<DialogContent className="max-h-[85vh] sm:max-w-4xl">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<Boxes className="size-5" />
						{registryName}
					</DialogTitle>
					<DialogDescription>
						Name a repository to list its tags and resolve the digest behind one
						— that is what an application can be pinned to. The catalogue is
						listed when the registry exposes one.
					</DialogDescription>
				</DialogHeader>

				<Tabs defaultValue="repositories">
					<TabsList>
						<TabsTrigger value="repositories">Repositories</TabsTrigger>
						<TabsTrigger value="capabilities">Capabilities</TabsTrigger>
					</TabsList>

					<TabsContent value="repositories" className="pt-4">
						<div className="grid gap-4 md:grid-cols-[minmax(0,18rem)_1fr]">
							<div className="flex flex-col gap-2">
								<form
									className="flex gap-2"
									onSubmit={(event) => {
										event.preventDefault();
										submitLookup();
									}}
								>
									<Input
										value={lookup}
										onChange={(event) => setLookup(event.target.value)}
										placeholder={
											namespace ? `${namespace}/image` : "owner/image"
										}
										aria-label="Repository to inspect"
									/>
									<Button
										type="submit"
										size="icon"
										aria-label="Inspect repository"
									>
										<Search className="size-4" />
									</Button>
								</form>

								<Input
									placeholder="Filter listed repositories"
									value={search}
									onChange={(event) => setSearch(event.target.value)}
									disabled={knownRepositories.length === 0}
								/>

								<ScrollArea className="h-[38vh] rounded-lg border">
									{isLoadingRepositories ? (
										<div className="flex items-center justify-center gap-2 p-4 text-sm text-muted-foreground">
											<Loader2 className="size-4 animate-spin" />
											Loading catalogue
										</div>
									) : filteredRepositories.length === 0 ? (
										<p className="p-4 text-sm text-muted-foreground">
											{repositoriesError
												? "This registry does not expose a readable catalogue. Enter a repository name above to inspect it."
												: "No repository matches this filter."}
										</p>
									) : (
										<ul className="flex flex-col p-1">
											{filteredRepositories.map((name) => (
												<li key={name}>
													<button
														type="button"
														onClick={() => openRepository(name)}
														className={`w-full truncate rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
															repository === name
																? "bg-muted font-medium"
																: "hover:bg-muted/60"
														}`}
													>
														{name}
													</button>
												</li>
											))}
										</ul>
									)}
								</ScrollArea>
							</div>

							<div className="flex min-w-0 flex-col gap-3">
								{!repository ? (
									<div className="flex h-[45vh] flex-col items-center justify-center gap-2 rounded-lg border px-6 text-center text-sm text-muted-foreground">
										<Boxes className="size-6" />
										<span>
											Enter a repository{namespace ? ` under ${namespace}` : ""}{" "}
											to list its tags and digests.
										</span>
									</div>
								) : (
									<>
										<div className="flex items-center justify-between gap-2">
											<span className="truncate text-sm font-medium">
												{repository}
											</span>
											<Button
												variant="ghost"
												size="sm"
												onClick={() => setReference(null)}
											>
												Clear selection
											</Button>
										</div>

										{isLoadingTags ? (
											<div className="flex items-center gap-2 text-sm text-muted-foreground">
												<Loader2 className="size-4 animate-spin" />
												Loading tags
											</div>
										) : tagsError ? (
											<p className="text-sm text-muted-foreground">
												{tagsError.message}
											</p>
										) : (tags ?? []).length === 0 ? (
											<span className="text-sm text-muted-foreground">
												No tag reported for this repository.
											</span>
										) : (
											<div className="flex flex-wrap gap-2">
												{tags?.map((tag) => (
													<Button
														key={tag.tag}
														size="sm"
														variant={
															reference === tag.tag ? "secondary" : "outline"
														}
														onClick={() => setReference(tag.tag)}
													>
														{tag.tag}
													</Button>
												))}
											</div>
										)}

										{reference &&
											(isLoadingManifest ? (
												<div className="flex items-center gap-2 text-sm text-muted-foreground">
													<Loader2 className="size-4 animate-spin" />
													Resolving {reference}
												</div>
											) : manifest ? (
												<div className="flex flex-col gap-2 rounded-lg border p-3">
													<div className="flex flex-wrap items-center gap-2 text-xs">
														<Fingerprint className="size-3.5" />
														<code className="truncate">
															{repository}@{manifest.digest}
														</code>
														<Button
															variant="ghost"
															size="icon"
															className="size-6"
															onClick={() => void copyDigest(manifest.digest)}
														>
															<Copy className="size-3.5" />
															<span className="sr-only">Copy digest</span>
														</Button>
														{canDelete && (
															<DialogAction
																title="Delete image"
																description={`Deleting ${repository}@${manifest.digest} removes the artifact this digest points to. Tags still referencing it will stop resolving. Are you sure?`}
																type="destructive"
																onClick={() => removeImage(manifest.digest)}
															>
																<Button
																	variant="ghost"
																	size="icon"
																	className="size-6 text-muted-foreground hover:bg-red-500/10 hover:text-red-500"
																>
																	<Trash2 className="size-3.5" />
																	<span className="sr-only">Delete image</span>
																</Button>
															</DialogAction>
														)}
													</div>
													<div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
														<span>
															{manifest.mediaType ?? "unknown media type"}
														</span>
														{manifest.sizeBytes != null && (
															<span>{manifest.sizeBytes} bytes</span>
														)}
													</div>
													<ScrollArea className="h-40 rounded-md bg-muted/40">
														<pre className="p-2 text-[11px] leading-relaxed">
															{JSON.stringify(manifest.raw, null, 2)}
														</pre>
													</ScrollArea>
												</div>
											) : null)}
									</>
								)}
							</div>
						</div>
					</TabsContent>

					<TabsContent
						value="capabilities"
						className="flex flex-col gap-3 pt-4"
					>
						<div className="flex flex-col gap-1">
							<span className="text-sm font-medium">
								{health ? registryHealthLabels[health.status] : "Unknown"}
							</span>
							<span className="text-xs text-muted-foreground">
								{health?.message ??
									"Capabilities are read from the provider and confirmed against the endpoint."}
							</span>
							{health?.remediation && (
								<span className="text-xs text-muted-foreground">
									{health.remediation}
								</span>
							)}
							{health?.identity && (
								<span className="text-xs text-muted-foreground">
									{health.identity.endpoint}
									{health.identity.apiVersion
										? ` · OCI API ${health.identity.apiVersion}`
										: ""}
									{health.identity.authenticated
										? " · authenticated"
										: " · anonymous"}
								</span>
							)}
						</div>
						<RegistryCapabilityMatrix
							capabilities={health?.capabilities ?? {}}
						/>
					</TabsContent>
				</Tabs>
			</DialogContent>
		</Dialog>
	);
};
