"use client";

import { links } from "@/lib/content/links";
import { navGroups, resourceNav } from "@/lib/site-navigation";
import { cn } from "@/lib/utils";
import { Popover, Transition } from "@headlessui/react";
import { ArrowUpRight, ChevronRight } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment, useEffect } from "react";
import { createPortal } from "react-dom";
import { Container } from "./Container";
import { trackGAEvent } from "./analitycs";
import { Logo } from "./shared/Logo";
import { Button } from "./ui/button";
import {
	NavigationMenu,
	NavigationMenuContent,
	NavigationMenuItem,
	NavigationMenuLink,
	NavigationMenuList,
	NavigationMenuTrigger,
	navigationMenuTriggerStyle,
} from "./ui/navigation-menu";

const RESOURCE_LINKS = resourceNav;
const MOBILE_GROUPS = navGroups;

function MobileNavLink({
	href,
	children,
	target,
	onNavigate,
}: {
	href: string;
	children: React.ReactNode;
	target?: string;
	onNavigate: () => void;
}) {
	return (
		<Popover.Button
			onClick={() => {
				onNavigate();
				trackGAEvent({
					action: "Nav Link Clicked",
					category: "Navigation",
					label: href,
				});
			}}
			as={Link}
			href={href}
			target={target}
			className="block w-full rounded-lg p-2.5 text-base text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
		>
			{children}
		</Popover.Button>
	);
}

function MobileNavIcon({ open }: { open: boolean }) {
	return (
		<svg
			aria-hidden="true"
			className="h-4 w-4 overflow-visible stroke-current"
			fill="none"
			strokeWidth={1.75}
			strokeLinecap="round"
		>
			<path
				d="M0 1H16M0 8H16M0 15H16"
				className={cn("origin-center transition", open && "scale-90 opacity-0")}
			/>
			<path
				d="M2 2L14 14M14 2L2 14"
				className={cn(
					"origin-center transition",
					!open && "scale-90 opacity-0",
				)}
			/>
		</svg>
	);
}

function BodyScrollLock({ lock }: { lock: boolean }) {
	useEffect(() => {
		document.body.style.overflow = lock ? "hidden" : "";
		return () => {
			document.body.style.overflow = "";
		};
	}, [lock]);
	return null;
}

function MobileNavigation() {
	return (
		<Popover>
			{({ open, close }) => (
				<>
					<BodyScrollLock lock={open} />
					<Popover.Button
						className="relative z-10 flex h-9 w-9 items-center justify-center rounded-full border border-border/60 text-foreground transition-colors hover:border-border ui-not-focus-visible:outline-none lg:hidden"
						aria-label="Toggle navigation"
					>
						<MobileNavIcon open={open} />
					</Popover.Button>
					{open &&
						createPortal(
							<div
								className="fixed inset-0 z-40 bg-background/60 backdrop-blur-sm"
								onClick={() => close()}
							/>,
							document.body,
						)}
					<Transition.Root>
						<Transition.Child
							as={Fragment as any}
							enter="duration-150 ease-out"
							enterFrom="opacity-0 scale-95"
							enterTo="opacity-100 scale-100"
							leave="duration-100 ease-in"
							leaveFrom="opacity-100 scale-100"
							leaveTo="opacity-0 scale-95"
						>
							<Popover.Panel
								as="div"
								className="absolute inset-x-0 top-full z-50 mt-3 flex max-h-[80vh] origin-top flex-col overflow-y-auto rounded-2xl border border-border/60 bg-card p-3 shadow-xl"
							>
								{MOBILE_GROUPS.map((group) => (
									<div key={group.title} className="py-1">
										<p className="px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
											{group.title}
										</p>
										{group.items.map((item) => (
											<MobileNavLink
												key={item.href}
												href={item.href}
												target={item.external ? "_blank" : undefined}
												onNavigate={close}
											>
												{item.label}
											</MobileNavLink>
										))}
									</div>
								))}
								<div className="py-1">
									<p className="px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
										Resources
									</p>
									{RESOURCE_LINKS.map((item) => (
										<MobileNavLink
											key={item.href}
											href={item.href}
											target={item.external ? "_blank" : undefined}
											onNavigate={close}
										>
											{item.label}
										</MobileNavLink>
									))}
								</div>
								<div className="mt-2 grid gap-2 border-t border-border/60 pt-3">
									<Button variant="outline" className="w-full rounded-full" asChild>
										<Link
											href={links.app.signIn}
											target="_blank"
											rel="noreferrer"
											onClick={close}
										>
											Sign in
										</Link>
									</Button>
									<Button className="w-full rounded-full" asChild>
										<Link href="/self" onClick={close}>
											Get started
											<ChevronRight className="ml-1 h-4 w-4" aria-hidden="true" />
										</Link>
									</Button>
								</div>
							</Popover.Panel>
						</Transition.Child>
					</Transition.Root>
				</>
			)}
		</Popover>
	);
}

function ListItem({
	title,
	href,
	target,
	children,
}: {
	title: string;
	href: string;
	target?: string;
	children?: React.ReactNode;
}) {
	return (
		<li>
			<NavigationMenuLink asChild>
				<Link
					href={href}
					target={target}
					rel={target === "_blank" ? "noreferrer" : undefined}
					onClick={() =>
						trackGAEvent({
							action: "Nav Link Clicked",
							category: "Navigation",
							label: href,
						})
					}
					className="block select-none space-y-1 rounded-lg p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
				>
					<div className="text-sm font-medium leading-none text-foreground">
						{title}
					</div>
					{children && (
						<p className="text-sm leading-snug text-muted-foreground">
							{children}
						</p>
					)}
				</Link>
			</NavigationMenuLink>
		</li>
	);
}

export function Header() {
	const pathname = usePathname();

	return (
		<header className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/60">
			<Container>
				<nav
					aria-label="Main"
					className="relative z-50 flex h-16 items-center justify-between gap-4"
				>
					{/* Brand */}
					<Link
						href="/"
						aria-label="Notploy home"
						className="flex shrink-0 items-center gap-2.5"
					>
						<Logo className="h-7 w-7" />
						<span className="font-display text-lg font-semibold tracking-tight text-foreground">
							Notploy
						</span>
					</Link>

					{/* Navigation */}
					<div className="hidden items-center lg:flex">
						<NavigationMenu>
							<NavigationMenuList className="gap-1">
								{navGroups.map((group) => (
									<NavigationMenuItem key={group.title}>
										<NavigationMenuTrigger className="h-9 rounded-full bg-transparent px-3 text-sm text-muted-foreground hover:bg-accent hover:text-foreground data-[state=open]:bg-accent/60">
											{group.title}
										</NavigationMenuTrigger>
										<NavigationMenuContent>
											<ul
												className={cn(
													"grid gap-1 p-2",
													group.columns === 2
														? "w-[560px] grid-cols-2"
														: "w-[300px]",
												)}
											>
												{group.items.map((item) => (
													<ListItem
														key={item.href}
														href={item.href}
														title={item.label}
														target={item.external ? "_blank" : undefined}
													>
														{item.description}
													</ListItem>
												))}
											</ul>
										</NavigationMenuContent>
									</NavigationMenuItem>
								))}

								<span className="mx-1 h-4 w-px bg-border" aria-hidden="true" />

								{RESOURCE_LINKS.map((link) => (
									<NavigationMenuItem key={link.href}>
										<NavigationMenuLink asChild>
											<Link
												href={link.href}
												target={link.external ? "_blank" : undefined}
												rel={link.external ? "noreferrer" : undefined}
												className={cn(
													navigationMenuTriggerStyle(),
													"h-9 gap-1 rounded-full bg-transparent px-3 text-sm text-muted-foreground",
												)}
											>
												{link.label}
												{link.external && (
													<ArrowUpRight
														className="h-3.5 w-3.5"
														aria-hidden="true"
													/>
												)}
											</Link>
										</NavigationMenuLink>
									</NavigationMenuItem>
								))}
							</NavigationMenuList>
						</NavigationMenu>
					</div>

					{/* Actions */}
					<div className="flex shrink-0 items-center gap-2">
						<Button
							variant="ghost"
							className="rounded-full max-lg:hidden"
							asChild
						>
							<Link
								href={links.app.signIn}
								aria-label="Sign in to your Notploy instance"
								target="_blank"
								rel="noreferrer"
							>
								Sign in
							</Link>
						</Button>
						<Button className="rounded-full max-lg:hidden" asChild>
							<Link href="/self" aria-label="Get started with Notploy Self">
								<span className="inline-flex items-center">
									Get started
									<ChevronRight
										className="ml-1 h-4 w-4 transition-transform duration-200 group-hover/button:translate-x-0.5"
										aria-hidden="true"
									/>
								</span>
							</Link>
						</Button>
						<MobileNavigation />
					</div>
				</nav>
			</Container>
		</header>
	);
}
