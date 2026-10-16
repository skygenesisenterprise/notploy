import copy from "copy-to-clipboard";
import { Copy, InfoIcon, Server } from "lucide-react";
import { toast } from "sonner";
import { OnionRowActions } from "@/components/dashboard/compose/onion/onion-row-actions";
import {
	type OnionServiceListItem,
	OnionStatusBadge,
} from "@/components/dashboard/compose/onion/onion-status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
} from "@/components/ui/card";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { api } from "@/utils/api";
import { cn } from "@/lib/utils";

/**
 * Grid representation of a managed Onion Service, rendered next to the DNS
 * domain cards: an onion address is another way to reach the service, so it
 * belongs to the same list.
 */
export const OnionServiceCard = ({
	onionService,
}: {
	onionService: OnionServiceListItem;
}) => {
	const { data: runtime } = api.onion.status.useQuery(
		{ onionServiceId: onionService.onionServiceId },
		{ refetchInterval: 10000 },
	);

	const status = runtime?.status ?? onionService.status;
	const address = runtime?.onionAddress ?? onionService.onionAddress;

	return (
		<Card
			className={cn(
				"relative h-fit w-full overflow-hidden border bg-transparent transition-all hover:shadow-md",
				status !== "running" && "opacity-80",
			)}
		>
			<CardContent className="p-6">
				<div className="flex flex-col gap-4">
					<div className="flex flex-wrap items-center justify-between gap-y-2">
						<Badge variant="outline" className="w-fit">
							<Server className="mr-1 size-3" />
							{onionService.serviceName}
						</Badge>
						<OnionRowActions onionService={onionService} />
					</div>

					<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
						<div className="flex w-full items-center gap-2 break-all">
							{address ? (
								<>
									<code className="text-base font-medium">{address}</code>
									<Button
										variant="ghost"
										size="icon"
										className="size-7 shrink-0"
										onClick={() => {
											copy(address);
											toast.success("Address copied");
										}}
									>
										<Copy className="size-3.5" />
									</Button>
								</>
							) : (
								<span className="text-muted-foreground text-sm">
									No address published yet
								</span>
							)}
						</div>
						<div className="flex shrink-0 items-center">
							<OnionStatusBadge status={status} />
						</div>
					</div>

					<div className="flex flex-wrap gap-3">
						<TooltipProvider>
							<Tooltip>
								<TooltipTrigger asChild>
									<Badge variant="secondary">
										<InfoIcon className="mr-1 size-3" />
										Port: {onionService.targetPort}
									</Badge>
								</TooltipTrigger>
								<TooltipContent>
									<p>Container port exposed through Tor</p>
								</TooltipContent>
							</Tooltip>
						</TooltipProvider>

						<TooltipProvider>
							<Tooltip>
								<TooltipTrigger asChild>
									<Badge variant="secondary">
										<InfoIcon className="mr-1 size-3" />
										Onion port: {onionService.virtualPort}
									</Badge>
								</TooltipTrigger>
								<TooltipContent>
									<p>Port exposed on the .onion address</p>
								</TooltipContent>
							</Tooltip>
						</TooltipProvider>

						<TooltipProvider>
							<Tooltip>
								<TooltipTrigger asChild>
									<Badge variant="outline">Tor</Badge>
								</TooltipTrigger>
								<TooltipContent className="max-w-xs">
									<p>
										Served over the Tor network only: the address is not a DNS
										record and is not routed through Traefik.
									</p>
								</TooltipContent>
							</Tooltip>
						</TooltipProvider>
					</div>

					{onionService.lastError && status === "error" && (
						<span className="text-destructive text-xs">
							{onionService.lastError}
						</span>
					)}
				</div>
			</CardContent>
		</Card>
	);
};
