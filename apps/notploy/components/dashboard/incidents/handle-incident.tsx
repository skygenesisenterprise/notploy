import { zodResolver } from "@hookform/resolvers/zod";
import { PlusIcon } from "lucide-react";
import { useRouter } from "next/router";
import * as React from "react";
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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/utils/api";
import type { StatusPageOverview } from "@/lib/status";
import { ComponentPicker } from "./component-picker";

const IncidentFormSchema = z.object({
	title: z
		.string()
		.min(1, "Title is required")
		.max(160, "Title must be less than 160 characters"),
	description: z
		.string()
		.max(4000, "Description must be less than 4000 characters")
		.optional(),
	severity: z.enum(["minor", "major", "critical"]),
	state: z.enum(["investigating", "identified", "monitoring"]),
	updateMessage: z
		.string()
		.max(4000, "The message must be less than 4000 characters")
		.optional(),
	isPublic: z.boolean(),
	published: z.boolean(),
});

type IncidentForm = z.infer<typeof IncidentFormSchema>;

/**
 * Introduce a new incident from the console. It lands in the same platform
 * as an incident created on the status page: same timeline, same
 * notification outbox, same publication rules.
 */
export const HandleIncident = ({ page }: { page: StatusPageOverview }) => {
	const router = useRouter();
	const [isOpen, setIsOpen] = React.useState(false);
	const [componentIds, setComponentIds] = React.useState<string[]>([]);

	const form = useForm<IncidentForm>({
		defaultValues: {
			title: "",
			description: "",
			severity: "minor",
			state: "investigating",
			updateMessage: "",
			isPublic: true,
			published: false,
		},
		resolver: zodResolver(IncidentFormSchema),
	});

	const createIncident = api.status.createIncident.useMutation({
		onSuccess: () => {
			toast.success("Incident created");
		},
		onError: (error) => {
			toast.error(error.message || "Failed to create the incident");
		},
	});

	const onSubmit = async (data: IncidentForm) => {
		try {
			await createIncident.mutateAsync({
				pageRef: page.page.slug,
				title: data.title,
				description: data.description || undefined,
				severity: data.severity,
				state: data.state,
				visibility: data.isPublic ? "public" : "private",
				published: data.published,
				componentIds,
				updateMessage: data.updateMessage || undefined,
			});
			setIsOpen(false);
			setComponentIds([]);
			form.reset();
			await router.replace(router.asPath);
		} catch {
			// Surfaced through the mutation's onError toast.
		}
	};

	return (
		<Dialog open={isOpen} onOpenChange={setIsOpen}>
			<DialogTrigger asChild>
				<Button>
					<PlusIcon className="h-4 w-4" />
					New Incident
				</Button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-2xl">
				<DialogHeader>
					<DialogTitle>New Incident</DialogTitle>
					<DialogDescription>
						Declare an incident on {page.page.name}. It is shared with the
						public status page and the monitoring pipeline.
					</DialogDescription>
				</DialogHeader>
				<Form {...form}>
					<form
						id="hook-form-incident"
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
											placeholder="e.g., API elevated error rate in eu-west"
											{...field}
										/>
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
									<FormLabel>Internal description</FormLabel>
									<FormControl>
										<Textarea
											placeholder="Context for operators — never shown publicly."
											{...field}
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
							<FormField
								control={form.control}
								name="severity"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Severity</FormLabel>
										<Select
											onValueChange={field.onChange}
											defaultValue={field.value}
										>
											<FormControl>
												<SelectTrigger className="w-full">
													<SelectValue placeholder="Severity" />
												</SelectTrigger>
											</FormControl>
											<SelectContent>
												<SelectItem value="minor">Minor</SelectItem>
												<SelectItem value="major">Major</SelectItem>
												<SelectItem value="critical">Critical</SelectItem>
											</SelectContent>
										</Select>
										<FormMessage />
									</FormItem>
								)}
							/>

							<FormField
								control={form.control}
								name="state"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Initial state</FormLabel>
										<Select
											onValueChange={field.onChange}
											defaultValue={field.value}
										>
											<FormControl>
												<SelectTrigger className="w-full">
													<SelectValue placeholder="State" />
												</SelectTrigger>
											</FormControl>
											<SelectContent>
												<SelectItem value="investigating">
													Investigating
												</SelectItem>
												<SelectItem value="identified">Identified</SelectItem>
												<SelectItem value="monitoring">Monitoring</SelectItem>
											</SelectContent>
										</Select>
										<FormMessage />
									</FormItem>
								)}
							/>
						</div>

						<FormField
							control={form.control}
							name="updateMessage"
							render={({ field }) => (
								<FormItem>
									<FormLabel>First public update</FormLabel>
									<FormControl>
										<Input
											placeholder="e.g., We are investigating elevated error rates."
											{...field}
										/>
									</FormControl>
									<FormDescription>
										Posted on the incident timeline when it goes public.
									</FormDescription>
									<FormMessage />
								</FormItem>
							)}
						/>

						<ComponentPicker
							components={page.components}
							selected={componentIds}
							onChange={setComponentIds}
						/>

						<FormField
							control={form.control}
							name="isPublic"
							render={({ field }) => (
								<FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
									<div className="space-y-0.5">
										<FormLabel>Public incident</FormLabel>
										<FormDescription>
											Visible on the public status page once published.
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

						<FormField
							control={form.control}
							name="published"
							render={({ field }) => (
								<FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
									<div className="space-y-0.5">
										<FormLabel>Publish immediately</FormLabel>
										<FormDescription>
											Otherwise it stays an internal draft you can edit before
											announcing it.
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
					<Button variant="outline" onClick={() => setIsOpen(false)}>
						Cancel
					</Button>
					<Button
						type="submit"
						form="hook-form-incident"
						disabled={createIncident.isPending}
					>
						{createIncident.isPending ? "Creating..." : "Create incident"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};
