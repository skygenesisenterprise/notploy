import { HelpCircle } from "lucide-react";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { api } from "@/utils/api";

interface Props {
	serverId?: string;
}
export const ToggleDockerCleanup = ({ serverId }: Props) => {
	const { data, refetch } = api.settings.getWebServerSettings.useQuery(
		undefined,
		{
			enabled: !serverId,
		},
	);

	const { data: server, refetch: refetchServer } = api.server.one.useQuery(
		{
			serverId: serverId || "",
		},
		{
			enabled: !!serverId,
		},
	);

	const enabled = serverId
		? server?.enableDockerCleanup
		: data?.enableDockerCleanup;

	const { mutateAsync } = api.settings.updateDockerCleanup.useMutation();

	const handleToggle = async (checked: boolean) => {
		try {
			await mutateAsync({
				enableDockerCleanup: checked,
				...(serverId && { serverId }),
			} as {
				enableDockerCleanup: boolean;
				serverId?: string;
			});
			if (serverId) {
				await refetchServer();
			} else {
				await refetch();
			}
			toast.success("Docker Cleanup updated");
		} catch {
			toast.error("Docker Cleanup Error");
		}
	};

	return (
		<div className="flex items-center gap-4">
			<Switch checked={!!enabled} onCheckedChange={handleToggle} />
			<TooltipProvider delayDuration={0}>
				<Tooltip>
					<TooltipTrigger asChild>
						<Label className="text-primary flex items-center gap-1.5 cursor-pointer">
							Daily Docker Cleanup
							<HelpCircle className="size-4 text-muted-foreground" />
						</Label>
					</TooltipTrigger>
					<TooltipContent side="top" className="max-w-sm">
						<p>
							When enabled, Notploy automatically runs Docker cleanup once a day
							on this server. It removes stopped containers, unused images, and
							build cache to reclaim disk space. Images used only by on-demand
							Compose services—such as backup runners, scheduled jobs, or
							one-off tasks—may be removed too. Docker will need to pull or
							rebuild those images the next time the services run, which can
							delay their startup.
						</p>
						<p className="mt-1">
							Leave this off if you need to retain those images or want to
							control when cleanup runs. For a custom cleanup schedule, create a{" "}
							<a
								href="https://docs.notploy.com/docs/core/schedule-jobs#example-1-automatic-docker-cleanup"
								target="_blank"
								rel="noopener noreferrer"
								className="underline text-primary"
							>
								Schedule Jobs
							</a>{" "}
							on the web server or a remote server.
						</p>
					</TooltipContent>
				</Tooltip>
			</TooltipProvider>
		</div>
	);
};
