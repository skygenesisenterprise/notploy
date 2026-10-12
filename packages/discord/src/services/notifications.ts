import type { Channel, Client } from "discord.js";
import type { BotConfig, NotificationEventType } from "../types/index.js";
import {
	type GitHubEvent,
	buildGitHubNotificationEmbed,
	eventType,
} from "../integrations/github/events.js";
import type { GitHubIntegration } from "../integrations/github/index.js";
import type { Logger } from "../utils/logger.js";

/** A channel able to receive a message with embeds. */
type SendableChannel = Channel & {
	send: (options: { embeds: ReturnType<typeof buildGitHubNotificationEmbed>[] }) => Promise<unknown>;
};

function isSendable(channel: Channel): channel is SendableChannel {
	return typeof (channel as { send?: unknown }).send === "function";
}

/**
 * Routes normalized GitHub events to their configured Discord channels.
 *
 * The service never fetches GitHub itself; it receives already-normalized
 * events, which keeps transport (webhook, poller, CLI) and presentation
 * concerns separate. A lightweight release poller is included so release
 * announcements work without additional infrastructure.
 */
export class NotificationService {
	constructor(
		private readonly client: Client,
		private readonly config: BotConfig,
		private readonly github: GitHubIntegration,
		private readonly logger: Logger,
	) {}

	/** Whether an event type is enabled and has a destination channel. */
	isEnabled(event: NotificationEventType): boolean {
		return (
			this.config.notifications.enabledEvents.includes(event) &&
			Boolean(this.config.notifications.channels[event])
		);
	}

	/** Destination channel id for an event type, when configured. */
	channelIdFor(event: NotificationEventType): string | null {
		return this.config.notifications.channels[event] ?? null;
	}

	/** Publishes a normalized GitHub event. Returns whether it was sent. */
	async publish(event: GitHubEvent): Promise<boolean> {
		const type = eventType(event);
		const channelId = this.channelIdFor(type);
		if (!this.isEnabled(type) || !channelId) {
			this.logger.debug("Notification skipped", { event: type });
			return false;
		}

		try {
			const channel = await this.client.channels.fetch(channelId);
			if (!channel || !isSendable(channel)) {
				this.logger.warn("Notification channel is not sendable", { channelId, event: type });
				return false;
			}
			await channel.send({ embeds: [buildGitHubNotificationEmbed(event)] });
			this.logger.info("Notification published", { channelId, event: type });
			return true;
		} catch (error) {
			this.logger.error("Failed to publish notification", {
				channelId,
				event: type,
				error: error instanceof Error ? error.message : String(error),
			});
			return false;
		}
	}

	/**
	 * Polls the latest GitHub release and announces it once.
	 *
	 * Returns a stop function. When release notifications are disabled this is
	 * a no-op, so it is always safe to call from the lifecycle.
	 */
	startReleaseWatcher(intervalMs = 15 * 60 * 1000): () => void {
		if (!this.isEnabled("releases")) return () => {};

		let lastTag: string | null = null;
		let running = false;

		const tick = async (): Promise<void> => {
			if (running) return;
			running = true;
			try {
				const release = await this.github.getLatestRelease();
				if (release && release.tagName !== lastTag) {
					if (lastTag !== null) {
						await this.publish({ type: "releases", release });
					}
					lastTag = release.tagName;
				}
			} finally {
				running = false;
			}
		};

		void tick();
		const timer = setInterval(() => void tick(), intervalMs);
		timer.unref?.();

		return () => clearInterval(timer);
	}
}
