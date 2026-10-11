import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarPlusIcon } from "lucide-react";
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

const MaintenanceFormSchema = z
	.object({
		title: z
			.string()
			.min(1, "Title is required")
			.max(160, "Title must be less than 160 characters"),
		description: z
			.string()
			.max(4000, "Description must be less than 4000 characters")
			.optional(),
		startAt: z.string().min(1, "Start date is required"),
		endAt: z.string().min(1, "End date is required"),
		timeZone: z.string().min(1),
		isPublic: z.boolean(),
		published: z.boolean(),
	})
	.refine((value) => Date.parse(value.endAt) > Date.parse(value.startAt), {
		message: "The end must be after the start",
		path: ["endAt"],
	});

type MaintenanceForm = z.infer<typeof MaintenanceFormSchema>;

/** `datetime-local` value (wall clock) → ISO 8601 instant. */
const toIso = (value: string): string => new Date(value).toISOString();

const COMMON_TIME_ZONES = [
	"UTC",
	"Europe/Paris",
	"Europe/London",
	"Europe/Berlin",
	"America/New_York",
	"America/Los_Angeles",
	"Asia/Singapore",
	"Asia/Tokyo",
	"Australia/Sydney",
];

/**
 * Plan a maintenance window from the console. It reaches the public status
 * page exactly like one scheduled there, and influences the public state
 * only while it is in progress and published.
 */
export const HandleMaintenance = ({ page }: { page: StatusPageOverview }) => {
	const router = useRouter();
	const [isOpen, setIsOpen] = React.useState(false);
	const [componentIds, setComponentIds] = React.useState<string[]>([]);

	const form = useForm<MaintenanceForm>({
		defaultValues: {
			title: "",
			description: "",
			startAt: "",
			endAt: "",
			timeZone: "UTC",
			isPublic: true,
			published: false,
		},
		resolver: zodResolver(MaintenanceFormSchema),
	});

	const createMaintenance = api.status.createMaintenance.useMutation({
		onSuccess: () => {
			toast.success("Maintenance scheduled");
		},
		onError: (error) => {
			toast.error(error.message || "Failed to schedule the maintenance");
		},
	});

	const onSubmit = async (data: MaintenanceForm) => {
		try {
			await createMaintenance.mutateAsync({
				pageRef: page.page.slug,
				title: data.title,
				description: data.description || undefined,
				startAt: toIso(data.startAt),
				endAt: toIso(data.endAt),
				timeZone: data.timeZone,
				componentIds,
				visibility: data.isPublic ? "public" : "private",
				published: data.published,
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
				<Button variant="outline">
					<CalendarPlusIcon className="h-4 w-4" />
					New Maintenance
				</Button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-2xl">
				<DialogHeader>
					<DialogTitle>Schedule Maintenance</DialogTitle>
					<DialogDescription>
						Plan a maintenance window on {page.page.name}; the affected
						components show as under maintenance while it runs.
					</DialogDescription>
				</DialogHeader>
				<Form {...form}>
					<form
						id="hook-form-maintenance"
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
											placeholder="e.g., Database engine upgrade"
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
									<FormLabel>Description</FormLabel>
									<FormControl>
										<Textarea
											placeholder="What is happening, expected impact…"
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
								name="startAt"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Start</FormLabel>
										<FormControl>
											<Input type="datetime-local" {...field} />
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name="endAt"
								render={({ field }) => (
									<FormItem>
										<FormLabel>End</FormLabel>
										<FormControl>
											<Input type="datetime-local" {...field} />
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
						</div>

						<FormField
							control={form.control}
							name="timeZone"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Time zone</FormLabel>
									<Select
										onValueChange={field.onChange}
										defaultValue={field.value}
									>
										<FormControl>
											<SelectTrigger className="w-full">
												<SelectValue placeholder="Time zone" />
											</SelectTrigger>
										</FormControl>
										<SelectContent>
											{COMMON_TIME_ZONES.map((zone) => (
												<SelectItem key={zone} value={zone}>
													{zone}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
									<FormDescription>
										Used to display the window; stored in UTC.
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
										<FormLabel>Public maintenance</FormLabel>
										<FormDescription>
											Shown on the public status page once published.
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
											Otherwise it stays an internal draft.
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
						form="hook-form-maintenance"
						disabled={createMaintenance.isPending}
					>
						{createMaintenance.isPending ? "Scheduling..." : "Schedule"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};
