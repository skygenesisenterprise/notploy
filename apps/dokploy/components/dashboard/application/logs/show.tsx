import React, { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectLabel,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { TerminalLine } from "../../docker/logs/terminal-line";
import type { LogLine } from "../../docker/logs/utils";
import { parseLogs } from "../../docker/logs/utils";
import { api } from "@/utils/api";

interface ShowLogsProps {
	open: boolean;
	onClose: () => void;
	logs: LogLine[];
	title?: string;
	description?: string;
	loading?: boolean;
}

export const badgeStateColor = (state: string): "green" | "red" | "yellow" | "default" => {
	switch (state.toLowerCase()) {
		case "running":
			return "green";
		case "stopped":
			return "red";
		case "pending":
			return "yellow";
		case "error":
			return "red";
		default:
			return "default";
	}
};

export const ShowLogs: React.FC<ShowLogsProps> = ({
	open,
	onClose,
	logs,
	title = "Application Logs",
	description = "View the application logs in real-time",
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

interface ShowDockerLogsProps {
	serverId: string;
	appName: string;
	type?: "standalone" | "swarm";
}

export const ShowDockerLogs: React.FC<ShowDockerLogsProps> = ({
	serverId,
	appName,
	type = "standalone",
}) => {
	const { data, isLoading } = api.docker.getContainersByAppLabel.useQuery(
		{
			appName,
			serverId,
			type,
		},
		{
			enabled: !!appName,
		},
	);
	const [containerId, setContainerId] = useState<string | undefined>();
	const [logsData, setLogsData] = useState("");
	const [parsedLogs, setParsedLogs] = useState<LogLine[]>([]);
	const wsRef = useRef<WebSocket | null>(null);
	const [autoScroll, setAutoScroll] = useState(true);
	const scrollRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (data && data?.length > 0 && !containerId) {
			setContainerId(data[0]?.containerId);
		}
	}, [data, containerId]);

	useEffect(() => {
		if (!containerId) {
			setLogsData("");
			setParsedLogs([]);
			return;
		}

		setLogsData("");
		const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
		const runType = type === "swarm" ? "swarm" : "native";
		const wsUrl = `${protocol}//${window.location.host}/docker-container-logs?containerId=${containerId}&serverId=${serverId}&runType=${runType}&tail=100&since=1h`;

		const ws = new WebSocket(wsUrl);
		wsRef.current = ws;

		ws.onmessage = (e) => {
			setLogsData((currentData) => currentData + e.data);
		};

		ws.onerror = (error) => {
			console.error("WebSocket error: ", error);
		};

		ws.onclose = () => {
			wsRef.current = null;
		};

		return () => {
			if (wsRef.current?.readyState === WebSocket.OPEN) {
				ws.close();
				wsRef.current = null;
			}
		};
	}, [containerId, serverId, type]);

	useEffect(() => {
		const logs = parseLogs(logsData);
		setParsedLogs(logs);
	}, [logsData]);

	useEffect(() => {
		if (autoScroll && scrollRef.current) {
			scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
		}
	}, [parsedLogs, autoScroll]);

	const handleScroll = () => {
		if (!scrollRef.current) return;
		const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
		const isAtBottom = Math.abs(scrollHeight - scrollTop - clientHeight) < 10;
		setAutoScroll(isAtBottom);
	};

	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-col gap-2">
				<Label>Select a container to view logs</Label>
				<Select onValueChange={setContainerId} value={containerId}>
					<SelectTrigger>
						{isLoading ? (
							<div className="flex flex-row gap-2 items-center justify-center text-sm text-muted-foreground">
								<span>Loading...</span>
								<Loader2 className="animate-spin size-4" />
							</div>
						) : (
							<SelectValue placeholder="Select a container" />
						)}
					</SelectTrigger>
					<SelectContent>
						<SelectGroup>
							{data?.map((container) => (
								<SelectItem
									key={container.containerId}
									value={container.containerId}
								>
									{container.name} ({container.containerId}){" "}
									<Badge variant={badgeStateColor(container.state)}>
										{container.state}
									</Badge>
								</SelectItem>
							))}
							<SelectLabel>Containers ({data?.length || 0})</SelectLabel>
						</SelectGroup>
					</SelectContent>
				</Select>
			</div>
			<div
				ref={scrollRef}
				onScroll={handleScroll}
				className="h-[600px] overflow-y-auto space-y-0 border p-4 bg-[#fafafa] dark:bg-[#050506] rounded custom-logs-scrollbar"
			>
				{parsedLogs.length > 0 ? (
					parsedLogs.map((log: LogLine, index: number) => (
						<TerminalLine key={index} log={log} noTimestamp />
					))
				) : containerId ? (
					<div className="flex justify-center items-center h-full text-muted-foreground">
						<Loader2 className="h-6 w-6 animate-spin" />
					</div>
				) : (
					<div className="flex justify-center items-center h-full text-muted-foreground">
						<span>Select a container to view logs</span>
					</div>
				)}
			</div>
		</div>
	);
};
