import React from "react";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TerminalLine } from "../logs/terminal-line";
import type { LogLine } from "../logs/utils";

interface ShowDockerModalStackLogsProps {
	open: boolean;
	onClose: () => void;
	logs: LogLine[];
	stackName?: string;
	title?: string;
	description?: string;
	loading?: boolean;
}

export const ShowDockerModalStackLogs: React.FC<
	ShowDockerModalStackLogsProps
> = ({
	open,
	onClose,
	logs,
	stackName,
	title = "Stack Logs",
	description = stackName
		? `View logs for stack ${stackName}`
		: "View the stack logs in real-time",
	loading = false,
}) => {
	return (
		<Dialog open={open} onOpenChange={onClose}>
			<DialogContent className="max-w-4xl max-h-[80vh]">
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
					<DialogDescription>{description}</DialogDescription>
				</DialogHeader>
				<ScrollArea className="h-[60vh] w-full rounded-md border p-4">
					{loading ? (
						<div className="flex items-center justify-center h-full">
							<div className="text-sm text-gray-500">Loading logs...</div>
						</div>
					) : (
						<div className="space-y-1">
							{logs.map((log, index) => (
								<TerminalLine key={index} log={log} />
							))}
						</div>
					)}
				</ScrollArea>
				<div className="flex justify-end mt-4">
					<Button onClick={onClose}>Close</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
};
