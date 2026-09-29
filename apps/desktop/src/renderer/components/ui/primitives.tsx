/**
 * The desktop client's UI primitives.
 *
 * Deliberately small and dependency-free beyond `cn`: the web dashboard owns the
 * full component library, and copying it wholesale into the desktop bundle would
 * duplicate a design system that is still moving. What lives here is the subset
 * the desktop actually renders — buttons, panels, status badges, form fields and
 * the four states every data view needs (loading, empty, error, ready).
 */

import { AlertTriangle, Loader2 } from "lucide-react";
import type * as React from "react";
import { type BridgeFailure, failureHint } from "@/renderer/lib/bridge";
import { cn } from "@/renderer/lib/cn";
import {
	TONE_CLASSES,
	TONE_DOT_CLASSES,
	type Tone,
} from "@/renderer/lib/format";

// ---------------------------------------------------------------------------
// Button
// ---------------------------------------------------------------------------

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

export interface ButtonProps
	extends React.ButtonHTMLAttributes<HTMLButtonElement> {
	variant?: ButtonVariant;
	size?: "sm" | "md";
	/** Shows a spinner and blocks further clicks. */
	busy?: boolean;
}

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
	primary:
		"bg-accent text-canvas hover:bg-accent-hover disabled:hover:bg-accent",
	secondary:
		"border border-border bg-surface-raised text-content hover:bg-surface-hover",
	ghost:
		"text-content-muted hover:bg-surface-hover hover:text-content border border-transparent",
	danger:
		"border border-danger/40 bg-danger-soft text-danger hover:bg-danger/20",
};

export function Button({
	variant = "secondary",
	size = "md",
	busy = false,
	className,
	disabled,
	children,
	...props
}: ButtonProps) {
	return (
		<button
			type="button"
			disabled={disabled || busy}
			className={cn(
				"inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
				size === "sm" ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm",
				BUTTON_VARIANTS[variant],
				className,
			)}
			{...props}
		>
			{busy ? <Loader2 aria-hidden className="size-3.5 animate-spin" /> : null}
			{children}
		</button>
	);
}

// ---------------------------------------------------------------------------
// Panel
// ---------------------------------------------------------------------------

export function Panel({
	className,
	children,
	...props
}: React.HTMLAttributes<HTMLDivElement>) {
	return (
		<div
			className={cn("rounded-lg border border-border bg-surface", className)}
			{...props}
		>
			{children}
		</div>
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
		<div className="flex items-start justify-between gap-4 border-b border-border px-4 py-3">
			<div>
				<h2 className="text-sm font-semibold text-content">{title}</h2>
				{description ? (
					<p className="mt-0.5 text-xs text-content-muted">{description}</p>
				) : null}
			</div>
			{actions ? <div className="flex shrink-0 gap-2">{actions}</div> : null}
		</div>
	);
}

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

export function StatusDot({ tone, pulse }: { tone: Tone; pulse?: boolean }) {
	return (
		<span
			aria-hidden
			className={cn(
				"inline-block size-2 rounded-full",
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
		<span
			className={cn(
				"inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium",
				TONE_CLASSES[tone],
				className,
			)}
		>
			<StatusDot tone={tone} />
			{label}
		</span>
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
			<div>
				<h1 className="text-lg font-semibold text-content">{title}</h1>
				{description ? (
					<p className="mt-1 max-w-3xl text-sm text-content-muted">
						{description}
					</p>
				) : null}
			</div>
			{actions ? <div className="flex shrink-0 gap-2">{actions}</div> : null}
		</header>
	);
}

export function LoadingState({ label = "Loading…" }: { label?: string }) {
	return (
		<div className="flex items-center gap-2 px-6 py-8 text-sm text-content-muted">
			<Loader2 aria-hidden className="size-4 animate-spin" />
			{label}
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
			{icon ? <div className="text-content-subtle">{icon}</div> : null}
			<div>
				<p className="text-sm font-medium text-content">{title}</p>
				{description ? (
					<p className="mx-auto mt-1 max-w-md text-xs text-content-muted">
						{description}
					</p>
				) : null}
			</div>
			{action}
		</div>
	);
}

/**
 * A failure with a way forward. Every page renders this instead of an empty
 * list when a read fails, so "nothing here" is never confused with "could not
 * be read".
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
		<div
			className={cn(
				"flex items-start gap-3 rounded-md border border-danger/30 bg-danger-soft/60 px-3 py-2.5",
				className,
			)}
			role="alert"
		>
			<AlertTriangle
				aria-hidden
				className="mt-0.5 size-4 shrink-0 text-danger"
			/>
			<div className="min-w-0 flex-1">
				<p className="text-sm text-content">{error.message}</p>
				{hint ? (
					<p className="mt-1 text-xs text-content-muted">{hint}</p>
				) : null}
			</div>
			{onRetry ? (
				<Button size="sm" variant="ghost" onClick={onRetry}>
					Retry
				</Button>
			) : null}
		</div>
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
				className="block text-xs font-medium text-content-muted"
			>
				{label}
			</label>
			{children}
			{hint ? <p className="text-xs text-content-subtle">{hint}</p> : null}
		</div>
	);
}

export function Input({
	className,
	...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
	return (
		<input
			className={cn(
				"w-full rounded-md border border-border bg-canvas px-2.5 py-1.5 text-sm text-content placeholder:text-content-subtle focus:border-accent focus:outline-none",
				className,
			)}
			{...props}
		/>
	);
}

export function Select({
	className,
	children,
	...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
	return (
		<select
			className={cn(
				"w-full rounded-md border border-border bg-canvas px-2.5 py-1.5 text-sm text-content focus:border-accent focus:outline-none",
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
		<label className="flex items-start gap-2.5 text-sm text-content">
			<input
				type="checkbox"
				className="mt-0.5 size-4 shrink-0 accent-accent"
				{...props}
			/>
			<span>
				{label}
				{description ? (
					<span className="mt-0.5 block text-xs text-content-muted">
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
					<dt className="text-xs text-content-subtle">{item.label}</dt>
					<dd className="mt-0.5 truncate text-sm text-content">
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
			<div className={cn("px-4 py-6 text-xs text-content-subtle", className)}>
				{emptyLabel}
			</div>
		);
	}
	return (
		<pre
			className={cn(
				"max-h-96 overflow-auto whitespace-pre-wrap break-words bg-canvas px-4 py-3 font-mono text-xs leading-relaxed text-content-muted",
				className,
			)}
		>
			{content}
		</pre>
	);
}

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
			<table className="w-full border-collapse text-sm">
				<thead className="sticky top-0 bg-surface">
					<tr className="border-b border-border text-left text-xs uppercase tracking-wide text-content-subtle">
						{head}
					</tr>
				</thead>
				<tbody>{children}</tbody>
			</table>
		</div>
	);
}

export function Th({
	children,
	className,
	...props
}: React.ThHTMLAttributes<HTMLTableCellElement>) {
	return (
		<th className={cn("px-4 py-2 font-medium", className)} {...props}>
			{children}
		</th>
	);
}

export function Td({
	children,
	className,
	...props
}: React.TdHTMLAttributes<HTMLTableCellElement>) {
	return (
		<td className={cn("px-4 py-2 align-top", className)} {...props}>
			{children}
		</td>
	);
}

export function Tr({
	children,
	className,
	...props
}: React.HTMLAttributes<HTMLTableRowElement>) {
	return (
		<tr
			className={cn(
				"border-b border-border/60 hover:bg-surface-hover/50",
				className,
			)}
			{...props}
		>
			{children}
		</tr>
	);
}
