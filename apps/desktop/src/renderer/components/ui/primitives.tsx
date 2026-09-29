/**
 * The desktop client's higher-level primitives.
 *
 * These are **thin compositions over the components ported from Notploy App**
 * (`./button`, `./card`, `./badge`, `./input`, `./table`, `./alert`, `./label`,
 * `./separator`, `./skeleton`). They exist for two reasons:
 *
 * 1. Every page already speaks this vocabulary (`Panel`, `PageHeader`,
 *    `EmptyState`, `ErrorNote`, …), so building it once here gives all of them
 *    the App's look without touching a single page.
 * 2. Some of it is genuinely desktop-specific: a one-line page header, an
 *    "empty vs. could-not-be-read" state, a failure block with a retry.
 *
 * The status chips deliberately reuse the App's own `green` / `yellow` / `red` /
 * `blue` / `blank` Badge variants rather than inventing a parallel colour scale,
 * so a "Running" chip here and a "Running" chip in the dashboard are the same
 * component with the same classes.
 */

import { AlertTriangle, Loader2 } from "lucide-react";
import type * as React from "react";
import { type BridgeFailure, failureHint } from "@/renderer/lib/bridge";
import { cn } from "@/renderer/lib/cn";
import type { Tone } from "@/shared/status";
import { Alert, AlertDescription, AlertTitle } from "./alert";
import { Badge } from "./badge";
import { Button } from "./button";
import { Card } from "./card";
import { Input } from "./input";
import { Skeleton } from "./skeleton";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "./table";

export type { InputProps } from "./input";
export { Button, Input };

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

/**
 * Tone → the App's Badge variant.
 *
 * `blank` is the neutral chip the dashboard uses for an unknown state, so
 * "muted" maps to it instead of to a custom grey.
 */
const TONE_BADGE = {
	ok: "green",
	warn: "yellow",
	danger: "red",
	info: "blue",
	muted: "blank",
} as const satisfies Record<
	Tone,
	"green" | "yellow" | "red" | "blue" | "blank"
>;

const TONE_DOT_CLASSES: Record<Tone, string> = {
	ok: "bg-emerald-500",
	warn: "bg-yellow-500",
	danger: "bg-red-500",
	info: "bg-blue-500",
	muted: "bg-muted-foreground",
};

export function StatusDot({ tone, pulse }: { tone: Tone; pulse?: boolean }) {
	return (
		<span
			aria-hidden
			className={cn(
				"inline-block size-2 shrink-0 rounded-full",
				TONE_DOT_CLASSES[tone],
				pulse && "animate-pulse",
			)}
		/>
	);
}

export function StatusBadge({
	label,
	tone,
	className,
}: {
	label: string;
	tone: Tone;
	className?: string;
}) {
	return (
		<Badge variant={TONE_BADGE[tone]} className={className}>
			{label}
		</Badge>
	);
}

// ---------------------------------------------------------------------------
// Surfaces
// ---------------------------------------------------------------------------

/** A panel is the App's Card: same fill, same ring, same radius. */
export function Panel({
	className,
	children,
	...props
}: React.ComponentProps<typeof Card>) {
	return (
		<Card className={className} {...props}>
			{children}
		</Card>
	);
}

export function PanelHeader({
	title,
	description,
	actions,
}: {
	title: string;
	description?: string;
	actions?: React.ReactNode;
}) {
	return (
		<div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
			<div className="min-w-0">
				<h2 className="text-sm font-medium text-foreground">{title}</h2>
				{description ? (
					<p className="mt-1 text-xs text-muted-foreground">{description}</p>
				) : null}
			</div>
			{actions ? <div className="flex shrink-0 gap-2">{actions}</div> : null}
		</div>
	);
}

// ---------------------------------------------------------------------------
// Page scaffolding
// ---------------------------------------------------------------------------

export function PageHeader({
	title,
	description,
	actions,
}: {
	title: string;
	description?: string;
	actions?: React.ReactNode;
}) {
	return (
		<header className="flex items-start justify-between gap-4 border-b border-border px-6 py-4">
			<div className="min-w-0">
				<h1 className="text-lg font-medium text-foreground">{title}</h1>
				{description ? (
					<p className="mt-1 max-w-3xl text-sm text-muted-foreground">
						{description}
					</p>
				) : null}
			</div>
			{actions ? <div className="flex shrink-0 gap-2">{actions}</div> : null}
		</header>
	);
}

/** The App's Skeleton, arranged as a short list of placeholder rows. */
export function LoadingState({ label = "Loading…" }: { label?: string }) {
	return (
		<div className="space-y-2 px-6 py-6" aria-busy="true" aria-live="polite">
			<div className="flex items-center gap-2 text-sm text-muted-foreground">
				<Loader2 aria-hidden className="size-4 animate-spin" />
				{label}
			</div>
			<div className="space-y-2 pt-2">
				<Skeleton className="h-9 w-full" />
				<Skeleton className="h-9 w-5/6" />
				<Skeleton className="h-9 w-4/6" />
			</div>
		</div>
	);
}

export function EmptyState({
	title,
	description,
	action,
	icon,
}: {
	title: string;
	description?: string;
	action?: React.ReactNode;
	icon?: React.ReactNode;
}) {
	return (
		<div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
			{icon ? <div className="text-muted-foreground">{icon}</div> : null}
			<div>
				<p className="text-sm font-medium text-foreground">{title}</p>
				{description ? (
					<p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
						{description}
					</p>
				) : null}
			</div>
			{action}
		</div>
	);
}

/**
 * A failure with a way forward, on the App's destructive Alert.
 *
 * Every page renders this instead of an empty list when a read fails, so
 * "nothing here" is never confused with "could not be read".
 */
export function ErrorNote({
	error,
	onRetry,
	className,
}: {
	error: BridgeFailure;
	onRetry?: () => void;
	className?: string;
}) {
	const hint = failureHint(error.code);
	return (
		<Alert variant="destructive" className={className}>
			<AlertTriangle aria-hidden />
			<AlertTitle>{error.message}</AlertTitle>
			<AlertDescription>
				{hint ? <span>{hint}</span> : null}
				{onRetry ? (
					<div className="mt-2">
						<Button size="sm" variant="outline" onClick={onRetry}>
							Retry
						</Button>
					</div>
				) : null}
			</AlertDescription>
		</Alert>
	);
}

// ---------------------------------------------------------------------------
// Form fields
// ---------------------------------------------------------------------------

export function Field({
	label,
	hint,
	htmlFor,
	children,
}: {
	label: string;
	hint?: string;
	htmlFor?: string;
	children: React.ReactNode;
}) {
	return (
		<div className="space-y-1.5">
			<label
				htmlFor={htmlFor}
				className="block text-xs font-medium text-muted-foreground"
			>
				{label}
			</label>
			{children}
			{hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
		</div>
	);
}

/**
 * Native controls on the App's tokens.
 *
 * The dashboard's `Select` and `Checkbox` are Radix components with a
 * composition API; porting them means rewriting every call site, which is
 * tracked in `docs/desktop/parity.md` rather than half-done here. These carry
 * the App's border, radius and focus-ring tokens, so they already look right.
 */
export function Select({
	className,
	children,
	...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
	return (
		<select
			className={cn(
				"h-10 w-full min-w-0 rounded-lg border border-input bg-transparent px-3 py-2 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 dark:bg-input/30",
				className,
			)}
			{...props}
		>
			{children}
		</select>
	);
}

export function Checkbox({
	label,
	description,
	...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
	label: string;
	description?: string;
}) {
	return (
		<label className="flex items-start gap-2.5 text-sm text-foreground">
			<input
				type="checkbox"
				className="mt-0.5 size-4 shrink-0 accent-primary"
				{...props}
			/>
			<span>
				{label}
				{description ? (
					<span className="mt-0.5 block text-xs text-muted-foreground">
						{description}
					</span>
				) : null}
			</span>
		</label>
	);
}

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

export function KeyValue({
	items,
	className,
}: {
	items: Array<{ label: string; value: React.ReactNode }>;
	className?: string;
}) {
	return (
		<dl className={cn("grid gap-x-6 gap-y-3 sm:grid-cols-2", className)}>
			{items.map((item) => (
				<div key={item.label} className="min-w-0">
					<dt className="text-xs text-muted-foreground">{item.label}</dt>
					<dd className="mt-0.5 truncate text-sm text-foreground">
						{item.value ?? "—"}
					</dd>
				</div>
			))}
		</dl>
	);
}

/** A scrollable monospace block, used for logs and JSON. */
export function CodeBlock({
	content,
	emptyLabel = "Nothing to show.",
	className,
}: {
	content: string;
	emptyLabel?: string;
	className?: string;
}) {
	if (!content.trim()) {
		return (
			<div className={cn("px-4 py-6 text-xs text-muted-foreground", className)}>
				{emptyLabel}
			</div>
		);
	}
	return (
		<pre
			className={cn(
				"max-h-96 overflow-auto rounded-b-xl bg-background px-4 py-3 font-mono text-xs leading-relaxed whitespace-pre-wrap break-words text-muted-foreground",
				className,
			)}
		>
			{content}
		</pre>
	);
}

/**
 * The App's Table, with the desktop's `TableShell`/`Th`/`Td`/`Tr` call shape.
 *
 * Keeping the shape means no page changes: `head` becomes the header row and the
 * children become the body.
 */
export function TableShell({
	head,
	children,
	className,
}: {
	head: React.ReactNode;
	children: React.ReactNode;
	className?: string;
}) {
	return (
		<div className={cn("overflow-auto", className)}>
			<Table>
				<TableHeader>
					<TableRow className="hover:bg-transparent">{head}</TableRow>
				</TableHeader>
				<TableBody>{children}</TableBody>
			</Table>
		</div>
	);
}

export function Th({
	children,
	className,
	...props
}: React.ThHTMLAttributes<HTMLTableCellElement>) {
	return (
		<TableHead className={className} {...props}>
			{children}
		</TableHead>
	);
}

export function Td({
	children,
	className,
	...props
}: React.TdHTMLAttributes<HTMLTableCellElement>) {
	return (
		<TableCell className={className} {...props}>
			{children}
		</TableCell>
	);
}

export function Tr({
	children,
	className,
	...props
}: React.HTMLAttributes<HTMLTableRowElement>) {
	return (
		<TableRow className={className} {...props}>
			{children}
		</TableRow>
	);
}
