"use client";

import { EXTERNAL_LINKS, navGroups } from "@/lib/site-navigation";
import { cn } from "@/lib/utils";
import { Popover, Transition } from "@headlessui/react";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { Fragment, useEffect } from "react";
import { createPortal } from "react-dom";
import { Container } from "./Container";
import GithubStars from "./GithubStars";
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

function MobileNavLink({
	href,
	children,
	target,
}: {
	href: string;
	children: React.ReactNode;
	target?: string;
}) {
	return (
		<Popover.Button
			onClick={() => {
				trackGAEvent({
					action: "Nav Link Clicked",
					category: "Navigation",
					label: href,
				});
			}}
			as={Link}
			href={href}
			target={target}
			className="block w-full p-2"
		>
			{children}
		</Popover.Button>
	);
}

function MobileNavIcon({ open }: { open: boolean }) {
	return (
		<svg
			aria-hidden="true"
			className="h-3.5 w-3.5 overflow-visible stroke-muted-foreground"
			fill="none"
			strokeWidth={2}
			strokeLinecap="round"
		>
			<path
				d="M0 1H14M0 7H14M0 13H14"
				className={cn("origin-center transition", open && "scale-90 opacity-0")}
			/>
			<path
				d="M2 2L12 12M12 2L2 12"
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
						className="relative z-10 flex h-8 w-8 items-center justify-center ui-not-focus-visible:outline-none"
						aria-label="Toggle Navigation"
					>
						<MobileNavIcon open={open} />
					</Popover.Button>
					{open &&
						createPortal(
							<div
								className="fixed inset-0 z-40 bg-background/50"
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
								className="absolute inset-x-0 top-full mt-4 flex origin-top flex-col rounded-2xl border border-border bg-background p-4 text-lg tracking-tight text-primary shadow-xl ring-1 ring-border/5 max-h-[80vh] overflow-y-auto"
							>
								{navGroups.map((group, index) => (
									<div key={group.title}>
										{index > 0 && <hr className="m-2 border-border" />}
										<p className="px-2 py-1 text-xs font-semibold uppercase text-muted-foreground">
											{group.title}
										</p>
										{group.items.map((item) => (
											<MobileNavLink
												key={item.href}
												href={item.href}
												target={item.external ? "_blank" : undefined}
											>
												{item.label}
											</MobileNavLink>
										))}
									</div>
								))}
								<hr className="m-2 border-border" />
								<MobileNavLink href="/contact">Contact</MobileNavLink>
								<MobileNavLink href={EXTERNAL_LINKS.app} target="_blank">
									Sign In
								</MobileNavLink>
								<MobileNavLink href={EXTERNAL_LINKS.appRegister} target="_blank">
									<Button className="w-full" asChild>
										<div className="group relative mx-auto flex w-full max-w-fit flex-row items-center justify-center rounded-2xl text-sm font-medium">
											<span>Get Started</span>
											<ChevronRight className="ml-1 size-3 transition-transform duration-300 ease-in-out group-hover:translate-x-0.5" />
										</div>
									</Button>
								</MobileNavLink>
							</Popover.Panel>
						</Transition.Child>
					</Transition.Root>
				</>
			)}
		</Popover>
	);
}

function ListItem({
	className,
	title,
	href,
	target,
	children,
}: {
	className?: string;
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
					onClick={() =>
						trackGAEvent({
							action: "Nav Link Clicked",
							category: "Navigation",
							label: href,
						})
					}
					className={cn(
						"block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
						className,
					)}
				>
					<div className="text-sm font-medium leading-none">{title}</div>
					{children && (
						<p className="line-clamp-2 text-sm leading-snug text-muted-foreground">
							{children}
						</p>
					)}
				</Link>
			</NavigationMenuLink>
		</li>
	);
}

export function Header() {
	return (
		<header className="sticky top-0 z-50 border-b border-border/40 bg-background/95 py-5 backdrop-blur supports-[backdrop-filter]:bg-background/60">
			<Container>
				<nav className="relative z-50 flex justify-between">
					<div className="flex items-center md:gap-x-12">
						<Link href="/" aria-label="Home">
							<Logo className="h-10 w-auto" />
						</Link>
						<div className="hidden md:flex">
							<NavigationMenu>
								<NavigationMenuList>
									{navGroups.map((group) => (
										<NavigationMenuItem key={group.title}>
											<NavigationMenuTrigger>{group.title}</NavigationMenuTrigger>
											<NavigationMenuContent>
												<ul className="grid w-[260px] gap-1 p-2">
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

									<NavigationMenuItem>
										<NavigationMenuLink
											asChild
											className={navigationMenuTriggerStyle()}
										>
											<Link
												href={EXTERNAL_LINKS.docs}
												target="_blank"
												onClick={() =>
													trackGAEvent({
														action: "Nav Link Clicked",
														category: "Navigation",
														label: EXTERNAL_LINKS.docs,
													})
												}
											>
												Docs
											</Link>
										</NavigationMenuLink>
									</NavigationMenuItem>
								</NavigationMenuList>
							</NavigationMenu>
						</div>
					</div>
					<div className="flex items-center gap-x-4 md:gap-x-5">
						<GithubStars className="max-md:hidden" />

						<Button
							variant="ghost"
							className="rounded-full max-md:hidden"
							asChild
						>
							<Link
								href={EXTERNAL_LINKS.app}
								aria-label="Sign In Notploy Cloud"
								target="_blank"
							>
								Sign In
							</Link>
						</Button>

						<Button
							variant="outline"
							className="rounded-full max-md:hidden"
							asChild
						>
							<Link
								href="/contact"
								onClick={() => {
									trackGAEvent({
										action: "Contact Button Clicked",
										category: "Contact",
										label: "Header",
									});
								}}
							>
								Contact
							</Link>
						</Button>

						<Button className="rounded-full max-md:hidden" asChild>
							<Link
								href={EXTERNAL_LINKS.appRegister}
								aria-label="Get started with Notploy Cloud"
								target="_blank"
							>
								<div className="group relative mx-auto flex w-full max-w-fit flex-row items-center justify-center rounded-2xl text-sm font-medium">
									<span>Get Started</span>
									<ChevronRight className="ml-1 size-3 transition-transform duration-300 ease-in-out group-hover:translate-x-0.5" />
								</div>
							</Link>
						</Button>
						<div className="-mr-1 md:hidden">
							<MobileNavigation />
						</div>
					</div>
				</nav>
			</Container>
		</header>
	);
}
