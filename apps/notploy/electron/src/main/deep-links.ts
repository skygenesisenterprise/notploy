/**
 * `notploy://` deep links.
 *
 * Three platform behaviours have to be reconciled, which is most of this file:
 *
 * - **macOS** delivers a link through the `open-url` event, and it can arrive
 *   before the app is ready, so the event has to be registered early and the
 *   URL held until a dispatcher exists.
 * - **Windows and Linux** deliver it as an argument of a *new* process, which the
 *   single-instance lock turns into a `second-instance` event on the running
 *   app. The URL therefore has to be fished out of that process's `argv`.
 * - **In development**, the executable is Electron itself rather than the
 *   packaged binary, so the protocol can only be registered with the full
 *   command line (`execPath`, and the app directory as the first argument).
 *
 * A link that does not parse is dropped with a log line. It arrives from outside
 * the app, so it is untrusted input: {@link parseDeepLink} already refuses
 * anything that is not a recognised section, and nothing else is ever done with
 * the raw string.
 */

import type { App } from "electron";
import {
	type DeepLinkTarget,
	isDeepLink,
	parseDeepLink,
} from "@/shared/deep-link";

export interface DeepLinkOptions {
	app: Pick<
		App,
		| "setAsDefaultProtocolClient"
		| "removeAsDefaultProtocolClient"
		| "isDefaultProtocolClient"
	> & { getAppPath?: () => string };
	/** True when running from source rather than from a package. */
	isDev: boolean;
	/** The app directory, needed to register the protocol in development. */
	appPath: string;
	logger: {
		info: (message: string) => void;
		warn: (message: string, error?: unknown) => void;
	};
}

/**
 * Registers the app as the handler for `notploy://`.
 *
 * Returns whether the registration succeeded, which is informational: the
 * failure mode is a user who has to pass `--url` explicitly, not a broken app.
 */
export function registerProtocolClient(options: DeepLinkOptions): boolean {
	const { app, isDev, appPath } = options;
	// `process.defaultApp` is set when Electron runs a script instead of a
	// packaged app; the protocol then has to carry the script path.
	const args = isDev ? [appPath] : [];
	try {
		const registered = app.setAsDefaultProtocolClient(
			"notploy",
			undefined,
			args,
		);
		if (!registered) {
			options.logger.warn(
				"The operating system refused to register the notploy:// protocol",
			);
		}
		return registered;
	} catch (error) {
		options.logger.warn("Registering the notploy:// protocol failed", error);
		return false;
	}
}

/** Extracts the first `notploy://` argument from a process command line. */
export function deepLinkFromArgv(argv: readonly string[]): string | undefined {
	return argv.find((argument) => isDeepLink(argument));
}

/**
 * Turns a raw URL into a target, logging and dropping anything unusable.
 * A separate function so both platform paths go through the same validation.
 */
export function resolveDeepLink(
	url: string | undefined,
	logger: DeepLinkOptions["logger"],
): DeepLinkTarget | undefined {
	if (!url) return undefined;
	const target = parseDeepLink(url);
	if (!target) {
		// Do not echo the URL: it comes from outside the app.
		logger.warn("Ignored an unparseable notploy:// link");
		return undefined;
	}
	return target;
}

/**
 * Installs both platform paths.
 *
 * `onTarget` is called for every valid link. Links that arrive before it is
 * available (macOS can deliver `open-url` during startup) are queued and
 * flushed on the first call to {@link DeepLinkRouter.flush}.
 */
export class DeepLinkRouter {
	private readonly pending: DeepLinkTarget[] = [];
	private deliver: ((target: DeepLinkTarget) => void) | undefined;

	constructor(private readonly logger: DeepLinkOptions["logger"]) {}

	/** Attaches the renderer-side dispatcher. Any queued link is delivered now. */
	attach(deliver: (target: DeepLinkTarget) => void): void {
		this.deliver = deliver;
		for (const target of this.pending.splice(0)) deliver(target);
	}

	/** Validates and routes one raw URL. */
	handle(url: string | undefined): DeepLinkTarget | undefined {
		const target = resolveDeepLink(url, this.logger);
		if (!target) return undefined;
		this.logger.info(
			`Deep link received: ${target.section}${target.resource ? ` (${target.resource.kind})` : ""}`,
		);
		if (this.deliver) this.deliver(target);
		else this.pending.push(target);
		return target;
	}
}
