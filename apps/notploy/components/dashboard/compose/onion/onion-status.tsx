import { Badge } from "@/components/ui/badge";

/**
 * Shape of an Onion Service as returned by `onion.list` / `onion.one`. The
 * private identity never appears here: only the public address and the path of
 * the protected storage that holds the key material.
 */
export interface OnionServiceListItem {
	onionServiceId: string;
	name: string;
	composeId: string;
	serviceName: string;
	targetPort: number;
	virtualPort: number;
	onionAddress: string | null;
	identityPath: string | null;
	status: "idle" | "deploying" | "running" | "stopped" | "error";
	lastError: string | null;
}

export const onionStatusVariants: Record<
	OnionServiceListItem["status"],
	{
		label: string;
		variant: "blank" | "blue" | "green" | "yellow" | "red";
	}
> = {
	idle: { label: "Not started", variant: "blank" },
	deploying: { label: "Starting", variant: "blue" },
	running: { label: "Running", variant: "green" },
	stopped: { label: "Stopped", variant: "yellow" },
	error: { label: "Error", variant: "red" },
};

export const OnionStatusBadge = ({
	status,
}: {
	status: OnionServiceListItem["status"];
}) => {
	const badge = onionStatusVariants[status];

	return <Badge variant={badge.variant}>{badge.label}</Badge>;
};
