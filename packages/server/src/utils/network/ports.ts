/**
 * Port-mapping validation shared by the API and runtime builders.
 *
 * Docker/Swarm accept a list of mappings but their internal maps are keyed by
 * published port + protocol: a configuration with two entries for the same
 * `publishedPort`/`protocol` pair silently keeps only one of them. We reject
 * that configuration up front instead of letting the runtime override a mapping
 * the operator configured explicitly.
 */

export type PortProtocol = "tcp" | "udp";

export interface PortMapping {
	publishedPort: number;
	targetPort: number;
	protocol: PortProtocol;
}

export interface PortConflict {
	type: "invalid-range" | "duplicate-published-port" | "duplicate-mapping";
	message: string;
	field: "publishedPort" | "targetPort";
}

const MIN_PORT = 1;
const MAX_PORT = 65535;

export const isValidPortNumber = (port: number): boolean =>
	Number.isInteger(port) && port >= MIN_PORT && port <= MAX_PORT;

/**
 * Returns the first blocking conflict between a candidate mapping and the
 * mappings already attached to the same service, or `null` when the candidate
 * can be applied without ambiguity.
 */
export const findPortConflict = (
	candidate: PortMapping,
	existing: readonly PortMapping[],
): PortConflict | null => {
	if (!isValidPortNumber(candidate.publishedPort)) {
		return {
			type: "invalid-range",
			field: "publishedPort",
			message: `Published port must be an integer between ${MIN_PORT} and ${MAX_PORT}.`,
		};
	}
	if (!isValidPortNumber(candidate.targetPort)) {
		return {
			type: "invalid-range",
			field: "targetPort",
			message: `Target port must be an integer between ${MIN_PORT} and ${MAX_PORT}.`,
		};
	}

	for (const port of existing) {
		if (
			port.publishedPort === candidate.publishedPort &&
			port.targetPort === candidate.targetPort &&
			port.protocol === candidate.protocol
		) {
			return {
				type: "duplicate-mapping",
				field: "targetPort",
				message: `Mapping ${candidate.publishedPort}:${candidate.targetPort}/${candidate.protocol} already exists.`,
			};
		}
	}

	for (const port of existing) {
		if (
			port.publishedPort === candidate.publishedPort &&
			port.protocol === candidate.protocol
		) {
			return {
				type: "duplicate-published-port",
				field: "publishedPort",
				message: `Port ${candidate.publishedPort}/${candidate.protocol} is already mapped on this service. Choose another published port or protocol.`,
			};
		}
	}

	return null;
};

/**
 * Normalizes a list of persisted mappings before handing them to a runtime
 * builder. Invalid or conflicting entries are dropped rather than silently
 * overwriting each other; callers should validate at write time so this is only
 * a defensive second line.
 */
export const normalizePortMappings = <T extends PortMapping>(
	mappings: readonly T[],
): T[] => {
	const seen = new Set<string>();
	const result: T[] = [];
	for (const mapping of mappings) {
		if (
			!isValidPortNumber(mapping.publishedPort) ||
			!isValidPortNumber(mapping.targetPort)
		) {
			continue;
		}
		const key = `${mapping.publishedPort}/${mapping.protocol}`;
		if (seen.has(key)) {
			continue;
		}
		seen.add(key);
		result.push(mapping);
	}
	return result;
};
