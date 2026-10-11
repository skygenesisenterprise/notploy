/**
 * Badges shared by the incident and maintenance views. They map the status
 * platform vocabulary (`@notploy/status`) onto the console badge variants so
 * a severity, a lifecycle state or a publication status reads the same
 * everywhere on the dashboard.
 */
import { Badge } from "@/components/ui/badge";
import type {
	IncidentSeverity,
	IncidentState,
	MaintenanceState,
} from "@/lib/status";

const SEVERITY_VARIANT: Record<
	IncidentSeverity,
	"blue" | "orange" | "red"
> = {
	minor: "blue",
	major: "orange",
	critical: "red",
};

export const SeverityBadge = ({ severity }: { severity: IncidentSeverity }) => (
	<Badge variant={SEVERITY_VARIANT[severity]}>{severity}</Badge>
);

const INCIDENT_STATE_VARIANT: Record<
	IncidentState,
	"red" | "orange" | "yellow" | "green"
> = {
	investigating: "red",
	identified: "orange",
	monitoring: "yellow",
	resolved: "green",
};

export const IncidentStateBadge = ({ state }: { state: IncidentState }) => (
	<Badge variant={INCIDENT_STATE_VARIANT[state]}>
		{state.replace("_", " ")}
	</Badge>
);

const MAINTENANCE_STATE_VARIANT: Record<
	MaintenanceState,
	"blue" | "orange" | "green" | "blank"
> = {
	scheduled: "blue",
	in_progress: "orange",
	completed: "green",
	cancelled: "blank",
};

export const MaintenanceStateBadge = ({
	state,
}: {
	state: MaintenanceState;
}) => (
	<Badge variant={MAINTENANCE_STATE_VARIANT[state]}>
		{state.replace("_", " ")}
	</Badge>
);

/**
 * Publication status of an entry: green once visible on the public status
 * page, blank while it stays an internal draft.
 */
export const PublicationBadge = ({
	published,
	visibility,
}: {
	published: boolean;
	visibility: "public" | "private";
}) => {
	if (published && visibility === "public") {
		return <Badge variant="green">public</Badge>;
	}
	if (visibility === "private") {
		return <Badge variant="blank">private</Badge>;
	}
	return <Badge variant="blank">unpublished</Badge>;
};
