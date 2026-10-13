import {
	INVALID_HOSTNAME_MESSAGE,
	VALID_HOSTNAME_REGEX,
} from "@notploy/server/utils/hostname-validation";
import { standardSchemaResolver as zodResolver } from "@hookform/resolvers/standard-schema";
import { GlobeIcon } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
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
import { api } from "@/utils/api";

const addServerDomain = z.object({
	domain: z
		.string()
		.trim()
		.toLowerCase()
		// empty clears the server domain and reverts to IP-only access
		.refine((val) => val === "" || VALID_HOSTNAME_REGEX.test(val), {
			message: INVALID_HOSTNAME_MESSAGE,
		}),
	letsEncryptEmail: z.string(),
});

type AddServerDomain = z.infer<typeof addServerDomain>;

export const WebDomain = () => {
	const { data, refetch } = api.settings.getControlPlaneRuntime.useQuery();
	const { mutateAsync, isPending } =
		api.settings.assignDomainServer.useMutation();

	const form = useForm<AddServerDomain>({
		defaultValues: {
			domain: "",
			letsEncryptEmail: "",
		},
		resolver: zodResolver(addServerDomain),
	});
	useEffect(() => {
		if (data) {
			form.reset({
				domain: data?.host || "",
				letsEncryptEmail: data?.letsEncryptEmail || "",
			});
		}
	}, [form, form.reset, data]);

	const onSubmit = async (data: AddServerDomain) => {
		await mutateAsync({
			host: data.domain,
			letsEncryptEmail: data.letsEncryptEmail,
		})
			.then(async (result) => {
				await refetch();
				const internalDns = result?.internalDns;
				if (internalDns?.status === "no-provider") {
					toast.warning(
						"Domain saved, but no Notploy Internal DNS provider is configured",
					);
				} else if (internalDns?.status === "no-ip") {
					toast.warning(
						"Domain saved, but no server IP could be resolved for the internal DNS record",
					);
				} else {
					toast.success("Domain Assigned");
				}
			})
			.catch(() => {
				toast.error("Error assigning the domain");
			});
	};

	return (
		<section className="space-y-4 rounded-md border p-4">
			<header className="space-y-1">
				<h2 className="flex items-center gap-2 text-lg font-semibold">
					<GlobeIcon className="size-5 text-muted-foreground" aria-hidden />
					Instance URL
				</h2>
				<p className="text-sm text-muted-foreground">
					Configure the hostname of the Notploy control plane. Use a public
					hostname or an internal/LAN one (e.g. console.notploy.lan).
				</p>
			</header>
			<Form {...form}>
				<form
					onSubmit={form.handleSubmit(onSubmit)}
					className="grid w-full gap-4 sm:grid-cols-2"
				>
					<FormField
						control={form.control}
						name="domain"
						render={({ field }) => {
							return (
								<FormItem>
									<FormLabel>Hostname</FormLabel>
									<FormControl>
										<Input
											className="w-full"
											placeholder="notploy.example.com"
											{...field}
										/>
									</FormControl>
									<FormDescription>
										Public or internal (LAN) hostname used as the Notploy URL in
										generated callbacks.
									</FormDescription>
									<FormMessage />
								</FormItem>
							);
						}}
					/>

					<FormField
						control={form.control}
						name="letsEncryptEmail"
						render={({ field }) => {
							return (
								<FormItem>
									<FormLabel>Let's Encrypt Email</FormLabel>
									<FormControl>
										<Input
											className="w-full"
											placeholder={"Dp4kz@example.com"}
											{...field}
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							);
						}}
					/>

					<div className="flex w-full justify-end sm:col-span-2">
						<Button isLoading={isPending} type="submit">
							Save instance URL
						</Button>
					</div>
				</form>
			</Form>
		</section>
	);
};
