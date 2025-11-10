export interface LogLine {
	timestamp?: string;
	message: string;
	level?: string;
}

export function parseLogs(logs: string): LogLine[] {
	if (!logs) return [];

	const lines = logs.split("\n").filter((line) => line.trim());

	return lines.map((line) => {
		// Try to extract timestamp from common log formats
		const timestampRegex = /^(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}[^\s]*)/;
		const match = line.match(timestampRegex);

		if (match) {
			return {
				timestamp: match[1],
				message: line.substring(match[0].length).trim(),
			};
		}

		return {
			message: line,
		};
	});
}
