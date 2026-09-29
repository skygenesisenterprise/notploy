/**
 * The command palette.
 *
 * The desktop counterpart of hunting through a sidebar: `Cmd/Ctrl+K`, type,
 * Enter. It is deliberately a *generic* palette — it renders whatever commands
 * the shell hands it, and the shell only builds commands for things that exist:
 * the sections the active instance actually exposes, the instances that are
 * configured, and the actions the client can really perform. A palette full of
 * entries that navigate to an empty page is worse than no palette.
 *
 * Keyboard handling is complete, because a palette that needs the mouse defeats
 * its own purpose: arrows move, Home/End jump, Enter runs, Escape closes, and
 * focus returns to whatever had it.
 */

import * as React from "react";
import { cn } from "@/renderer/lib/cn";

export interface PaletteCommand {
	/** Stable identity, used as the React key and for selection. */
	id: string;
	label: string;
	/** Section heading in the list, e.g. "Go to", "Instances", "Actions". */
	group: string;
	/** Extra text shown on the right, e.g. the instance name. */
	hint?: string;
	/** Additional words that should match a query, beyond the label. */
	keywords?: string;
	run: () => void;
}

export interface CommandPaletteProps {
	open: boolean;
	commands: PaletteCommand[];
	onClose: () => void;
	/** Shown inside the empty state; usually whether a connection is selected. */
	emptyHint?: string;
}

export function CommandPalette({
	open,
	commands,
	onClose,
	emptyHint,
}: CommandPaletteProps) {
	const [query, setQuery] = React.useState("");
	const [selected, setSelected] = React.useState(0);
	const inputRef = React.useRef<HTMLInputElement>(null);
	const listRef = React.useRef<HTMLDivElement>(null);
	const restoreFocusTo = React.useRef<Element | null>(null);

	// Reset the query each time it opens, and hand focus back on close, so
	// dismissing the palette does not strand a keyboard user.
	React.useEffect(() => {
		if (open) {
			restoreFocusTo.current = document.activeElement;
			setQuery("");
			setSelected(0);
			inputRef.current?.focus();
			return;
		}
		const previous = restoreFocusTo.current;
		if (previous instanceof HTMLElement) previous.focus();
	}, [open]);

	const matches = React.useMemo(() => {
		const needle = query.trim().toLowerCase();
		if (!needle) return commands;
		return commands.filter((command) => {
			const haystack =
				`${command.label} ${command.group} ${command.hint ?? ""} ${command.keywords ?? ""}`.toLowerCase();
			// Every word has to appear somewhere, so "deploy prod" finds
			// "Deployments" on "production".
			return needle.split(/\s+/).every((word) => haystack.includes(word));
		});
	}, [commands, query]);

	// Keep the selection inside the filtered list as it shrinks.
	React.useEffect(() => {
		setSelected((current) => (current < matches.length ? current : 0));
	}, [matches.length]);

	React.useEffect(() => {
		const item = listRef.current?.querySelector<HTMLElement>(
			`[data-index="${selected}"]`,
		);
		item?.scrollIntoView({ block: "nearest" });
	}, [selected]);

	if (!open) return null;

	const runAt = (index: number) => {
		const command = matches[index];
		if (!command) return;
		onClose();
		command.run();
	};

	const onKeyDown = (event: React.KeyboardEvent) => {
		switch (event.key) {
			case "Escape":
				event.preventDefault();
				onClose();
				return;
			case "ArrowDown":
				event.preventDefault();
				setSelected((current) =>
					matches.length === 0 ? 0 : (current + 1) % matches.length,
				);
				return;
			case "ArrowUp":
				event.preventDefault();
				setSelected((current) =>
					matches.length === 0
						? 0
						: (current - 1 + matches.length) % matches.length,
				);
				return;
			case "Home":
				event.preventDefault();
				setSelected(0);
				return;
			case "End":
				event.preventDefault();
				setSelected(Math.max(0, matches.length - 1));
				return;
			case "Enter":
				event.preventDefault();
				runAt(selected);
				return;
			default:
		}
	};

	// Group while preserving the order the shell provided, so "Go to" stays
	// above "Instances".
	const groups: Array<{ name: string; items: PaletteCommand[] }> = [];
	for (const command of matches) {
		const last = groups.at(-1);
		if (last && last.name === command.group) last.items.push(command);
		else groups.push({ name: command.group, items: [command] });
	}

	// `selected` indexes the flat list; groups need the same flat offsets.
	let flatIndex = -1;

	return (
		<div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-[12vh]">
			<button
				type="button"
				aria-label="Close the command palette"
				onClick={onClose}
				className="absolute inset-0 cursor-default"
			/>
			<div
				role="dialog"
				aria-modal="true"
				aria-label="Command palette"
				className="relative flex max-h-[70vh] w-full max-w-xl flex-col overflow-hidden rounded-lg border border-border bg-surface-raised shadow-2xl"
			>
				{/*
					The input owns the keyboard: it is autofocused, so every key the user
					presses reaches it. Deliberately no `combobox`/`listbox` ARIA pair —
					that pattern calls for roving focus and an active-descendant contract,
					and shipping the roles without the behaviour would describe a widget
					that does not exist. A plain list of buttons is what is actually here.
				*/}
				<input
					ref={inputRef}
					type="search"
					aria-label="Search commands"
					aria-controls="palette-list"
					value={query}
					onChange={(event) => setQuery(event.target.value)}
					onKeyDown={onKeyDown}
					placeholder="Search commands, sections and instances…"
					className="w-full border-b border-border bg-transparent px-4 py-3 text-sm text-content placeholder:text-content-subtle focus:outline-none"
				/>

				{matches.length === 0 ? (
					<div className="px-4 py-6 text-sm text-content-muted">
						No command matches “{query}”.
						{emptyHint ? (
							<p className="mt-1 text-xs text-content-subtle">{emptyHint}</p>
						) : null}
					</div>
				) : (
					<div
						ref={listRef}
						id="palette-list"
						className="min-h-0 flex-1 overflow-y-auto p-1"
					>
						{groups.map((group) => (
							<div key={group.name}>
								<p className="px-2.5 pt-2 pb-1 text-xs font-medium tracking-wide text-content-subtle uppercase">
									{group.name}
								</p>
								<div>
									{group.items.map((command) => {
										flatIndex += 1;
										const index = flatIndex;
										const active = index === selected;
										return (
											<div key={command.id}>
												<button
													type="button"
													data-index={index}
													onMouseEnter={() => setSelected(index)}
													onClick={() => runAt(index)}
													className={cn(
														"flex w-full items-center justify-between gap-3 rounded px-2.5 py-2 text-left text-sm transition-colors",
														active
															? "bg-accent-soft text-content"
															: "text-content-muted hover:bg-surface-hover hover:text-content",
													)}
												>
													<span className="truncate">{command.label}</span>
													{command.hint ? (
														<span className="shrink-0 text-xs text-content-subtle">
															{command.hint}
														</span>
													) : null}
												</button>
											</div>
										);
									})}
								</div>
							</div>
						))}
					</div>
				)}

				<div className="flex items-center justify-between border-t border-border px-4 py-2 text-xs text-content-subtle">
					<span>↑↓ to move · ↵ to run · Esc to close</span>
					<span>{matches.length} available</span>
				</div>
			</div>
		</div>
	);
}
