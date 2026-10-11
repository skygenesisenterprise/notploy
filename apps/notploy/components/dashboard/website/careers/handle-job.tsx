import { zodResolver } from "@hookform/resolvers/zod";
import { PlusIcon } from "lucide-react";
import { useRouter } from "next/router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
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
import { Textarea } from "@/components/ui/textarea";

const JobSchema = z.object({
	title: z
		.string()
		.min(1, "Title is required")
		.max(255, "Title must be less than 255 characters"),
	region: z
		.string()
		.min(1, "Location is required")
		.max(120, "Location must be less than 120 characters"),
	description: z
		.string()
		.min(1, "Description is required")
		.max(2000, "Description must be less than 2000 characters"),
	apply_url: z.string().url("Must be a valid URL").optional().or(z.literal("")),
	publish: z.boolean(),
});

type JobForm = z.infer<typeof JobSchema>;

export const HandleJob = () => {
	const router = useRouter();
	const [isOpen, setIsOpen] = useState(false);

	const form = useForm<JobForm>({
		defaultValues: {
			title: "",
			region: "",
			description: "",
			apply_url: "",
			publish: true,
		},
		resolver: zodResolver(JobSchema),
	});

	const onSubmit = async (data: JobForm) => {
		try {
			const response = await fetch("/api/website/careers", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					title: data.title,
					region: data.region,
					description: data.description,
					apply_url: data.apply_url || undefined,
					status: data.publish ? "published" : "draft",
				}),
			});

			if (!response.ok) {
				const payload = (await response.json().catch(() => null)) as {
					error?: string;
				} | null;
				throw new Error(payload?.error || "Failed to create job offer");
			}

			toast.success(data.publish ? "Job offer published" : "Draft saved");
			setIsOpen(false);
			form.reset();
			await router.replace(router.asPath);
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Failed to create job offer",
			);
		}
	};

	return (
		<Dialog open={isOpen} onOpenChange={setIsOpen}>
			<DialogTrigger asChild>
				<Button>
					<PlusIcon className="h-4 w-4" />
					New Job
				</Button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-2xl">
				<DialogHeader>
					<DialogTitle>New Job Offer</DialogTitle>
					<DialogDescription>
						Publish a new open position on the Notploy website.
					</DialogDescription>
				</DialogHeader>
				<Form {...form}>
					<form
						id="hook-form-job"
						onSubmit={(e) => {
							e.stopPropagation();
							form.handleSubmit(onSubmit)(e);
						}}
						className="grid w-full gap-4"
					>
						<FormField
							control={form.control}
							name="title"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Title</FormLabel>
									<FormControl>
										<Input
											placeholder="e.g., Senior Backend Engineer"
											{...field}
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						<FormField
							control={form.control}
							name="region"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Location</FormLabel>
									<FormControl>
										<Input placeholder="e.g., Remote (EU), Paris" {...field} />
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						<FormField
							control={form.control}
							name="description"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Description</FormLabel>
									<FormControl>
										<Textarea
											placeholder="What the role is about, responsibilities, requirements..."
											className="min-h-[160px]"
											{...field}
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						<FormField
							control={form.control}
							name="apply_url"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Application link (Optional)</FormLabel>
									<FormControl>
										<Input placeholder="https://..." {...field} />
									</FormControl>
									<FormDescription>
										Where candidates should apply. Defaults to the job post URL.
									</FormDescription>
									<FormMessage />
								</FormItem>
							)}
						/>

						<FormField
							control={form.control}
							name="publish"
							render={({ field }) => (
								<FormItem className="flex flex-row items-center justify-between rounded-lg border p-3.5">
									<div className="space-y-0.5">
										<FormLabel>Publish immediately</FormLabel>
										<FormDescription>
											When off, the offer is saved as a draft.
										</FormDescription>
									</div>
									<FormControl>
										<Switch
											checked={field.value}
											onCheckedChange={field.onChange}
										/>
									</FormControl>
								</FormItem>
							)}
						/>
					</form>
				</Form>

				<DialogFooter>
					<Button
						isLoading={form.formState.isSubmitting}
						form="hook-form-job"
						type="submit"
					>
						{form.watch("publish") ? "Publish" : "Save draft"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};
