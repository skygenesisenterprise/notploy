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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { api } from "@/utils/api";

const addServerDomain = z
	.object({
		domain: z
			.string()
			.trim()
			.toLowerCase()
			// empty clears the server domain and reverts to IP-only access
			.refine((val) => val === "" || VALID_HOSTNAME_REGEX.test(val), {
				message: INVALID_HOSTNAME_MESSAGE,
			}),
		letsEncryptEmail: z.string(),
		https: z.boolean().optional(),
		certificateType: z.enum(["letsencrypt", "none", "custom"]),
	})
	.superRefine((data, ctx) => {
		if (data.domain && data.https && !data.certificateType) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["certificateType"],
				message: "Required",
			});
		}
		if (
			data.domain &&
			data.https &&
			data.certificateType === "letsencrypt" &&
			!data.letsEncryptEmail
		) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message:
					"LetsEncrypt email is required when certificate type is letsencrypt",
				path: ["letsEncryptEmail"],
			});
		}
	});

type AddServerDomain = z.infer<typeof addServerDomain>;

export const WebDomain = () => {
	const { data, refetch } = api.settings.getControlPlaneRuntime.useQuery();
	const { mutateAsync, isPending } =
		api.settings.assignDomainServer.useMutation();

	const form = useForm<AddServerDomain>({
		defaultValues: {
			domain: "",
			certificateType: "none",
			letsEncryptEmail: "",
			https: false,
		},
		resolver: zodResolver(addServerDomain),
	});
	const https = form.watch("https");
	const domain = form.watch("domain") || "";
	const host = data?.host || "";
	const hasChanged = domain !== host;
	useEffect(() => {
		if (data) {
			form.reset({
				domain: data?.host || "",
				certificateType: data?.certificateType || "none",
				letsEncryptEmail: data?.letsEncryptEmail || "",
				https: data?.https || false,
			});
		}
	}, [form, form.reset, data]);

	const onSubmit = async (data: AddServerDomain) => {
		await mutateAsync({
			host: data.domain,
			letsEncryptEmail: data.letsEncryptEmail,
			certificateType: data.certificateType,
			https: data.https,
		})
			.then(async () => {
				await refetch();
				toast.success("Domain Assigned");
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
					Configure the public address and HTTPS routing for the Notploy control
					plane.
				</p>
			</header>
			{hasChanged && (
				<div
					role="alert"
					className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-sm"
				>
					<p className="font-medium">
						Changing the instance URL affects callbacks
					</p>
					<p className="mt-1 text-muted-foreground">
						Update GitHub Apps and other integrations that use this Notploy URL,
						including preview deployments.
					</p>
				</div>
			)}
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
									<FormLabel>Canonical hostname</FormLabel>
									<FormControl>
										<Input
											className="w-full"
											placeholder="notploy.example.com"
											{...field}
										/>
									</FormControl>
									<FormDescription>
										Used as the public Notploy URL in generated callbacks.
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
					<FormField
						control={form.control}
						name="https"
						render={({ field }) => (
							<FormItem className="flex flex-row items-center justify-between rounded-md border p-3 sm:col-span-2">
								<div className="space-y-0.5">
									<FormLabel>HTTPS</FormLabel>
									<FormDescription>
										Automatically provision SSL Certificate.
									</FormDescription>
									<FormMessage />
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
					{https && (
						<FormField
							control={form.control}
							name="certificateType"
							render={({ field }) => {
								return (
									<FormItem className="sm:col-span-2">
										<FormLabel>Certificate Provider</FormLabel>
										<Select onValueChange={field.onChange} value={field.value}>
											<FormControl>
												<SelectTrigger>
													<SelectValue placeholder="Select a certificate" />
												</SelectTrigger>
											</FormControl>
											<SelectContent>
												<SelectItem value={"none"}>None</SelectItem>
												<SelectItem value={"letsencrypt"}>
													Let's Encrypt
												</SelectItem>
											</SelectContent>
										</Select>
										<FormMessage />
									</FormItem>
								);
							}}
						/>
					)}

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
