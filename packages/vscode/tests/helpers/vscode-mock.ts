/**
 * A minimal stand-in for the `vscode` module.
 *
 * It is aliased in `vitest.config.mts`, so every test imports the real API
 * surface without needing a VS Code instance. Only what the extension actually
 * uses is implemented.
 */

export enum TreeItemCollapsibleState {
	None = 0,
	Collapsed = 1,
	Expanded = 2,
}

export enum StatusBarAlignment {
	Left = 1,
	Right = 2,
}

export enum ProgressLocation {
	SourceControl = 1,
	Window = 10,
	Notification = 15,
}

export interface TreeItemLabel {
	label: string;
	highlights?: [number, number][];
}

export class TreeItem {
	label?: string | TreeItemLabel;
	collapsibleState?: TreeItemCollapsibleState;
	contextValue?: string;
	description?: string | boolean;
	tooltip?: unknown;
	iconPath?: unknown;
	command?: unknown;
	id?: string;
	resourceUri?: unknown;

	constructor(
		label: string | TreeItemLabel,
		collapsibleState?: TreeItemCollapsibleState,
	) {
		this.label = label;
		this.collapsibleState = collapsibleState;
	}
}

export class ThemeIcon {
	static readonly File = new ThemeIcon("file");
	readonly id: string;
	readonly color?: ThemeColor;

	constructor(id: string, color?: ThemeColor) {
		this.id = id;
		this.color = color;
	}
}

export class ThemeColor {
	readonly id: string;

	constructor(id: string) {
		this.id = id;
	}
}

export class MarkdownString {
	value = "";

	constructor(value = "") {
		this.value = value;
	}

	appendMarkdown(text: string): MarkdownString {
		this.value += text;
		return this;
	}

	appendText(text: string): MarkdownString {
		this.value += text;
		return this;
	}

	/** So tests can read a tooltip with `String(node.tooltip)`. */
	toString(): string {
		return this.value;
	}
}

export class Uri {
	private constructor(
		readonly scheme: string,
		readonly path: string,
	) {}

	static parse(value: string): Uri {
		const match = /^([a-z][a-z0-9+.-]*):\/\/(.*)$/i.exec(value);
		if (match) return new Uri(match[1]!.toLowerCase(), match[2]!);
		return new Uri("file", value);
	}

	static file(path: string): Uri {
		return new Uri("file", path);
	}

	static joinPath(base: Uri, ...segments: string[]): Uri {
		const joined = [base.path.replace(/\/+$/, ""), ...segments].join("/");
		return new Uri(base.scheme, joined);
	}

	toString(): string {
		return `${this.scheme}://${this.path}`;
	}

	get fsPath(): string {
		return this.path;
	}
}

export class EventEmitter<T> {
	private listeners: Array<(value: T) => void> = [];
	readonly event = (listener: (value: T) => void): Disposable => {
		this.listeners.push(listener);
		return new Disposable(() => {
			this.listeners = this.listeners.filter((entry) => entry !== listener);
		});
	};

	fire(value: T): void {
		for (const listener of [...this.listeners]) listener(value);
	}

	dispose(): void {
		this.listeners = [];
	}
}

export class Disposable {
	constructor(private readonly callOnDispose: () => void) {}
	static from(...disposables: Disposable[]): Disposable {
		return new Disposable(() => {
			for (const disposable of disposables) disposable.dispose();
		});
	}

	dispose(): void {
		this.callOnDispose();
	}
}

// ---------------------------------------------------------------------------
// window
// ---------------------------------------------------------------------------

class OutputChannelStub {
	lines: string[] = [];
	shown = false;
	disposed = false;

	appendLine(value: string): void {
		this.lines.push(value);
	}

	append(value: string): void {
		this.lines.push(value);
	}

	clear(): void {
		this.lines = [];
	}

	show(): void {
		this.shown = true;
	}

	hide(): void {}
	replace(): void {}

	trace(message: string): void {
		this.lines.push(message);
	}

	debug(message: string): void {
		this.lines.push(message);
	}

	info(message: string): void {
		this.lines.push(message);
	}

	warn(message: string): void {
		this.lines.push(message);
	}

	error(message: string): void {
		this.lines.push(message);
	}

	dispose(): void {
		this.disposed = true;
	}
}

class StatusBarItemStub {
	text = "";
	tooltip?: unknown;
	command?: unknown;
	backgroundColor?: unknown;
	name?: string;
	visible = false;

	show(): void {
		this.visible = true;
	}

	hide(): void {
		this.visible = false;
	}

	dispose(): void {}
}

export const registeredCommands = new Map<
	string,
	(...args: unknown[]) => unknown
>();
export const createdChannels = new Map<string, OutputChannelStub>();
export const statusBarItems: StatusBarItemStub[] = [];

export const responses = {
	inputBox: undefined as string | undefined,
	quickPick: undefined as unknown,
	informationMessage: undefined as string | undefined,
	warningMessage: undefined as string | undefined,
	errorMessage: undefined as string | undefined,
};

export function resetMockState(): void {
	registeredCommands.clear();
	createdChannels.clear();
	statusBarItems.length = 0;
	responses.inputBox = undefined;
	responses.quickPick = undefined;
	responses.informationMessage = undefined;
	responses.warningMessage = undefined;
	responses.errorMessage = undefined;
}

export const window = {
	createOutputChannel(name: string): OutputChannelStub {
		const channel = new OutputChannelStub();
		createdChannels.set(name, channel);
		return channel;
	},
	createStatusBarItem(): StatusBarItemStub {
		const item = new StatusBarItemStub();
		statusBarItems.push(item);
		return item;
	},
	createTreeView(): Disposable {
		return new Disposable(() => {});
	},
	async showInputBox(): Promise<string | undefined> {
		return responses.inputBox;
	},
	async showQuickPick(): Promise<unknown> {
		return responses.quickPick;
	},
	async showInformationMessage(): Promise<string | undefined> {
		return responses.informationMessage;
	},
	async showWarningMessage(): Promise<string | undefined> {
		return responses.warningMessage;
	},
	async showErrorMessage(): Promise<string | undefined> {
		return responses.errorMessage;
	},
	async showTextDocument(): Promise<unknown> {
		return {};
	},
	async withProgress<T>(_options: unknown, task: () => Promise<T>): Promise<T> {
		return await task();
	},
};

// ---------------------------------------------------------------------------
// workspace
// ---------------------------------------------------------------------------

export interface FakeConfiguration {
	values: Record<string, unknown>;
	get<T>(key: string, defaultValue?: T): T | undefined;
}

const configurationValues: Record<string, unknown> = {};

export function setConfiguration(values: Record<string, unknown>): void {
	for (const key of Object.keys(configurationValues))
		delete configurationValues[key];
	Object.assign(configurationValues, values);
}

export const workspace = {
	workspaceFolders: undefined as Array<{ uri: Uri; name: string }> | undefined,
	getConfiguration(section?: string) {
		return {
			get<T>(key: string, defaultValue?: T): T | undefined {
				const full = section ? `${section}.${key}` : key;
				const value = configurationValues[full];
				return value === undefined ? defaultValue : (value as T);
			},
			has(key: string): boolean {
				const full = section ? `${section}.${key}` : key;
				return full in configurationValues;
			},
		};
	},
	fs: {
		async readFile(): Promise<Uint8Array> {
			throw new Error("not implemented in the test double");
		},
		async writeFile(): Promise<void> {},
		async stat(): Promise<unknown> {
			throw new Error("not implemented in the test double");
		},
	},
	createFileSystemWatcher() {
		const emitter = new EventEmitter<unknown>();
		return {
			onDidCreate: emitter.event,
			onDidChange: emitter.event,
			onDidDelete: emitter.event,
			dispose: () => {},
		};
	},
	onDidChangeConfiguration() {
		return new Disposable(() => {});
	},
	async openTextDocument(): Promise<unknown> {
		return {};
	},
};

// ---------------------------------------------------------------------------
// commands, env, extensions
// ---------------------------------------------------------------------------

export const commands = {
	registerCommand(
		id: string,
		handler: (...args: unknown[]) => unknown,
	): Disposable {
		registeredCommands.set(id, handler);
		return new Disposable(() => registeredCommands.delete(id));
	},
	async executeCommand(): Promise<unknown> {
		return undefined;
	},
};

export const env = {
	clipboard: {
		text: "",
		async writeText(value: string): Promise<void> {
			this.text = value;
		},
		async readText(): Promise<string> {
			return this.text;
		},
	},
	async openExternal(): Promise<boolean> {
		return true;
	},
};

export const extensions = {
	getExtension(): undefined {
		return undefined;
	},
};

/** Test helper: the output channel created for a given name, if any. */
export function channelOutput(name: string): string {
	return (createdChannels.get(name)?.lines ?? []).join("\n");
}

export type { OutputChannelStub, StatusBarItemStub };
