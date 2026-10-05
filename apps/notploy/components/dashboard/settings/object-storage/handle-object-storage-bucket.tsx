import { standardSchemaResolver as zodResolver } from "@hookform/resolvers/standard-schema";
import { PenBoxIcon, PlusIcon } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { AlertBlock } from "@/components/shared/alert-block";
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
	Form,
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { api } from "@/utils/api";

const bucketFormSchema = z.object({
	name: z.string().min(1, { message: "Name is required" }),
	bucket: z.string().min(1, { message: "Bucket name is required" }),
	region: z.string(),
	endpoint: z.string(),
	versioning: z.boolean(),
});

type BucketForm = z.infer<typeof bucketFormSchema>;

const defaultValues: BucketForm = {
	name: "",
	bucket: "",
	region: "",
	endpoint: "",
	versioning: false,
};

const extractErrorMessage = (err: unknown) => {
	if (!(err instanceof Error)) return undefined;
	try {
		const issues = JSON.parse(err.message) as { message?: string }[];
		if (Array.isArray(issues)) {
			return issues
				.map((issue) => issue.message)
				.filter(Boolean)
				.join(", ");
		}
	} catch {}
	return err.message;
};

interface Props {
	objectStorageProviderId: string;
	objectStorageBucketId?: string;
	trigger?: ReactNode;
}

export const HandleObjectStorageBucket = ({
	objectStorageProviderId,
	objectStorageBucketId,
	trigger,
}: Props) => {
	const utils = api.useUtils();
	const [isOpen, setIsOpen] = useState(false);

	const { data: provider } = api.objectStorage.provider.useQuery(
		{ objectStorageProviderId },
		{ enabled: isOpen },
	);
	const { data: bucket } = api.objectStorage.bucket.useQuery(
		{ objectStorageBucketId: objectStorageBucketId || "" },
		{ enabled: !!objectStorageBucketId && isOpen },
	);

	const {
		mutateAsync: createBucket,
		isPending: isCreating,
		error: createError,
		isError: isCreateError,
	} = api.objectStorage.createBucket.useMutation();
	const {
		mutateAsync: updateBucket,
		isPending: isUpdating,
		error: updateError,
		isError: isUpdateError,
	} = api.objectStorage.updateBucket.useMutation();
	const { mutateAsync: testBucket, isPending: isTesting } =
		api.objectStorage.testBucket.useMutation();
	const { mutateAsync: testConnection } =
		api.objectStorage.testConnection.useMutation();

	const isPending = isCreating || isUpdating;
	const error = updateError ?? createError;
	const isError = isUpdateError || isCreateError;

	const form = useForm<BucketForm>({
		defaultValues,
		resolver: zodResolver(bucketFormSchema),
	});

	const versioning = form.watch("versioning");

	useEffect(() => {
		if (bucket) {
			form.reset({
				name: bucket.name,
				bucket: bucket.bucket,
				region: bucket.region,
				endpoint: bucket.endpoint,
				versioning: bucket.versioning,
			});
		} else if (!objectStorageBucketId && provider) {
			form.reset({
				...defaultValues,
				region: provider.config.region,
				endpoint: provider.config.endpoint,
			});
		}
	}, [bucket, provider, objectStorageBucketId, form]);

	const onSubmit = async (data: BucketForm) => {
		try {
			if (objectStorageBucketId) {
				await updateBucket({
					objectStorageBucketId,
					objectStorageProviderId,
					name: data.name,
					bucket: data.bucket,
					region: data.region,
					endpoint: data.endpoint,
					versioning: data.versioning,
					lifecycle: [],
				});
				toast.success("Bucket updated");
			} else {
				await createBucket({
					name: data.name,
					objectStorageProviderId,
					bucket: data.bucket,
					region: data.region,
					endpoint: data.endpoint,
					versioning: data.versioning,
					lifecycle: [],
				});
				toast.success("Bucket created");
			}
			await utils.objectStorage.buckets.invalidate();
			await utils.objectStorage.providers.invalidate();
			setIsOpen(false);
		} catch (err) {
			toast.error("Error saving the bucket", {
				description: extractErrorMessage(err),
			});
		}
	};

	const onTest = async () => {
		const isValid = await form.trigger(["bucket"]);
		if (!isValid) return;
		const data = form.getValues();
		if (objectStorageBucketId) {
			await testBucket({ objectStorageBucketId })
				.then(() => toast.success("Connection successful"))
				.catch((err) =>
					toast.error("Connection failed", {
						description: extractErrorMessage(err),
					}),
				);
		} else {
			await testBucketConnection(data.bucket);
		}
	};

	// A not-yet-saved bucket is validated against the stored provider config.
	const testBucketConnection = async (bucketName: string) => {
		await testConnection({ objectStorageProviderId, bucket: bucketName })
			.then(() => toast.success("Connection successful"))
			.catch((err) =>
				toast.error("Connection failed", {
					description: extractErrorMessage(err),
				}),
			);
	};

	return (
		<Dialog open={isOpen} onOpenChange={setIsOpen}>
			{trigger ? (
				<DialogTrigger asChild>{trigger}</DialogTrigger>
			) : objectStorageBucketId ? (
				<Tooltip>
					<TooltipTrigger asChild>
						<DialogTrigger asChild>
							<Button
								variant="ghost"
								size="icon"
								className="text-muted-foreground"
							>
								<PenBoxIcon className="size-4" />
								<span className="sr-only">Edit bucket</span>
							</Button>
						</DialogTrigger>
					</TooltipTrigger>
					<TooltipContent>Edit bucket</TooltipContent>
				</Tooltip>
			) : (
				<DialogTrigger asChild>
					<Button>
						<PlusIcon className="size-4" />
						Add Bucket
					</Button>
				</DialogTrigger>
			)}
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>
						{objectStorageBucketId ? "Update Bucket" : "Add Bucket"}
					</DialogTitle>
					<DialogDescription>
						Expose a bucket from this provider. Backups reference the bucket,
						not the raw endpoint.
					</DialogDescription>
				</DialogHeader>

				<Form {...form}>
					<form
						onSubmit={form.handleSubmit(onSubmit)}
						className="grid w-full gap-3"
					>
						{isError && (
							<AlertBlock type="error">{extractErrorMessage(error)}</AlertBlock>
						)}

						<FormField
							control={form.control}
							name="name"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Display name</FormLabel>
									<FormControl>
										<Input placeholder="Daily backups" {...field} />
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
						<FormField
							control={form.control}
							name="bucket"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Bucket name</FormLabel>
									<FormControl>
										<Input placeholder="notploy-backups" {...field} />
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
						<div className="grid grid-cols-2 gap-3">
							<FormField
								control={form.control}
								name="region"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Region</FormLabel>
										<FormControl>
											<Input
												placeholder="us-east-1"
												{...field}
												value={String(field.value ?? "")}
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name="endpoint"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Endpoint</FormLabel>
										<FormControl>
											<Input
												placeholder="https://s3.example.com"
												{...field}
												value={String(field.value ?? "")}
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
						</div>
						<FormField
							control={form.control}
							name="versioning"
							render={({ field }) => (
								<FormItem className="flex flex-row items-center justify-between gap-3 rounded-lg border p-3">
									<div className="flex flex-col gap-0.5">
										<FormLabel className="text-sm">Object versioning</FormLabel>
										<FormDescription>
											Keep previous object versions in this bucket.
										</FormDescription>
									</div>
									<FormControl>
										<Switch
											checked={versioning}
											onCheckedChange={field.onChange}
										/>
									</FormControl>
								</FormItem>
							)}
						/>

						<DialogFooter className="flex w-full flex-row justify-between gap-2 sm:justify-between">
							<Button
								type="button"
								variant="secondary"
								isLoading={isTesting}
								onClick={onTest}
							>
								Test Connection
							</Button>
							<Button type="submit" isLoading={isPending}>
								{objectStorageBucketId ? "Update" : "Create"}
							</Button>
						</DialogFooter>
					</form>
				</Form>
			</DialogContent>
		</Dialog>
	);
};
