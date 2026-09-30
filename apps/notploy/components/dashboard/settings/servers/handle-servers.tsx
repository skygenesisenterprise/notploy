import { standardSchemaResolver as zodResolver } from "@hookform/resolvers/standard-schema";
import { Pencil, PlusIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
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
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
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
	SelectGroup,
	SelectItem,
	SelectLabel,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/utils/api";

const Schema = z.object({
	name: z.string().min(1, {
		message: "Name is required",
	}),
	description: z.string().optional(),
	ipAddress: z.string().min(1, {
		message: "IP Address is required",
	}),
	port: z.number().optional(),
	username: z.string().optional(),
	sshKeyId: z.string().optional(),
	serverType: z.enum(["deploy", "build"]).default("deploy"),
	enableDockerCleanup: z.boolean().default(true),
	sshPassword: z.string().optional(),
});

type Schema = z.infer<typeof Schema>;

interface Props {
	serverId?: string;
	asButton?: boolean;
}

export const HandleServers = ({ serverId, asButton = false }: Props) => {
	const utils = api.useUtils();
	const [isOpen, setIsOpen] = useState(false);
	const { data: canCreateMoreServers, refetch } =
		api.stripe.canCreateMoreServers.useQuery();

	const { data, refetch: refetchServer } = api.server.one.useQuery(
		{
			serverId: serverId || "",
		},
		{
			enabled: !!serverId,
		},
	);

	const {
		mutateAsync: createWithPassword,
		error: createError,
		isPending: isCreating,
		isError: isCreateError,
	} = api.server.createWithPassword.useMutation();
	const {
		mutateAsync: updateServer,
		error: updateError,
		isPending: isUpdating,
		isError: isUpdateError,
	} = api.server.update.useMutation();
	const isPending = isCreating || isUpdating;
	const error = serverId ? updateError : createError;
	const isError = serverId ? isUpdateError : isCreateError;
	const form = useForm<Schema>({
		defaultValues: {
			description: "",
			name: "",
			ipAddress: "",
			port: 22,
			username: "root",
			sshKeyId: "",
			serverType: "deploy",
			enableDockerCleanup: true,
			sshPassword: "",
		},
		resolver: zodResolver(Schema),
	});

	useEffect(() => {
		form.reset({
			description: data?.description || "",
			name: data?.name || "",
			ipAddress: data?.ipAddress || "",
			port: data?.port || 22,
			username: data?.username || "root",
			serverType: data?.serverType || "deploy",
			enableDockerCleanup: data?.enableDockerCleanup ?? true,
			sshPassword: "",
		});
	}, [form, form.reset, form.formState.isSubmitSuccessful, data]);

	useEffect(() => {
		refetch();
	}, [isOpen]);

	const onSubmit = async (data: Schema) => {
		try {
			if (serverId) {
				await updateServer({
					name: data.name,
					description: data.description || "",
					ipAddress: data.ipAddress.trim(),
					port: data.port || 22,
					username: data.username || "root",
					sshKeyId: data?.sshKeyId || "",
					serverType: data.serverType,
					enableDockerCleanup: data.enableDockerCleanup,
					serverId,
				});
			} else {
				if (!data.sshPassword) {
					form.setError("sshPassword", {
						message: "SSH password is required to connect this server.",
					});
					return;
				}
				await createWithPassword({
					name: data.name,
					description: data.description || "",
					ipAddress: data.ipAddress.trim(),
					port: data.port || 22,
					username: data.username || "root",
					sshPassword: data.sshPassword,
					serverType: data.serverType,
					enableDockerCleanup: data.enableDockerCleanup,
				});
			}

			await utils.server.all.invalidate();
			await refetchServer();
			toast.success(serverId ? "Server updated" : "Server connected");
			form.reset({ ...form.getValues(), sshPassword: "" });
			setIsOpen(false);
		} catch (submitError) {
			toast.error(
				submitError instanceof Error
					? submitError.message
					: serverId
						? "Error updating server"
						: "Error connecting server",
			);
		}
	};

	return (
		<Dialog open={isOpen} onOpenChange={setIsOpen}>
			{serverId ? (
				asButton ? (
					<DialogTrigger asChild>
						<Button variant="outline" size="icon" className="h-9 w-9">
							<Pencil className="h-4 w-4" />
						</Button>
					</DialogTrigger>
				) : (
					<DropdownMenuItem
						className="w-full cursor-pointer "
						onSelect={(e) => {
							e.preventDefault();
							setIsOpen(true);
						}}
					>
						Edit Server
					</DropdownMenuItem>
				)
			) : (
				<DialogTrigger asChild>
					<Button className="cursor-pointer space-x-3">
						<PlusIcon className="h-4 w-4" />
						Connect server
					</Button>
				</DialogTrigger>
			)}
			<DialogContent className="sm:max-w-3xl ">
				<DialogHeader>
					<DialogTitle>
						{serverId ? "Edit server" : "Connect server"}
					</DialogTitle>
					<DialogDescription>
						{serverId
							? "Update the connection details and role for this execution server."
							: "Connect an execution server. Notploy will install a dedicated SSH key using the credentials provided below."}
					</DialogDescription>
				</DialogHeader>
				{!canCreateMoreServers && (
					<AlertBlock type="warning" className="mt-4">
						You cannot create more servers,{" "}
						<Link href="/dashboard/settings/billing" className="text-primary">
							Please upgrade your plan
						</Link>
					</AlertBlock>
				)}
				{isError && <AlertBlock type="error">{error?.message}</AlertBlock>}
				<Form {...form}>
					<form
						id="hook-form-add-server"
						onSubmit={form.handleSubmit(onSubmit)}
						className="grid w-full gap-4"
					>
						<div className="flex flex-col gap-4 ">
							<FormField
								control={form.control}
								name="name"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Name</FormLabel>
										<FormControl>
											<Input placeholder="Hostinger Server" {...field} />
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
											placeholder="This server is for databases..."
											className="resize-none"
											{...field}
										/>
									</FormControl>

									<FormMessage />
								</FormItem>
							)}
						/>
						<FormField
							control={form.control}
							name="serverType"
							render={({ field }) => {
								const serverTypeValue = form.watch("serverType");
								return (
									<FormItem>
										<FormLabel>Server Type</FormLabel>
										<Select
											onValueChange={field.onChange}
											defaultValue={field.value}
										>
											<SelectTrigger>
												<SelectValue placeholder="Select a server type" />
											</SelectTrigger>
											<SelectContent>
												<SelectGroup>
													<SelectItem value="deploy">Deploy Server</SelectItem>
													<SelectItem value="build">Build Server</SelectItem>
													<SelectLabel>Server Type</SelectLabel>
												</SelectGroup>
											</SelectContent>
										</Select>
										<FormMessage />
										{serverTypeValue === "deploy" && (
											<AlertBlock type="info" className="mt-2">
												Deploy servers are used to run your applications,
												databases, and services. They handle the deployment and
												execution of your projects.
											</AlertBlock>
										)}
										{serverTypeValue === "build" && (
											<AlertBlock type="info" className="mt-2">
												Build servers are dedicated to building your
												applications. They handle the compilation and build
												process, offloading this work from your deployment
												servers. Build servers won't appear in deployment
												options.
											</AlertBlock>
										)}
									</FormItem>
								);
							}}
						/>
						<div className="grid grid-cols-2 gap-4">
							<FormField
								control={form.control}
								name="ipAddress"
								render={({ field }) => (
									<FormItem>
										<FormLabel>IP Address</FormLabel>
										<FormControl>
											<Input placeholder="192.168.1.100" {...field} />
										</FormControl>

										<FormMessage />
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name="port"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Port</FormLabel>
										<FormControl>
											<Input
												placeholder="22"
												{...field}
												onChange={(e) => {
													const value = e.target.value;
													if (value === "") {
														field.onChange(0);
													} else {
														const number = Number.parseInt(value, 10);
														if (!Number.isNaN(number)) {
															field.onChange(number);
														}
													}
												}}
											/>
										</FormControl>

										<FormMessage />
									</FormItem>
								)}
							/>
						</div>

						<FormField
							control={form.control}
							name="username"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Username</FormLabel>
									<FormControl>
										<Input placeholder="root" {...field} />
									</FormControl>
									<FormDescription>
										Use &quot;root&quot; or a non-root user with passwordless
										sudo access.
									</FormDescription>
									<FormMessage />
								</FormItem>
							)}
						/>
						{!serverId && (
							<FormField
								control={form.control}
								name="sshPassword"
								render={({ field }) => (
									<FormItem>
										<FormLabel>SSH password</FormLabel>
										<FormControl>
											<Input
												type="password"
												enablePasswordGenerator={false}
												autoComplete="new-password"
												{...field}
											/>
										</FormControl>
										<FormDescription>
											Used once to add Notploy&apos;s SSH key to this account.
											The password is not stored.
										</FormDescription>
										<FormMessage />
									</FormItem>
								)}
							/>
						)}
						<FormField
							control={form.control}
							name="enableDockerCleanup"
							render={({ field }) => (
								<FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
									<div className="space-y-0.5">
										<FormLabel>Enable Docker Cleanup</FormLabel>
										<FormDescription>
											Automatically prune unused Docker images daily. Keeps disk
											usage in check on this remote server.
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

					<DialogFooter>
						<Button
							isLoading={isPending}
							disabled={!canCreateMoreServers && !serverId}
							form="hook-form-add-server"
							type="submit"
						>
							{serverId ? "Update server" : "Connect server"}
						</Button>
					</DialogFooter>
				</Form>
			</DialogContent>
		</Dialog>
	);
};
