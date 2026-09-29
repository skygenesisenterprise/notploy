/**
 * The gate in front of every instance-scoped page.
 *
 * Three distinct situations, three distinct answers — the whole point being that
 * a page never renders an empty list when the real reason is "no instance is
 * selected" or "this instance has no such router":
 *
 * 1. no connection selected → point at Connections;
 * 2. no API key stored, or it was rejected → point at Connections;
 * 3. the router the page needs is missing → say which router, and what the
 *    instance does expose (`source: "openapi"` means it reported its own
 *    capability set; `"probe"` means it was probed).
 */

import { Plug, ShieldAlert, WifiOff } from "lucide-react";
import type * as React from "react";
import { Button, EmptyState } from "@/renderer/components/ui/primitives";
import type { SectionDefinition } from "@/renderer/lib/routes";
import type { ConnectionSummary } from "@/shared/domain";

export interface ConnectionGateProps {
	connection: ConnectionSummary | undefined;
	route: SectionDefinition;
	onOpenConnections: () => void;
	children: React.ReactNode;
}

export function ConnectionGate({
	connection,
	route,
	onOpenConnections,
	children,
}: ConnectionGateProps) {
	if (!route.requiresConnection) return <>{children}</>;

	if (!connection) {
		return (
			<EmptyState
				icon={<Plug aria-hidden className="size-8" />}
				title="No instance selected"
				description="Add a Notploy Cloud, self-hosted or local instance to work with its projects, deployments and infrastructure."
				action={
					<Button variant="default" onClick={onOpenConnections}>
						Add a connection
					</Button>
				}
			/>
		);
	}

	if (!connection.hasCredential) {
		return (
			<EmptyState
				icon={<ShieldAlert aria-hidden className="size-8" />}
				title={`No API key for ${connection.name}`}
				description="The Notploy API authenticates with an API key sent as an x-api-key header. Add one for this connection to read its data."
				action={
					<Button variant="default" onClick={onOpenConnections}>
						Add an API key
					</Button>
				}
			/>
		);
	}

	if (connection.status === "unavailable") {
		return (
			<EmptyState
				icon={<WifiOff aria-hidden className="size-8" />}
				title={`${connection.name} is unreachable`}
				description={
					connection.error ??
					`The last check could not reach ${connection.url}.`
				}
				action={
					<Button variant="default" onClick={onOpenConnections}>
						Check the connection
					</Button>
				}
			/>
		);
	}

	const capability = route.capability;
	if (capability && connection.capabilities) {
		const available: boolean = connection.capabilities[capability];
		if (!available) {
			return (
				<EmptyState
					title={`Not available on ${connection.name}`}
					description={`This instance does not expose the "${route.router ?? capability}" router, so there is nothing to show here. Availability is read from the instance's own OpenAPI document, not from a version number.`}
					action={
						<Button onClick={onOpenConnections}>View capabilities</Button>
					}
				/>
			);
		}
	}

	return <>{children}</>;
}

/** Reported at the bottom of a page: what the instance said it can do. */
export function CapabilityFooter({
	connection,
}: {
	connection: ConnectionSummary | undefined;
}) {
	if (!connection?.capabilities) return null;
	const entries = Object.entries(connection.capabilities).filter(
		([, value]) => value,
	);
	return (
		<p className="px-6 py-4 text-xs text-content-subtle">
			{connection.name}
			{connection.version ? ` · v${connection.version}` : ""}
			{connection.cloud ? " · Notploy Cloud" : ""} · capabilities:{" "}
			{entries.length > 0
				? entries.map(([key]) => key).join(", ")
				: "none reported"}
		</p>
	);
}
