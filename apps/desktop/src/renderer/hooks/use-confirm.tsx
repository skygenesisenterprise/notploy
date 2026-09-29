/**
 * Confirmation for destructive actions.
 *
 * An in-app dialog rather than `window.confirm`: the renderer's blocking dialog
 * is unstyled, cannot be themed, and on some platforms blocks the whole window
 * including the way out of a hung request.
 *
 * The hook is used only where an action is genuinely destructive (stop, cancel,
 * remove, container stop/kill/remove) and only when
 * `preferences.confirmDestructiveActions` is on — the caller decides, this hook
 * just asks.
 */

import * as React from "react";
import { cn } from "@/renderer/lib/cn";

export interface ConfirmRequest {
	title: string;
	description?: string;
	confirmLabel?: string;
	destructive?: boolean;
}

interface PendingConfirm extends ConfirmRequest {
	resolve: (value: boolean) => void;
}

export interface ConfirmController {
	confirm: (request: ConfirmRequest) => Promise<boolean>;
	/** Render this once, inside the app shell. */
	dialog: React.ReactNode;
}

export function useConfirm(): ConfirmController {
	const [pending, setPending] = React.useState<PendingConfirm | undefined>();

	const confirm = React.useCallback(
		(request: ConfirmRequest) =>
			new Promise<boolean>((resolve) => setPending({ ...request, resolve })),
		[],
	);

	const settle = React.useCallback((value: boolean) => {
		setPending((current) => {
			current?.resolve(value);
			return undefined;
		});
	}, []);

	const confirmRef = React.useRef<HTMLButtonElement>(null);

	// Focus lands on the confirming button so a keyboard user can answer the
	// prompt immediately, and Escape always cancels — the safe outcome. Done with
	// a ref rather than the `autoFocus` attribute, which steals focus from
	// assistive technology without announcing where it went.
	React.useEffect(() => {
		if (!pending) return;
		confirmRef.current?.focus();
		const onKey = (event: KeyboardEvent) => {
			if (event.key === "Escape") settle(false);
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [pending, settle]);

	const dialog = pending ? (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6">
			{/* Dismissing is a control, not a click on a decorative surface. */}
			<button
				type="button"
				aria-label="Cancel this action"
				onClick={() => settle(false)}
				className="absolute inset-0 cursor-default"
			/>
			<div
				role="alertdialog"
				aria-modal="true"
				aria-label={pending.title}
				className="relative w-full max-w-md rounded-lg border border-border bg-surface-raised p-5 shadow-2xl"
			>
				<h2 className="text-base font-semibold text-content">
					{pending.title}
				</h2>
				{pending.description ? (
					<p className="mt-2 text-sm text-content-muted">
						{pending.description}
					</p>
				) : null}
				<div className="mt-5 flex justify-end gap-2">
					<button
						type="button"
						onClick={() => settle(false)}
						className="rounded-md border border-border px-3 py-1.5 text-sm text-content-muted transition-colors hover:bg-surface-hover hover:text-content"
					>
						Cancel
					</button>
					<button
						type="button"
						ref={confirmRef}
						onClick={() => settle(true)}
						className={cn(
							"rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
							pending.destructive
								? "bg-danger/90 text-canvas hover:bg-danger"
								: "bg-accent text-canvas hover:bg-accent-hover",
						)}
					>
						{pending.confirmLabel ?? "Confirm"}
					</button>
				</div>
			</div>
		</div>
	) : null;

	return { confirm, dialog };
}
