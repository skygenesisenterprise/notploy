import { createMetricUsage } from "@notploy/server/monitoring/status";
import { formatMb } from "@notploy/server/monitoring/units";
import { Cpu, HardDrive, MemoryStick } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricUsage } from "@/components/dashboard/monitoring/metric-usage";
import { api } from "@/utils/api";
import { DockerBlockChart } from "./docker-block-chart";
import { DockerCpuChart } from "./docker-cpu-chart";
import { DockerDiskChart } from "./docker-disk-chart";
import { DockerDiskUsageChart } from "./docker-disk-usage-chart";
import { DockerMemoryChart } from "./docker-memory-chart";
import { DockerNetworkChart } from "./docker-network-chart";

const defaultData = {
	cpu: {
		value: "0%",
		time: "",
	},
	memory: {
		value: {
			used: 0,
			total: 0,
		},
		time: "",
	},
	block: {
		value: {
			readMb: 0,
			writeMb: 0,
		},
		time: "",
	},
	network: {
		value: {
			inputMb: 0,
			outputMb: 0,
		},
		time: "",
	},
	disk: {
		value: { diskTotal: 0, diskUsage: 0, diskUsedPercentage: 0, diskFree: 0 },
		time: "",
	},
};

interface Props {
	appName: string;
	appType?: "application" | "stack" | "docker-compose";
}
export interface DockerStats {
	cpu: {
		value: string;
		time: string;
	};
	memory: {
		value: {
			used: number;
			total: number;
		};
		time: string;
	};
	block: {
		value: {
			readMb: number;
			writeMb: number;
		};
		time: string;
	};
	network: {
		value: {
			inputMb: number;
			outputMb: number;
		};
		time: string;
	};
	disk: {
		value: {
			diskTotal: number;
			diskUsage: number;
			diskUsedPercentage: number;
			diskFree: number;
		};

		time: string;
	};
}

export type DockerStatsJSON = {
	cpu: DockerStats["cpu"][];
	memory: DockerStats["memory"][];
	block: DockerStats["block"][];
	network: DockerStats["network"][];
	disk: DockerStats["disk"][];
};

export const convertMemoryToBytes = (
	memoryString: string | number | undefined,
): number => {
	if (typeof memoryString === "number") {
		return Number.isFinite(memoryString) ? memoryString : 0;
	}
	if (!memoryString || typeof memoryString !== "string") {
		return 0;
	}

	const value = Number.parseFloat(memoryString) || 0;
	const unit = memoryString.replace(/[0-9.]/g, "").trim();

	switch (unit) {
		case "KiB":
			return value * 1024;
		case "MiB":
			return value * 1024 * 1024;
		case "GiB":
			return value * 1024 * 1024 * 1024;
		case "TiB":
			return value * 1024 * 1024 * 1024 * 1024;
		default:
			return value;
	}
};

const formatMemoryBytes = (bytes: number): string => {
	if (!Number.isFinite(bytes) || bytes <= 0) {
		return "0 B";
	}
	const units = ["B", "KiB", "MiB", "GiB", "TiB"];
	let value = bytes;
	let unitIndex = 0;
	while (value >= 1024 && unitIndex < units.length - 1) {
		value /= 1024;
		unitIndex += 1;
	}
	return `${value.toFixed(value >= 10 ? 1 : 2)} ${units[unitIndex]}`;
};

export const ContainerFreeMonitoring = ({
	appName,
	appType = "application",
}: Props) => {
	const { data } = api.application.readAppMonitoring.useQuery(
		{ appName },
		{
			refetchOnWindowFocus: false,
		},
	);
	const [accumulativeData, setAccumulativeData] = useState<DockerStatsJSON>({
		cpu: [],
		memory: [],
		block: [],
		network: [],
		disk: [],
	});
	const [currentData, setCurrentData] = useState<DockerStats>(defaultData);

	// Capacity metrics are normalized once here so the UI never computes its own
	// percentage for CPU, memory or disk.
	const cpuPercentage = Number.parseFloat(
		String(currentData.cpu.value ?? "0%").replace("%", ""),
	);
	const cpuUsage = createMetricUsage({
		used: cpuPercentage,
		percentage: cpuPercentage,
		kind: "cpu",
	});
	const memoryUsage = createMetricUsage({
		used: convertMemoryToBytes(currentData.memory.value.used),
		total: convertMemoryToBytes(currentData.memory.value.total),
		kind: "memory",
	});
	const diskUsage = createMetricUsage({
		used: currentData.disk.value.diskUsage,
		total: currentData.disk.value.diskTotal,
		percentage: currentData.disk.value.diskUsedPercentage,
		kind: "disk",
	});

	useEffect(() => {
		setCurrentData(defaultData);

		setAccumulativeData({
			cpu: [],
			memory: [],
			block: [],
			network: [],
			disk: [],
		});
	}, [appName]);

	useEffect(() => {
		if (!data) return;

		setCurrentData({
			cpu: data.cpu[data.cpu.length - 1] ?? currentData.cpu,
			memory: data.memory[data.memory.length - 1] ?? currentData.memory,
			block: data.block[data.block.length - 1] ?? currentData.block,
			network: data.network[data.network.length - 1] ?? currentData.network,
			disk: data.disk[data.disk.length - 1] ?? currentData.disk,
		});
		setAccumulativeData({
			block: data?.block || [],
			cpu: data?.cpu || [],
			disk: data?.disk || [],
			memory: data?.memory || [],
			network: data?.network || [],
		});
	}, [data]);

	useEffect(() => {
		if (!appName) return;

		const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
		const wsUrl = `${protocol}//${window.location.host}/listen-docker-stats-monitoring?appName=${appName}&appType=${appType}`;
		const ws = new WebSocket(wsUrl);

		ws.onmessage = (e) => {
			const value = JSON.parse(e.data);
			if (!value) return;

			const data = {
				cpu: value.data.cpu ?? currentData.cpu,
				memory: value.data.memory ?? currentData.memory,
				block: value.data.block ?? currentData.block,
				disk: value.data.disk ?? currentData.disk,
				network: value.data.network ?? currentData.network,
			};

			setCurrentData(data);

			const MAX_DATA_POINTS = 300;
			setAccumulativeData((prevData) => ({
				cpu: [...prevData.cpu, data.cpu].slice(-MAX_DATA_POINTS),
				memory: [...prevData.memory, data.memory].slice(-MAX_DATA_POINTS),
				block: [...prevData.block, data.block].slice(-MAX_DATA_POINTS),
				network: [...prevData.network, data.network].slice(-MAX_DATA_POINTS),
				disk: [...prevData.disk, data.disk].slice(-MAX_DATA_POINTS),
			}));
		};

		ws.onclose = (e) => {
			if (e.reason) {
				toast.error(e.reason);
			}
		};

		return () => ws.close();
	}, [appName]);

	return (
		<div className="rounded-xl bg-background flex flex-col gap-4">
			<div className="grid gap-6 lg:grid-cols-2">
				<Card className="bg-background">
					<CardContent className="pt-6">
						<MetricUsage
							label="CPU Usage"
							icon={Cpu}
							used={cpuUsage.percentage}
							percentage={cpuUsage.percentage}
							status={cpuUsage.status}
						>
							<DockerCpuChart accumulativeData={accumulativeData.cpu} />
						</MetricUsage>
					</CardContent>
				</Card>
				<Card className="bg-background">
					<CardContent className="pt-6">
						<MetricUsage
							label="Memory Usage"
							icon={MemoryStick}
							used={memoryUsage.used}
							total={memoryUsage.total}
							percentage={memoryUsage.percentage}
							status={memoryUsage.status}
							formatValue={formatMemoryBytes}
						>
							<DockerMemoryChart
								accumulativeData={accumulativeData.memory}
								memoryLimitGB={memoryUsage.total / 1024 ** 3}
							/>
						</MetricUsage>
					</CardContent>
				</Card>
				{appName === "notploy" && (					<Card className="bg-background">
						<CardContent className="pt-6">
							<MetricUsage
								label="Disk Space"
							icon={HardDrive}
							used={diskUsage.used}
							total={diskUsage.total}
							unit="GB"
							percentage={diskUsage.percentage}
							status={diskUsage.status}
						>
							<DockerDiskChart
								accumulativeData={accumulativeData.disk}
								diskTotal={currentData.disk.value.diskTotal}
							/>
						</MetricUsage>
					</CardContent>
					</Card>
				)}
				{appName === "notploy" && (
					<Card className="bg-background">
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="text-sm font-medium">
								Docker Disk Usage
							</CardTitle>
						</CardHeader>
						<CardContent>
							<DockerDiskUsageChart />
						</CardContent>
					</Card>
				)}

				<Card className="bg-background">
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">Block I/O</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="flex flex-col gap-2 w-full">
							<span className="text-sm text-muted-foreground">
								{`Read: ${formatMb(currentData.block.value.readMb)} / Write: ${formatMb(currentData.block.value.writeMb)}`}
							</span>
							<DockerBlockChart accumulativeData={accumulativeData.block} />
						</div>
					</CardContent>
				</Card>
				<Card className="bg-background">
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">Network I/O</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="flex flex-col gap-2 w-full">
							<span className="text-sm text-muted-foreground">
								{`In: ${formatMb(currentData.network.value.inputMb)} / Out: ${formatMb(currentData.network.value.outputMb)}`}
							</span>
							<DockerNetworkChart accumulativeData={accumulativeData.network} />
						</div>
					</CardContent>
				</Card>
			</div>
		</div>
	);
};
