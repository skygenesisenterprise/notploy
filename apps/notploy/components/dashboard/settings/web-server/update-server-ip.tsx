import { standardSchemaResolver as zodResolver } from "@hookform/resolvers/standard-schema";
import {
	classifyIpAddress,
	describeIpScope,
	isLocalIpScope,
	isValidIpAddress,
} from "@notploy/server/utils/ip-address";
import { ChevronsUpDown } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { AlertBlock } from "@/components/shared/alert-block";
import { Badge } from "@/components/ui/badge";
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
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

const schema = z.object({
	serverIp: z.string().trim().refine(isValidIpAddress, {
		message:
			"Enter a valid IPv4 or IPv6 address, e.g. 192.168.1.122 or 2001:db8::10",
	}),
});

type Schema = z.infer<typeof schema>;

interface Props {
	children?: React.ReactNode;
	serverId?: string;
}

export const UpdateServerIp = ({ children }: Props) => {
	const [isOpen, setIsOpen] = useState(false);

	const { data, refetch } = api.settings.getWebServerSettings.useQuery();
	const {
		data: candidates,
		isPending: isCandidatesPending,
		refetch: refetchCandidates,
	} = api.settings.getWebServerIpCandidates.useQuery(undefined, {
		enabled: isOpen,
	});

	const { mutateAsync, isPending, error, isError } =
		api.settings.updateServerIp.useMutation();

	const form = useForm<Schema>({
		defaultValues: {
			serverIp: data?.serverIp || "",
		},
		resolver: zodResolver(schema),
	});

	useEffect(() => {
		if (data) {
			form.reset({
				serverIp: data.serverIp || "",
			});
		}
	}, [form, data]);

	const serverIp = form.watch("serverIp") || "";
	const detectedScope = isValidIpAddress(serverIp)
		? classifyIpAddress(serverIp)
		: null;
	const detectedAddresses = candidates?.addresses ?? [];

	const applyAddress = (address: string) => {
		form.setValue("serverIp", address, {
			shouldDirty: true,
			shouldValidate: true,
		});
	};

	const onSubmit = async (data: Schema) => {
		await mutateAsync({
			serverIp: data.serverIp,
		})
			.then(async () => {
				toast.success("Server IP Updated");
				await refetch();
				setIsOpen(false);
			})
			.catch(() => {
				toast.error("Error updating the IP of the server");
			});
	};

	return (
		<Dialog open={isOpen} onOpenChange={setIsOpen}>
			<DialogTrigger asChild>{children}</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Update Server IP</DialogTitle>
					<DialogDescription>
						The address Notploy uses to build the URLs of your apps and domains.
						On a private network, declare the LAN address of this machine (for
						example <code>192.168.1.122</code>) instead of the public IP.
					</DialogDescription>
				</DialogHeader>
				{isError && <AlertBlock type="error">{error?.message}</AlertBlock>}

				<Form {...form}>
					<form
						id="hook-form-update-server-ip"
						onSubmit={form.handleSubmit(onSubmit)}
					>
						<FormField
							control={form.control}
							name="serverIp"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Server IP</FormLabel>
									<FormControl>
										<div className="flex gap-2">
											<Input
												placeholder="192.168.1.122"
												autoComplete="off"
												{...field}
											/>
											<DropdownMenu>
												<DropdownMenuTrigger asChild>
													<Button
														variant="secondary"
														type="button"
														isLoading={isCandidatesPending}
													>
														<ChevronsUpDown className="size-4" />
														Detected
													</Button>
												</DropdownMenuTrigger>
												<DropdownMenuContent align="end" className="w-64">
													<DropdownMenuLabel>
														Addresses on this machine
													</DropdownMenuLabel>
													<DropdownMenuSeparator />
													{detectedAddresses.length === 0 ? (
														<DropdownMenuItem
															disabled
															className="text-muted-foreground"
														>
															No address detected
														</DropdownMenuItem>
													) : (
														detectedAddresses.map((candidate) => (
															<DropdownMenuItem
																key={candidate.address}
																onSelect={(event) => {
																	event.preventDefault();
																	applyAddress(candidate.address);
																}}
																className="flex items-center justify-between gap-2"
															>
																<span className="font-mono text-xs">
																	{candidate.address}
																</span>
																<Badge
																	variant={
																		isLocalIpScope(candidate.scope)
																			? "secondary"
																			: "outline"
																	}
																>
																	{describeIpScope(candidate.scope)}
																</Badge>
															</DropdownMenuItem>
														))
													)}
													<DropdownMenuSeparator />
													<DropdownMenuItem
														onSelect={(event) => {
															event.preventDefault();
															void refetchCandidates();
														}}
													>
														Refresh detected addresses
													</DropdownMenuItem>
												</DropdownMenuContent>
											</DropdownMenu>
										</div>
									</FormControl>
									<FormDescription>
										Use the LAN address of this machine so internal domains such
										as <code>gitlab.notploy.lan</code> resolve inside your
										network.
									</FormDescription>
									{detectedScope && (
										<AlertBlock
											type={isLocalIpScope(detectedScope) ? "info" : "warning"}
										>
											{isLocalIpScope(detectedScope)
												? `${describeIpScope(detectedScope)} address: apps and domains are only reachable from inside your network.`
												: "Public address: this only works if the server is reachable from the internet. Behind NAT, prefer its LAN address."}
										</AlertBlock>
									)}
									<FormMessage />
								</FormItem>
							)}
						/>
					</form>

					<DialogFooter>
						<Button
							isLoading={isPending}
							disabled={isPending}
							form="hook-form-update-server-ip"
							type="submit"
						>
							Update
						</Button>
					</DialogFooter>
				</Form>
			</DialogContent>
		</Dialog>
	);
};
