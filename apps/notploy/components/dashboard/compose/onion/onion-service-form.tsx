import { standardSchemaResolver as zodResolver } from "@hookform/resolvers/standard-schema";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { AlertBlock } from "@/components/shared/alert-block";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
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
import { api } from "@/utils/api";

const PORT_REGEX = /^\d+$/;

const isPort = (value: string) =>
	PORT_REGEX.test(value) && Number(value) >= 1 && Number(value) <= 65535;

export const onionServiceFormSchema = z.object({
	name: z.string().min(1, "A name is required").max(63),
	serviceName: z.string().min(1, "Select the Compose service to publish"),
	targetPort: z
		.string()
		.refine(isPort, "Port must be a number between 1 and 65535"),
	virtualPort: z
		.string()
		.refine(isPort, "Port must be a number between 1 and 65535"),
});

export type OnionServiceFormValues = z.infer<typeof onionServiceFormSchema>;

interface Props {
	composeId: string;
	/** When set, the form edits the Onion Service instead of creating one. */
	onionServiceId?: string;
	onDone?: () => void;
}

/**
 * Form used to create or update a managed Tor Onion Service. It is shared by the
 * dedicated Onion Service dialog and by the Compose "Add Domain" dialog, so the
 * onion address is managed where operators already look for domains.
 */
export const OnionServiceForm = ({
	composeId,
	onionServiceId,
	onDone,
}: Props) => {
	const utils = api.useUtils();

	const { data: services } = api.compose.loadServices.useQuery(
		{ composeId, type: "cache" },
		{ enabled: !!composeId },
	);

	const { data: onionService } = api.onion.one.useQuery(
		{ onionServiceId: onionServiceId ?? "" },
		{ enabled: !!onionServiceId },
	);

	const form = useForm<OnionServiceFormValues>({
		defaultValues: {
			name: "",
			serviceName: "",
			targetPort: "80",
			virtualPort: "80",
		},
		resolver: zodResolver(onionServiceFormSchema),
	});

	useEffect(() => {
		if (onionService) {
			form.reset({
				name: onionService.name,
				serviceName: onionService.serviceName,
				targetPort: String(onionService.targetPort),
				virtualPort: String(onionService.virtualPort),
			});
		}
	}, [onionService, form, form.reset]);

	const { mutateAsync: createOnionService, isPending: isCreating } =
		api.onion.create.useMutation();
	const { mutateAsync: updateOnionService, isPending: isUpdating } =
		api.onion.update.useMutation();
	const isPending = isCreating || isUpdating;

	const onSubmit = async (values: OnionServiceFormValues) => {
		const payload = {
			name: values.name,
			serviceName: values.serviceName,
			targetPort: Number(values.targetPort),
			virtualPort: Number(values.virtualPort),
		};

		try {
			if (onionServiceId) {
				await updateOnionService({ onionServiceId, ...payload });
				toast.success("Onion Service updated");
			} else {
				const created = await createOnionService({ composeId, ...payload });
				toast.success(
					created.onionAddress
						? `Onion Service created: ${created.onionAddress}`
						: "Onion Service created",
				);
			}

			await utils.onion.list.invalidate({ composeId });
			onDone?.();
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: "Could not save the Onion Service",
			);
		}
	};

	return (
		<Form {...form}>
			<form
				id="onion-service-form"
				onSubmit={form.handleSubmit(onSubmit)}
				className="grid w-full gap-4"
			>
				<FormField
					control={form.control}
					name="name"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Name</FormLabel>
							<FormControl>
								<Input placeholder="Public wiki" {...field} />
							</FormControl>
							<FormDescription>
								Label shown in the dashboard. It is never used in a command or
								in the onion address.
							</FormDescription>
							<FormMessage />
						</FormItem>
					)}
				/>

				<FormField
					control={form.control}
					name="serviceName"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Compose service</FormLabel>
							<FormControl>
								<Select
									onValueChange={field.onChange}
									value={field.value}
									disabled={!!onionServiceId}
								>
									<SelectTrigger className="w-full">
										<SelectValue placeholder="Select a service" />
									</SelectTrigger>
									<SelectContent>
										{services?.map((service) => (
											<SelectItem key={service} value={service}>
												{service}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</FormControl>
							<FormDescription>
								The service is reached over the Compose project network only:
								enabling an Onion Service never publishes its port on the host.
							</FormDescription>
							<FormMessage />
						</FormItem>
					)}
				/>

				<div className="grid grid-cols-2 gap-4">
					<FormField
						control={form.control}
						name="targetPort"
						render={({ field }) => (
							<FormItem>
								<FormLabel>Target port</FormLabel>
								<FormControl>
									<Input
										inputMode="numeric"
										placeholder="3000"
										{...field}
									/>
								</FormControl>
								<FormDescription>
									Port the service listens on inside its container.
								</FormDescription>
								<FormMessage />
							</FormItem>
						)}
					/>

					<FormField
						control={form.control}
						name="virtualPort"
						render={({ field }) => (
							<FormItem>
								<FormLabel>Virtual port</FormLabel>
								<FormControl>
									<Input inputMode="numeric" placeholder="80" {...field} />
								</FormControl>
								<FormDescription>
									Port exposed on the onion address (80 for{" "}
									<code>http://…onion</code>).
								</FormDescription>
								<FormMessage />
							</FormItem>
						)}
					/>
				</div>

				<AlertBlock type="info">
					The onion identity is written to the protected Notploy storage on the
					server and is never stored in the database. Back it up with the
					instance configuration to keep the same address, and start the Onion
					Service from the Domains tab once it is created.
				</AlertBlock>

				<DialogFooter>
					<Button
						isLoading={isPending}
						form="onion-service-form"
						type="submit"
					>
						{onionServiceId ? "Save" : "Create"}
					</Button>
				</DialogFooter>
			</form>
		</Form>
	);
};
