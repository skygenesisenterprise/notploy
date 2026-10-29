"use client";

import type * as React from "react";
import { cn } from "@/lib/utils";

export const Card = ({
	title,
	description,
	actions,
	children,
}: {
	title: string;
	description?: string;
	actions?: React.ReactNode;
	children: React.ReactNode;
}) => (
	<section className="status-card flex flex-col gap-4 p-5">
		<header className="flex flex-wrap items-start justify-between gap-3">
			<div className="flex flex-col gap-0.5">
				<h2 className="font-semibold">{title}</h2>
				{description ? (
					<p className="text-sm text-muted-foreground">{description}</p>
				) : null}
			</div>
			{actions}
		</header>
		{children}
	</section>
);

export const Field = ({
	label,
	children,
	hint,
}: {
	label: string;
	children: React.ReactNode;
	hint?: string;
}) => (
	// biome-ignore lint/a11y/noLabelWithoutControl: the control is provided via `children` and rendered inside the label, so they are associated by nesting.
	<label className="flex flex-col gap-1.5 text-sm">
		<span className="font-medium">{label}</span>
		{children}
		{hint ? (
			<span className="text-xs text-muted-foreground">{hint}</span>
		) : null}
	</label>
);

const controlClass =
	"w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none transition-colors focus-visible:border-ring";

export const Input = ({
	className,
	...props
}: React.InputHTMLAttributes<HTMLInputElement>) => (
	<input className={cn(controlClass, className)} {...props} />
);

export const Textarea = ({
	className,
	...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
	<textarea className={cn(controlClass, "min-h-20", className)} {...props} />
);

export const Select = ({
	className,
	children,
	...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) => (
	<select className={cn(controlClass, className)} {...props}>
		{children}
	</select>
);

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";

export const Button = ({
	variant = "secondary",
	className,
	...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
	variant?: ButtonVariant;
}) => (
	<button
		className={cn(
			"inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
			{
				primary: "bg-primary text-primary-foreground hover:opacity-90",
				secondary: "border border-border hover:bg-secondary",
				danger:
					"border border-border text-[var(--status-critical)] hover:bg-secondary",
				ghost: "hover:bg-secondary",
			}[variant],
			className,
		)}
		{...props}
	/>
);

export const Notice = ({
	tone,
	children,
}: {
	tone: "error" | "success" | "info";
	children: React.ReactNode;
}) => (
	<p
		className={cn(
			"rounded-lg px-3 py-2 text-sm",
			{
				error: "tone-red",
				success: "tone-green",
				info: "tone-neutral",
			}[tone],
		)}
	>
		{children}
	</p>
);
