import React from "react";
import type { LogLine } from "./utils";

interface TerminalLineProps {
	log: LogLine;
	noTimestamp?: boolean;
}

export const TerminalLine: React.FC<TerminalLineProps> = ({
	log,
	noTimestamp = false,
}) => {
	const getLevelColor = (level?: string) => {
		switch (level?.toLowerCase()) {
			case "error":
				return "text-red-500";
			case "warn":
			case "warning":
				return "text-yellow-500";
			case "info":
				return "text-blue-500";
			case "debug":
				return "text-gray-500";
			default:
				return "text-gray-300";
		}
	};

	return (
		<div className="font-mono text-sm">
			{!noTimestamp && log.timestamp && (
				<span className="text-gray-500 mr-2">
					[{new Date(log.timestamp).toLocaleTimeString()}]
				</span>
			)}
			<span className={getLevelColor(log.level)}>{log.message}</span>
		</div>
	);
};
