"use client";
import {
	ArrowUpRight,
	Bell,
	ChevronsUpDown,
	Loader2,
	Star,
	Trash2,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { TruncateTooltip } from "@/components/shared/truncate-tooltip";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@/components/ui/command";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import {
	SIDEBAR_COOKIE_NAME,
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarInset,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarProvider,
	SidebarRail,
	SidebarTrigger,
	useSidebar,
} from "@/components/ui/sidebar";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { api } from "@/utils/api";
import { TrialBanner } from "../dashboard/billing/trial-banner";
import { AddOrganization } from "../dashboard/organization/handle-organization";
import { DialogAction } from "../shared/dialog-action";
import { Logo } from "../shared/logo";
import { Button } from "../ui/button";
import { TimeBadge } from "../ui/time-badge";
import {
	createNavigation,
	findActiveNavigation,
	isActiveRoute,
	type Navigation,
} from "./navigation";
import { UpdateServerButton } from "./update-server";
import { UserNav } from "./user-nav";

/**
 * Renders the declarative navigation as a flat list of titled sections.
 *
 * Sections are plain headings (never collapsible): Notploy now exposes many
 * more areas than a deployment centric menu did, and the whole point of the
 * hierarchy is that the entire platform stays readable at a glance.
 */
function SidebarNavigation({
	navigation,
	pathname,
	currentTab,
}: {
	navigation: Navigation;
	pathname: string;
	currentTab?: string;
}) {
	return (
		<>
			{navigation.sections.map((section) => (
				<SidebarGroup key={section.id} className="pb-1 pt-1 first:pt-0">
					<SidebarGroupLabel className="h-6 cursor-default px-2 text-[11px] font-semibold tracking-wider text-muted-foreground/70 uppercase">
						{section.label}
					</SidebarGroupLabel>
					<SidebarMenu className="gap-0.5">
						{section.items.map((item) => {
							const isActive = isActiveRoute({
								itemUrl: item.href,
								pathname,
								activeTab: item.activeTab,
								currentTab,
							});

							return (
								<SidebarMenuItem key={item.href}>
									<SidebarMenuButton
										asChild
										tooltip={item.label}
										isActive={isActive}
										className={cn(isActive && "bg-border")}
									>
										<Link
											href={item.href}
											className="flex w-full items-center gap-2"
										>
											<item.icon
												aria-hidden
												className={cn(
													"size-4 shrink-0",
													isActive ? "text-primary" : "text-muted-foreground",
												)}
											/>
											<span className="truncate">{item.label}</span>
										</Link>
									</SidebarMenuButton>
								</SidebarMenuItem>
							);
						})}
					</SidebarMenu>
				</SidebarGroup>
			))}
		</>
	);
}

interface Props {
	children: React.ReactNode;
}

function LogoWrapper() {
	return <SidebarLogo />;
}

function SidebarLogo() {
	const { state } = useSidebar();
	const { data: isCloud } = api.settings.isCloud.useQuery();
	const { data: user } = api.user.get.useQuery();
	const { data: session } = api.user.session.useQuery();
	const {
		data: organizations,
		refetch,
		isLoading,
	} = api.organization.all.useQuery();
	const { mutateAsync: deleteOrganization, isPending: isRemoving } =
		api.organization.delete.useMutation();
	const { mutateAsync: setDefaultOrganization, isPending: isSettingDefault } =
		api.organization.setDefault.useMutation();
	const { isMobile } = useSidebar();
	const isCollapsed = state === "collapsed" && !isMobile;
	const { data: activeOrganization } = api.organization.active.useQuery();

	const { data: invitations, refetch: refetchInvitations } =
		api.user.getInvitations.useQuery();

	const [_activeTeam, setActiveTeam] = useState<
		typeof activeOrganization | null
	>(null);
	const [organizationSelectorOpen, setOrganizationSelectorOpen] =
		useState(false);

	useEffect(() => {
		if (activeOrganization) {
			setActiveTeam(activeOrganization);
		}
	}, [activeOrganization]);

	return (
		<>
			{isLoading ? (
				<div className="flex flex-row gap-2 items-center justify-center text-sm text-muted-foreground min-h-[5vh] pt-4">
					<Loader2 className="animate-spin size-4" />
				</div>
			) : (
				<SidebarMenu
					className={cn(
						"flex gap-2",
						isCollapsed ? "flex-col" : "flex-row justify-between items-center",
					)}
				>
					{/* Organization Logo and Selector */}
					<SidebarMenuItem className={"w-full min-w-0"}>
						<Popover
							open={organizationSelectorOpen}
							onOpenChange={setOrganizationSelectorOpen}
						>
							<PopoverTrigger asChild>
								<SidebarMenuButton
									size={isCollapsed ? "sm" : "lg"}
									className={cn(
										"data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground",
										isCollapsed &&
											"flex justify-center items-center p-2 h-10 w-10 mx-auto",
									)}
								>
									<div
										className={cn(
											"flex min-w-0 flex-1 items-center gap-2",
											isCollapsed && "justify-center",
										)}
									>
										<div
											className={cn(
												"flex size-6 shrink-0 items-center justify-center rounded-sm border",
											)}
										>
											<Logo
												className={cn(
													"transition-all",
													isCollapsed ? "size-4" : "size-5",
												)}
												logoUrl={activeOrganization?.logo || undefined}
											/>
										</div>
										<div
											className={cn(
												"flex flex-col items-start min-w-0 flex-1",
												isCollapsed && "hidden",
											)}
										>
											<div className="flex items-center gap-1.5 min-w-0 w-full">
												<TruncateTooltip
													text={
														activeOrganization?.name ?? "Select Organization"
													}
													className="text-sm font-medium"
												/>
											</div>
										</div>
									</div>
									<ChevronsUpDown
										className={cn("ml-auto shrink-0", isCollapsed && "hidden")}
									/>
								</SidebarMenuButton>
							</PopoverTrigger>
							<PopoverContent
								className="w-96 p-0"
								align="start"
								side={isMobile ? "bottom" : "right"}
								sideOffset={4}
							>
								<Command>
									<CommandInput
										placeholder="Search organizations..."
										className="h-9"
									/>
									<CommandList className="max-h-[min(60vh,24rem)]">
										<CommandEmpty>No organizations found.</CommandEmpty>
										<CommandGroup heading="Organizations">
											{organizations?.map((org) => {
												const isDefault = org.members?.[0]?.isDefault ?? false;
												return (
													<CommandItem
														key={org.id}
														value={org.name}
														onSelect={async () => {
															setOrganizationSelectorOpen(false);
															await authClient.organization.setActive({
																organizationId: org.id,
															});
															window.location.reload();
														}}
														className="flex items-center justify-between gap-1"
													>
														<div className="flex min-w-0 flex-1 items-center gap-2">
															<div className="flex size-6 shrink-0 items-center justify-center rounded-sm border">
																<Logo
																	className={cn(
																		"transition-all",
																		state === "collapsed" ? "size-4" : "size-5",
																	)}
																	logoUrl={org.logo ?? undefined}
																/>
															</div>
															<span className="truncate">{org.name}</span>
														</div>

														<div
															className="flex shrink-0 items-center gap-2"
															onClick={(e) => e.stopPropagation()}
															onKeyDown={(e) => e.stopPropagation()}
														>
															<Button
																variant="ghost"
																size="icon"
																className={cn(
																	"group",
																	isDefault
																		? "hover:bg-yellow-500/10"
																		: "hover:bg-blue-500/10",
																)}
																isLoading={isSettingDefault && !isDefault}
																disabled={isDefault}
																onClick={async (e) => {
																	if (isDefault) return;
																	e.stopPropagation();
																	await setDefaultOrganization({
																		organizationId: org.id,
																	})
																		.then(() => {
																			refetch();
																			toast.success(
																				"Default organization updated",
																			);
																		})
																		.catch((error) => {
																			toast.error(
																				error?.message ||
																					"Error setting default organization",
																			);
																		});
																}}
																title={
																	isDefault
																		? "Default organization"
																		: "Set as default"
																}
															>
																{isDefault ? (
																	<Star
																		fill="#eab308"
																		stroke="#eab308"
																		className="size-4 text-yellow-500"
																	/>
																) : (
																	<Star
																		fill="none"
																		stroke="currentColor"
																		className="size-4 text-gray-400 group-hover:text-blue-500 transition-colors"
																	/>
																)}
															</Button>
															{org.ownerId === session?.user?.id && (
																<>
																	<AddOrganization organizationId={org.id} />
																	<DialogAction
																		title="Delete Organization"
																		description="Are you sure you want to delete this organization?"
																		type="destructive"
																		onClick={async () => {
																			await deleteOrganization({
																				organizationId: org.id,
																			})
																				.then(() => {
																					refetch();
																					toast.success(
																						"Organization deleted successfully",
																					);
																				})
																				.catch((error) => {
																					toast.error(
																						error?.message ||
																							"Error deleting organization",
																					);
																				});
																		}}
																	>
																		<Button
																			variant="ghost"
																			size="icon"
																			className="group hover:bg-red-500/10"
																			isLoading={isRemoving}
																		>
																			<Trash2 className="size-4 text-primary group-hover:text-red-500" />
																		</Button>
																	</DialogAction>
																</>
															)}
														</div>
													</CommandItem>
												);
											})}
										</CommandGroup>
									</CommandList>
									{(user?.role === "owner" ||
										user?.role === "admin" ||
										isCloud) && (
										<div className="border-t p-1">
											<AddOrganization />
										</div>
									)}
								</Command>
							</PopoverContent>
						</Popover>
					</SidebarMenuItem>

					{/* Notification Bell */}
					<SidebarMenuItem className={cn(isCollapsed && "mt-2")}>
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button
									variant="ghost"
									size="icon"
									className={cn(
										"relative",
										isCollapsed && "h-8 w-8 p-1.5 mx-auto",
									)}
								>
									<Bell className="size-4" />
									{invitations && invitations.length > 0 && (
										<span className="absolute top-0 right-0 flex size-4 items-center justify-center rounded-full bg-blue-500 text-xs text-white">
											{invitations.length}
										</span>
									)}
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent
								align="start"
								side={"right"}
								className="w-80"
							>
								<DropdownMenuLabel>Pending Invitations</DropdownMenuLabel>
								<div className="flex flex-col gap-2">
									{invitations && invitations.length > 0 ? (
										invitations.map((invitation) => (
											<div key={invitation.id} className="flex flex-col gap-2">
												<DropdownMenuItem
													className="flex flex-col items-start gap-1 p-3"
													onSelect={(e) => e.preventDefault()}
												>
													<div className="font-medium">
														{invitation?.organization?.name}
													</div>
													<div className="text-xs text-muted-foreground">
														Expires:{" "}
														{new Date(invitation.expiresAt).toLocaleString()}
													</div>
													<div className="text-xs text-muted-foreground">
														Role: {invitation.role}
													</div>
												</DropdownMenuItem>
												<DialogAction
													title="Accept Invitation"
													description="Are you sure you want to accept this invitation?"
													type="default"
													onClick={async () => {
														const { error } =
															await authClient.organization.acceptInvitation({
																invitationId: invitation.id,
															});

														if (error) {
															toast.error(
																error.message || "Error accepting invitation",
															);
														} else {
															toast.success("Invitation accepted successfully");
															await refetchInvitations();
															await refetch();
														}
													}}
												>
													<Button size="sm" variant="secondary">
														Accept Invitation
													</Button>
												</DialogAction>
											</div>
										))
									) : (
										<DropdownMenuItem disabled>
											No pending invitations
										</DropdownMenuItem>
									)}
								</div>
							</DropdownMenuContent>
						</DropdownMenu>
					</SidebarMenuItem>
				</SidebarMenu>
			)}
		</>
	);
}

function MobileCloser() {
	const pathname = usePathname();
	const { setOpenMobile, isMobile } = useSidebar();

	useEffect(() => {
		if (isMobile) {
			setOpenMobile(false);
		}
	}, [pathname, isMobile, setOpenMobile]);

	return null;
}

export default function Page({ children }: Props) {
	const [defaultOpen, setDefaultOpen] = useState<boolean | undefined>(
		undefined,
	);
	const [isLoaded, setIsLoaded] = useState(false);

	useEffect(() => {
		const cookieValue = document.cookie
			.split("; ")
			.find((row) => row.startsWith(`${SIDEBAR_COOKIE_NAME}=`))
			?.split("=")[1];

		setDefaultOpen(cookieValue === undefined ? true : cookieValue === "true");
		setIsLoaded(true);
	}, []);

	const pathname = usePathname();
	const router = useRouter();
	const { data: auth } = api.user.get.useQuery();
	const { data: permissions } = api.user.getPermissions.useQuery();
	const { data: notployVersion } = api.settings.getNotployVersion.useQuery();
	const { data: whitelabeling } = api.whitelabeling.get.useQuery(undefined, {
		staleTime: 5 * 60 * 1000,
		refetchOnWindowFocus: false,
	});

	const includesProjects = pathname?.includes("/dashboard/project");
	const { data: isCloud } = api.settings.isCloud.useQuery();

	const navigation = createNavigation({
		// Self-hosted Notploy exposes the infrastructure control plane layout,
		// the hosted product keeps its deployment centric menu untouched.
		variant: isCloud ? "cloud" : "selfHosted",
		auth,
		permissions,
		isCloud: !!isCloud,
		whitelabeling,
	});

	// Several entries share a page and only differ by `?tab=` (the Docker
	// resources, the overview tabs), so the tab is part of the location.
	const currentTab =
		typeof router.query.tab === "string" ? router.query.tab : undefined;

	const activeNavigation = findActiveNavigation(navigation, {
		pathname,
		tab: currentTab,
	});

	if (!isLoaded) {
		return <div className="w-full h-screen bg-background" />; // Placeholder mientras se carga
	}

	return (
		<SidebarProvider
			defaultOpen={defaultOpen}
			open={defaultOpen}
			onOpenChange={(open) => {
				setDefaultOpen(open);

				// biome-ignore lint/suspicious/noDocumentCookie: this sets the cookie to keep the sidebar state.
				document.cookie = `${SIDEBAR_COOKIE_NAME}=${open}`;
			}}
			style={
				{
					"--sidebar-width": "19.5rem",
					"--sidebar-width-mobile": "19.5rem",
				} as React.CSSProperties
			}
		>
			<MobileCloser />
			<Sidebar collapsible="icon" variant="floating">
				<SidebarHeader>
					{/* <SidebarMenuButton
						className="group-data-[collapsible=icon]:p-0!"
						size="lg"
					> */}
					<LogoWrapper />
					{/* </SidebarMenuButton> */}
				</SidebarHeader>
				<SidebarContent>
					<SidebarNavigation
						navigation={navigation}
						pathname={pathname}
						currentTab={currentTab}
					/>
					{/* Links leaving the platform (docs, community). They carry an
					    outbound indicator so it is obvious they open in a new tab. */}
					<SidebarGroup className="group-data-[collapsible=icon]:hidden">
						<SidebarGroupLabel className="h-6 cursor-default px-2 text-[11px] font-semibold tracking-wider text-muted-foreground/70 uppercase">
							Resources
						</SidebarGroupLabel>
						<SidebarMenu className="gap-0.5">
							{navigation.external.map((item) => (
								<SidebarMenuItem key={item.label}>
									<SidebarMenuButton asChild tooltip={item.label}>
										<a
											href={item.href}
											target="_blank"
											rel="noopener noreferrer"
											className="group/external flex w-full items-center gap-2"
										>
											<item.icon
												aria-hidden
												className="size-4 shrink-0 text-muted-foreground"
											/>
											<span className="truncate">{item.label}</span>
											<ArrowUpRight
												aria-hidden
												className="ml-auto size-3.5 shrink-0 text-muted-foreground/60 transition-colors group-hover/external:text-primary"
											/>
										</a>
									</SidebarMenuButton>
								</SidebarMenuItem>
							))}
						</SidebarMenu>
					</SidebarGroup>
				</SidebarContent>{" "}
				<SidebarFooter>
					<SidebarMenu className="flex flex-col gap-2">
						{!isCloud && permissions?.organization.update && (
							<SidebarMenuItem>
								<UpdateServerButton />
							</SidebarMenuItem>
						)}
						<SidebarMenuItem>
							<UserNav />
						</SidebarMenuItem>
						{whitelabeling?.footerText && (
							<div className="px-3 text-xs text-muted-foreground text-center group-data-[collapsible=icon]:hidden">
								{whitelabeling.footerText}
							</div>
						)}
						{notployVersion && (
							<div className="px-3 text-xs text-muted-foreground text-center group-data-[collapsible=icon]:hidden">
								Version {notployVersion}
							</div>
						)}
					</SidebarMenu>
				</SidebarFooter>
				<SidebarRail />
			</Sidebar>
			<SidebarInset>
				{isCloud === true && <TrialBanner />}
				{!includesProjects && (
					<header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
						<div className="flex items-center justify-between w-full px-4">
							<div className="flex items-center gap-2">
								<SidebarTrigger className="-ml-1" />
								<Separator orientation="vertical" className="mr-2 h-4" />
								<Breadcrumb>
									<BreadcrumbList>
										{activeNavigation ? (
											activeNavigation.section.label ===
											activeNavigation.item.label ? (
												<BreadcrumbItem>
													<BreadcrumbLink asChild>
														<Link
															href={activeNavigation.item.href}
															className="flex items-center gap-1.5"
														>
															{activeNavigation.item.label}
														</Link>
													</BreadcrumbLink>
												</BreadcrumbItem>
											) : (
												// The crumb reflects the conceptual model
												// ("Infrastructure / Servers"), not the technical
												// route, which still lives under
												// /dashboard/settings.
												<>
													<BreadcrumbItem>
														<BreadcrumbLink asChild>
															<Link
																href={
																	activeNavigation.section.items[0]?.href ??
																	activeNavigation.item.href
																}
																className="flex items-center gap-1.5"
															>
																{activeNavigation.section.label}
															</Link>
														</BreadcrumbLink>
													</BreadcrumbItem>
													<BreadcrumbSeparator />
													<BreadcrumbItem>
														<BreadcrumbLink asChild>
															<Link
																href={activeNavigation.item.href}
																className="flex items-center gap-1.5"
															>
																{activeNavigation.item.label}
															</Link>
														</BreadcrumbLink>
													</BreadcrumbItem>
												</>
											)
										) : null}
									</BreadcrumbList>
								</Breadcrumb>{" "}
							</div>
							{!isCloud && <TimeBadge />}
						</div>
					</header>
				)}

				<div className="flex flex-col w-full p-4 pt-0">{children}</div>
			</SidebarInset>
		</SidebarProvider>
	);
}
