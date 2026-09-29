/*
 * Ported from `apps/notploy/components/ui/input.tsx`.
 *
 * Changes from the App version, and only these:
 *
 * - `cn` import path.
 * - The copy button writes through `app.copyText` (the main process) instead of
 *   the browser clipboard: the desktop renderer's clipboard permission is denied
 *   by design (see `src/main/security/content-policy.ts`).
 * - `toast` comes from `sonner`, which the desktop mounts too, so the feedback
 *   wording is identical to the dashboard.
 * - The password generator is the App's behaviour, reimplemented locally because
 *   the desktop does not carry App's `lib/password-utils`.
 *
 * The input classes are byte-for-byte the App's.
 */

import { Clipboard, EyeIcon, EyeOffIcon, RefreshCcw } from "lucide-react";
import type * as React from "react";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

import { getBridge } from "@/renderer/lib/bridge";
import { cn } from "@/renderer/lib/cn";
import { Button } from "./button";

export interface InputProps extends React.ComponentProps<"input"> {
	errorMessage?: string;
	enablePasswordGenerator?: boolean;
	passwordGeneratorLength?: number;
	enableCopyButton?: boolean;
}

/**
 * A password with at least one of each character class.
 *
 * Kept to `crypto.getRandomValues`, which is available in the renderer; nothing
 * here needs a dependency, and a generated password never leaves the field.
 */
export function generateRandomPassword(length = 16): string {
	const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
	const lower = "abcdefghijkmnopqrstuvwxyz";
	const digits = "23456789";
	const symbols = "!@#$%^&*()-_=+";
	const all = upper + lower + digits + symbols;
	const pick = (source: string): string => {
		const bytes = new Uint32Array(1);
		crypto.getRandomValues(bytes);
		return source[bytes[0] % source.length] as string;
	};
	const required = [pick(upper), pick(lower), pick(digits), pick(symbols)];
	while (required.length < Math.max(8, length)) required.push(pick(all));
	// Fisher-Yates with the same source, so the required characters are not
	// always in the first four positions.
	for (let i = required.length - 1; i > 0; i -= 1) {
		const bytes = new Uint32Array(1);
		crypto.getRandomValues(bytes);
		const j = bytes[0] % (i + 1);
		const a = required[i] as string;
		required[i] = required[j] as string;
		required[j] = a;
	}
	return required.join("");
}

function Input({
	className,
	type,
	errorMessage,
	enablePasswordGenerator = false,
	passwordGeneratorLength,
	enableCopyButton = false,
	ref,
	...props
}: InputProps) {
	const [showPassword, setShowPassword] = useState(false);
	const inputRef = useRef<HTMLInputElement | null>(null);
	const isPassword = type === "password";
	const shouldShowGenerator =
		isPassword &&
		enablePasswordGenerator !== false &&
		!props.disabled &&
		!props.readOnly;
	const inputType = isPassword ? (showPassword ? "text" : "password") : type;

	const setRefs = useCallback(
		(node: HTMLInputElement | null) => {
			inputRef.current = node;
			if (typeof ref === "function") {
				ref(node);
			} else if (ref && typeof ref === "object") {
				(ref as { current: HTMLInputElement | null }).current = node;
			}
		},
		[ref],
	);

	const handleGeneratePassword = () => {
		const nextValue =
			typeof passwordGeneratorLength === "number" && passwordGeneratorLength > 0
				? generateRandomPassword(Math.floor(passwordGeneratorLength))
				: generateRandomPassword();

		const input = inputRef.current;
		if (!input) return;

		const valueSetter = Object.getOwnPropertyDescriptor(
			HTMLInputElement.prototype,
			"value",
		)?.set;
		if (valueSetter) {
			valueSetter.call(input, nextValue);
		} else {
			input.value = nextValue;
		}
		input.dispatchEvent(new Event("input", { bubbles: true }));
	};

	const handleCopy = () => {
		void getBridge()
			.app.copyText(inputRef.current?.value ?? "")
			.then(() => toast.success("Value is copied to clipboard"))
			.catch(() => toast.error("The value could not be copied"));
	};

	const inputElement = (
		<div className="relative w-full">
			<input
				type={inputType}
				data-slot="input"
				className={cn(
					"h-10 w-full min-w-0 rounded-lg border border-input bg-transparent px-3 py-2 text-sm transition-colors outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
					isPassword && (shouldShowGenerator ? "pr-16" : "pr-10"),
					className,
				)}
				ref={setRefs}
				{...props}
			/>
			{isPassword && (
				<div className="absolute inset-y-0 right-0 flex items-center gap-1 pr-3 text-muted-foreground">
					{shouldShowGenerator && (
						<button
							type="button"
							className="hover:text-foreground focus:outline-none"
							onClick={handleGeneratePassword}
							aria-label="Generate password"
							title="Generate password"
							tabIndex={-1}
						>
							<RefreshCcw className="h-4 w-4" />
						</button>
					)}
					<button
						type="button"
						className="hover:text-foreground focus:outline-none"
						onClick={() => setShowPassword(!showPassword)}
						aria-label={showPassword ? "Hide password" : "Show password"}
						tabIndex={-1}
					>
						{showPassword ? (
							<EyeOffIcon className="h-4 w-4" />
						) : (
							<EyeIcon className="h-4 w-4" />
						)}
					</button>
				</div>
			)}
		</div>
	);

	return (
		<>
			{enableCopyButton ? (
				<div className="flex w-full items-center space-x-2">
					{inputElement}
					<Button type="button" variant="secondary" onClick={handleCopy}>
						<Clipboard className="size-4 text-muted-foreground" />
					</Button>
				</div>
			) : (
				inputElement
			)}
			{errorMessage && (
				<span className="text-sm text-red-600 text-secondary-foreground">
					{errorMessage}
				</span>
			)}
		</>
	);
}

export { Input };
