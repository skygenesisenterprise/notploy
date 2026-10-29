"use client";

import { KeyRound, LayoutDashboard, LogOut, ScrollText } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";
import { cn } from "@/lib/utils";
import { AdminTokenProvider, useAdminToken } from "./admin-token-provider";
import { Button, Field, Input, Notice } from "./ui";

const NAV = [
	{ href: "/admin", label: "Pages", icon: LayoutDashboard },
	{ href: "/admin/tokens", label: "Tokens", icon: KeyRound },
	{ href: "/admin/audit", label: "Audit", icon: ScrollText },
];

const TokenGate = ({ onSubmit }: { onSubmit: (token: string) => void }) => {
	const [value, setValue] = React.useState("");
	return (
		<div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-4 px-4">
			<div className="flex flex-col gap-1">
				<h1 className="text-lg font-semibold">Administration</h1>
				<p className="text-sm text-muted-foreground">
					Paste a Notploy Status API token with the scopes you need. It is kept
					only in this browser.
				</p>
			</div>
			<form
				onSubmit={(event) => {
					event.preventDefault();
					if (value.trim()) {
						onSubmit(value.trim());
					}
				}}
				className="flex flex-col gap-3"
			>
				<Field
					label="API token"
					hint="Bootstrap one with: pnpm --filter @notploy/status token:create -- --name Admin --scopes admin"
				>
					<Input
						type="password"
						value={value}
						onChange={(event) => setValue(event.target.value)}
						placeholder="nps_…"
						autoComplete="off"
						spellCheck={false}
					/>
				</Field>
				<Button
					type="submit"
					variant="primary"
					disabled={value.trim().length === 0}
				>
					Continue
				</Button>
			</form>
			<Notice tone="info">
				The credential never leaves your browser: every request goes straight to
				the status API.
			</Notice>
		</div>
	);
};

const AdminFrame = ({ children }: { children: React.ReactNode }) => {
	const { token, setToken, ready } = useAdminToken();
	const pathname = usePathname();

	if (!ready) {
		return (
			<div className="grid min-h-dvh place-items-center text-sm text-muted-foreground">
				Loading administration…
			</div>
		);
	}
	if (!token) {
		return <TokenGate onSubmit={setToken} />;
	}

	return (
		<div className="mx-auto flex w-full max-w-5xl flex-col px-4 sm:px-6">
			<header className="flex flex-wrap items-center justify-between gap-4 border-b border-border py-5">
				<Link href="/admin" className="font-semibold">
					Administration
				</Link>
				<nav className="flex items-center gap-1 text-sm">
					{NAV.map((item) => {
						const active =
							pathname === item.href ||
							(item.href !== "/admin" && pathname.startsWith(item.href));
						const Icon = item.icon;
						return (
							<Link
								key={item.href}
								href={item.href}
								className={cn(
									"inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 transition-colors",
									active
										? "bg-secondary text-foreground"
										: "text-muted-foreground hover:bg-secondary hover:text-foreground",
								)}
							>
								<Icon className="size-4" aria-hidden="true" />
								{item.label}
							</Link>
						);
					})}
				</nav>
				<div className="flex items-center gap-3">
					<Link
						href="/"
						className="text-sm text-muted-foreground transition-colors hover:text-foreground"
					>
						View status
					</Link>
					<Button variant="ghost" onClick={() => setToken(null)}>
						<LogOut className="size-4" aria-hidden="true" />
						Sign out
					</Button>
				</div>
			</header>
			<main className="flex flex-col gap-8 py-8">{children}</main>
		</div>
	);
};

export const AdminShell = ({ children }: { children: React.ReactNode }) => (
	<AdminTokenProvider>
		<AdminFrame>{children}</AdminFrame>
	</AdminTokenProvider>
);
