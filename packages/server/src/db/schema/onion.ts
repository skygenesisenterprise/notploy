import { relations } from "drizzle-orm";
import {
	index,
	integer,
	pgEnum,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { nanoid } from "nanoid";
import { z } from "zod";
import { compose } from "./compose";

/**
 * Tor Onion Service schema.
 *
 * A managed Onion Service publishes one service of a Docker Compose project on
 * a v3 `.onion` address. It is deliberately **not** a domain record: an onion
 * address is derived from the service's own ed25519 identity, so it lives in its
 * own table and is never routed through Traefik or the DNS provider model.
 *
 * Security rules baked into this model:
 *
 * - The private identity is never stored in a database column, a log line, an
 *   API response or the UI. Only the public `.onion` address and the path of the
 *   protected storage that holds the key material are persisted here.
 * - `identityPath` points inside the instance configuration tree (`paths().
 *   ONION_PATH`), which is the same protected volume as the Traefik
 *   configuration and the certificates, so backups treat it like any other
 *   secret-bearing directory.
 * - Deleting an Onion Service always removes the managed runtime and the
 *   generated Tor configuration; identity data is only removed when the caller
 *   explicitly asks for it (`apiDeleteOnionService.deleteIdentity`).
 */

/** Lifecycle state of a managed Onion Service, as shown in the dashboard. */
export const onionServiceStatus = pgEnum("onionServiceStatus", [
	/** Managed configuration exists but no Tor container was started yet. */
	"idle",
	/** A lifecycle operation is in flight. */
	"deploying",
	/** The Tor container is running and the address is published. */
	"running",
	/** The Tor container exists but is stopped. */
	"stopped",
	/** The last lifecycle operation failed; see `lastError`. */
	"error",
]);

/**
 * Compose service names are used verbatim in a `torrc` directive and in the
 * generated Docker command, so they are restricted to the Docker Compose
 * charset. Anything with a shell metacharacter is rejected before it reaches
 * a command line.
 */
export const ONION_SERVICE_NAME_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,62}$/;

export const ONION_SERVICE_NAME_MESSAGE =
	"Service name must start with a letter or digit and only contain letters, digits, dots, dashes and underscores";

/** Lowest accepted port; privileged ports stay valid but must be explicit. */
export const ONION_PORT_MIN = 1;
export const ONION_PORT_MAX = 65535;
export const ONION_VIRTUAL_PORT_DEFAULT = 80;

export const onionServices = pgTable(
	"onionService",
	{
		onionServiceId: text("onionServiceId")
			.notNull()
			.primaryKey()
			.$defaultFn(() => nanoid()),
		/** Operator-facing label; never used in a command line. */
		name: text("name").notNull(),
		composeId: text("composeId")
			.notNull()
			.references(() => compose.composeId, { onDelete: "cascade" }),
		/** Name of the target service inside the Compose project. */
		serviceName: text("serviceName").notNull(),
		/** Port the target service listens on inside its container network. */
		targetPort: integer("targetPort").notNull(),
		/**
		 * Port the onion address exposes. Defaults to 80 so a plain
		 * `http://<address>.onion` works without a suffix.
		 */
		virtualPort: integer("virtualPort")
			.notNull()
			.default(ONION_VIRTUAL_PORT_DEFAULT),
		/** Public v3 address (`<56 chars>.onion`); never the private key. */
		onionAddress: text("onionAddress"),
		/**
		 * Protected directory holding the Tor identity and configuration. The
		 * stored value is a path, not key material.
		 */
		identityPath: text("identityPath"),
		status: onionServiceStatus("status").notNull().default("idle"),
		/** Sanitized operator-facing failure reason; never contains secrets. */
		lastError: text("lastError"),
		createdAt: timestamp("createdAt", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updatedAt", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		index("onionService_composeId_idx").on(table.composeId),
		uniqueIndex("onionService_address_idx").on(table.onionAddress),
		uniqueIndex("onionService_target_idx").on(
			table.composeId,
			table.serviceName,
			table.virtualPort,
		),
	],
);

export const onionServicesRelations = relations(onionServices, ({ one }) => ({
	compose: one(compose, {
		fields: [onionServices.composeId],
		references: [compose.composeId],
	}),
}));

const createSchema = createInsertSchema(onionServices, {
	name: z.string().min(1).max(63),
	composeId: z.string().min(1),
	serviceName: z
		.string()
		.min(1)
		.regex(ONION_SERVICE_NAME_REGEX, ONION_SERVICE_NAME_MESSAGE),
	targetPort: z.number().int().min(ONION_PORT_MIN).max(ONION_PORT_MAX),
	virtualPort: z
		.number()
		.int()
		.min(ONION_PORT_MIN)
		.max(ONION_PORT_MAX)
		.optional(),
});

export const apiCreateOnionService = createSchema
	.pick({
		name: true,
		composeId: true,
		serviceName: true,
		targetPort: true,
		virtualPort: true,
	})
	.required({
		name: true,
		composeId: true,
		serviceName: true,
		targetPort: true,
	});

export const apiFindOnionService = z.object({
	onionServiceId: z.string().min(1),
});

export const apiFindOnionServicesByCompose = z.object({
	composeId: z.string().min(1),
});

export const apiUpdateOnionService = createSchema
	.pick({
		name: true,
		serviceName: true,
		targetPort: true,
		virtualPort: true,
	})
	.partial()
	.extend({
		onionServiceId: z.string().min(1),
	});

export const apiDeleteOnionService = z.object({
	onionServiceId: z.string().min(1),
	/**
	 * Identity data is the address: keeping it allows the same `.onion` to be
	 * recreated later, deleting it is irreversible and makes it explicit.
	 */
	deleteIdentity: z.boolean().default(false),
});

export type OnionService = typeof onionServices.$inferSelect;
export type NewOnionService = typeof onionServices.$inferInsert;
export type OnionServiceStatus = (typeof onionServiceStatus.enumValues)[number];
