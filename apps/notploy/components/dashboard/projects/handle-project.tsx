import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";

import { PlusIcon, SquarePen } from "lucide-react";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { AlertBlock } from "@/components/shared/alert-block";
import { TagSelector } from "@/components/shared/tag-selector";
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
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/utils/api";

const quotaValue = z
	.string()
	.optional()
	.refine(
		(value) => !value || (Number.isFinite(Number(value)) && Number(value) > 0),
		{ message: "Enter a positive number" },
	);

const AddProjectSchema = z.object({
	name: z
		.string()
		.min(1, "Project name is required")
		.refine(
			(name) => {
				const trimmedName = name.trim();
				const validNameRegex =
					/^[\p{L}\p{N}_-][\p{L}\p{N}\s_.-]*[\p{L}\p{N}_-]$/u;
				return validNameRegex.test(trimmedName);
			},
			{
				message:
					"Project name must start and end with a letter, number, hyphen or underscore. Spaces are allowed in between.",
			},
		)
		.refine((name) => !/^\d/.test(name.trim()), {
			message: "Project name cannot start with a number",
		})
		.transform((name) => name.trim()),
	description: z.string().optional(),
	cpuLimit: quotaValue,
	cpuReservation: quotaValue,
	memoryLimit: quotaValue,
	memoryReservation: quotaValue,
});

const NANOCPUS_PER_CORE = 1_000_000_000;
const BYTES_PER_MIB = 1024 * 1024;

const storedToCores = (value?: string | null) =>
	value ? String(Number(value) / NANOCPUS_PER_CORE) : "";
const storedToMiB = (value?: string | null) =>
	value ? String(Number(value) / BYTES_PER_MIB) : "";

const coresToStored = (value?: string) =>
	value ? String(Math.round(Number(value) * NANOCPUS_PER_CORE)) : null;
const mibToStored = (value?: string) =>
	value ? String(Math.round(Number(value) * BYTES_PER_MIB)) : null;

const toCores = (value: number) =>
	Number((value / NANOCPUS_PER_CORE).toFixed(2));
const toMiB = (value: number) => Number((value / BYTES_PER_MIB).toFixed(2));

type AddProject = z.infer<typeof AddProjectSchema>;

interface Props {
	projectId?: string;
}

export const HandleProject = ({ projectId }: Props) => {
	const utils = api.useUtils();
	const [isOpen, setIsOpen] = useState(false);
	const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

	// Both mutations are declared unconditionally so the hook order stays
	// stable when the dialog switches between create and update mode.
	const updateProjectMutation = api.project.update.useMutation();
	const createProjectMutation = api.project.create.useMutation();
	const { mutateAsync, error, isError } = projectId
		? updateProjectMutation
		: createProjectMutation;

	const { data, refetch } = api.project.one.useQuery(
		{
			projectId: projectId || "",
		},
		{
			enabled: !!projectId,
		},
	);

	const { data: quotaData } = api.project.quota.useQuery(
		{ projectId: projectId || "" },
		{ enabled: !!projectId },
	);

	const { data: availableTags = [] } = api.tag.all.useQuery();
	const bulkAssignMutation = api.tag.bulkAssign.useMutation();

	const router = useRouter();
	const form = useForm<AddProject>({
		defaultValues: {
			description: "",
			name: "",
			cpuLimit: "",
			cpuReservation: "",
			memoryLimit: "",
			memoryReservation: "",
		},
		resolver: standardSchemaResolver(AddProjectSchema),
	});

	useEffect(() => {
		form.reset({
			description: data?.description ?? "",
			name: data?.name ?? "",
			cpuLimit: storedToCores(data?.cpuLimit),
			cpuReservation: storedToCores(data?.cpuReservation),
			memoryLimit: storedToMiB(data?.memoryLimit),
			memoryReservation: storedToMiB(data?.memoryReservation),
		});
		// Load existing tags when editing a project
		if (data?.projectTags) {
			const tagIds = data.projectTags.map((pt) => pt.tagId);
			setSelectedTagIds(tagIds);
		} else {
			setSelectedTagIds([]);
		}
	}, [form, form.reset, form.formState.isSubmitSuccessful, data]);

	const onSubmit = async (data: AddProject) => {
		await mutateAsync({
			name: data.name,
			description: data.description,
			projectId: projectId || "",
			...(projectId
				? {
						cpuLimit: coresToStored(data.cpuLimit),
						cpuReservation: coresToStored(data.cpuReservation),
						memoryLimit: mibToStored(data.memoryLimit),
						memoryReservation: mibToStored(data.memoryReservation),
					}
				: {}),
		})
			.then(async (data) => {
				// Assign tags to the project (both create and update)
				const projectIdToUse =
					projectId ||
					(data && "project" in data ? data.project.projectId : undefined);

				if (projectIdToUse) {
					try {
						await bulkAssignMutation.mutateAsync({
							projectId: projectIdToUse,
							tagIds: selectedTagIds,
						});
					} catch (error) {
						toast.error("Failed to assign tags to project");
					}
				}

				await utils.project.all.invalidate();
				if (projectId) {
					await utils.project.quota.invalidate({ projectId });
				}
				toast.success(projectId ? "Project Updated" : "Project Created");
				setIsOpen(false);
				if (!projectId) {
					const environmentIdToUse =
						data && "environment" in data
							? data.environment.environmentId
							: undefined;

					if (environmentIdToUse && projectIdToUse) {
						router.push(
							`/dashboard/project/${projectIdToUse}/environment/${environmentIdToUse}`,
						);
					}
				} else {
					refetch();
				}
			})
			.catch((error: Error) => {
				toast.error(
					error.message ||
						(projectId
							? "Error updating a project"
							: "Error creating a project"),
				);
			});
	};

	return (
		<Dialog open={isOpen} onOpenChange={setIsOpen}>
			<DialogTrigger asChild>
				{projectId ? (
					<DropdownMenuItem
						className="w-full cursor-pointer space-x-3"
						onSelect={(e) => e.preventDefault()}
					>
						<SquarePen className="size-4" />
						<span>Update</span>
					</DropdownMenuItem>
				) : (
					<Button>
						<PlusIcon className="h-4 w-4" />
						Create Project
					</Button>
				)}
			</DialogTrigger>
			<DialogContent className="sm:m:max-w-lg ">
				<DialogHeader>
					<DialogTitle>{projectId ? "Update" : "Add a"} project</DialogTitle>
					<DialogDescription>The home of something big!</DialogDescription>
				</DialogHeader>
				{isError && <AlertBlock type="error">{error?.message}</AlertBlock>}
				<Form {...form}>
					<form
						id="hook-form-add-project"
						onSubmit={form.handleSubmit(onSubmit)}
						className="grid w-full gap-4"
					>
						<div className="flex flex-col gap-4">
							<FormField
								control={form.control}
								name="name"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Name</FormLabel>
										<FormControl>
											<Input placeholder="Vandelay Industries" {...field} />
										</FormControl>

										<FormMessage />
									</FormItem>
								)}
							/>
						</div>

						<FormField
							control={form.control}
							name="description"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Description</FormLabel>
									<FormControl>
										<Textarea
											placeholder="Description about your project..."
											className="resize-none"
											{...field}
										/>
									</FormControl>

									<FormMessage />
								</FormItem>
							)}
						/>

						<div className="space-y-2">
							<FormLabel>Tags</FormLabel>
							<TagSelector
								tags={availableTags.map((tag) => ({
									id: tag.tagId,
									name: tag.name,
									color: tag.color ?? undefined,
								}))}
								selectedTags={selectedTagIds}
								onTagsChange={setSelectedTagIds}
								placeholder="Select tags..."
							/>
						</div>

						{projectId && (
							<div className="space-y-3 rounded-md border p-4">
								<div className="space-y-1">
									<p className="text-sm font-medium">
										Resource quotas (logical limits)
									</p>
									<p className="text-xs text-muted-foreground">
										Notploy refuses any service change that would push the sum
										of declared limits above these caps. Docker/Swarm still
										enforce each service's own limits; services without a
										declared limit count as 0. Leave a field empty for no quota.
									</p>
								</div>

								<div className="grid gap-3 sm:grid-cols-2">
									{(
										[
											{
												name: "cpuLimit",
												label: "CPU limit (cores)",
												placeholder: "2",
											},
											{
												name: "cpuReservation",
												label: "CPU reservation (cores)",
												placeholder: "1",
											},
											{
												name: "memoryLimit",
												label: "Memory limit (MiB)",
												placeholder: "4096",
											},
											{
												name: "memoryReservation",
												label: "Memory reservation (MiB)",
												placeholder: "2048",
											},
										] as const
									).map((quotaField) => (
										<FormField
											key={quotaField.name}
											control={form.control}
											name={quotaField.name}
											render={({ field }) => (
												<FormItem>
													<FormLabel>{quotaField.label}</FormLabel>
													<FormControl>
														<Input
															type="number"
															min={0}
															step="any"
															placeholder={quotaField.placeholder}
															value={field.value ?? ""}
															onChange={field.onChange}
														/>
													</FormControl>
													<FormMessage />
												</FormItem>
											)}
										/>
									))}
								</div>

								{quotaData && (
									<p className="text-xs text-muted-foreground">
										Declared usage across services:{" "}
										{toCores(quotaData.usage.cpuLimit)} CPU limit ·{" "}
										{toCores(quotaData.usage.cpuReservation)} CPU reservation ·{" "}
										{toMiB(quotaData.usage.memoryLimit)} MiB memory limit ·{" "}
										{toMiB(quotaData.usage.memoryReservation)} MiB memory
										reservation.
									</p>
								)}
							</div>
						)}
					</form>

					<DialogFooter>
						<Button
							isLoading={form.formState.isSubmitting}
							form="hook-form-add-project"
							type="submit"
						>
							{projectId ? "Update" : "Create"}
						</Button>
					</DialogFooter>
				</Form>
			</DialogContent>
		</Dialog>
	);
};
