import * as React from "react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { standardSchemaResolver as zodResolver } from "@hookform/resolvers/standard-schema";
import { AlertBlock } from "@/components/shared/alert-block";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Form,
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectLabel,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { api } from "@/utils/api";

const schema = z.object({
	serverId: z.string().optional(),
});

type Schema = z.infer<typeof schema>;

interface Props {
	type: "application" | "compose";
	id: string;
	currentServerId?: string | null;
	allowLocal?: boolean;
}

export const DeploymentTargetSelector = ({
	type,
	id,
	currentServerId,
	allowLocal = true,
}: Props) => {
	const { data: servers, isPending: serversPending } =
		api.server.withSSHKey.useQuery();
	const { data: isCloud } = api.settings.isCloud.useQuery();
	const { data: webServerSettings } =
		api.settings.getWebServerSettings.useQuery();
	const effectiveAllowLocal =
		allowLocal && !isCloud && !webServerSettings?.remoteServersOnly;
	const utils = api.useUtils();
	const applicationUpdate = api.application.update.useMutation();
	const composeUpdate = api.compose.update.useMutation();
	const isPending = applicationUpdate.isPending || composeUpdate.isPending;

	const form = useForm<Schema>({
		defaultValues: { serverId: currentServerId || "local" },
		resolver: zodResolver(schema),
	});

	useEffect(() => {
		form.reset({
			serverId:
				currentServerId || (effectiveAllowLocal ? "local" : ""),
		});
	}, [form, currentServerId, effectiveAllowLocal]);

	const onSubmit = async (values: Schema) => {
		const serverId =
			!values.serverId || values.serverId === "local" ? null : values.serverId;
		try {
			if (type === "application") {
				await applicationUpdate.mutateAsync({
					applicationId: id,
					serverId,
				});
			} else {
				await composeUpdate.mutateAsync({
					composeId: id,
					serverId,
				});
			}
			if (type === "application") {
				await utils.application.one.invalidate();
			} else {
				await utils.compose.one.invalidate();
			}
			toast.success("Deployment target updated");
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: "Error updating deployment target",
			);
		}
	};

	return (
		<Card className="bg-background">
			<CardHeader>
				<CardTitle className="text-xl">Deployment Target</CardTitle>
				<CardDescription>
					Select the connected deployment server that runs this workload. The
					Notploy instance stays the control plane; the target runs containers,
					volumes and networking. Build-only servers cannot run workloads.
				</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-col gap-4">
				<AlertBlock type="info">
					Deployment servers run your workload. A separate build server (Advanced
					settings, applications only) only builds the image and pushes it to a
					registry for the deployment target to pull.
				</AlertBlock>
				<Form {...form}>
					<form
						onSubmit={form.handleSubmit(onSubmit)}
						className="grid w-full gap-4"
					>
						<FormField
							control={form.control}
							name="serverId"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Deployment server</FormLabel>
									<Select
										onValueChange={field.onChange}
										value={field.value || "local"}
									>
										<FormControl>
											<SelectTrigger>
												<SelectValue placeholder="Select a deployment server" />
											</SelectTrigger>
										</FormControl>
										<SelectContent>
									<SelectGroup>
										{effectiveAllowLocal && (
													<SelectItem value="local">
														Notploy instance (local Docker)
													</SelectItem>
												)}
												{(servers ?? []).map((server) => (
													<SelectItem
														key={server.serverId}
														value={server.serverId}
														disabled={server.serverStatus !== "active"}
													>
														{server.name} · {server.ipAddress}
														{server.serverStatus !== "active"
															? " (disabled)"
															: ""}
													</SelectItem>
												))}
												<SelectLabel>
													Deployment servers ({servers?.length || 0}
													{serversPending ? ", loading…" : ""})
												</SelectLabel>
											</SelectGroup>
										</SelectContent>
									</Select>
									<FormDescription>
										Only connected deployment servers are listed. Existing
										workloads keep their current target until you change it;
										changing it does not migrate data by itself — use Transfer
										for data migration.
									</FormDescription>
									<FormMessage />
								</FormItem>
							)}
						/>
						<div className="flex w-full justify-end">
							<Button isLoading={isPending} type="submit">
								Save target
							</Button>
						</div>
					</form>
				</Form>
			</CardContent>
		</Card>
	);
};
