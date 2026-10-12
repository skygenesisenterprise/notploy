import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { api } from "@/utils/api";

const DEFAULT_LOG_PATH = "/etc/notploy/traefik/dynamic/access.log";

/**
 * Declare a watched domain.
 *
 * Declaring a property is a configuration step: it creates the domain record and
 * its first collection source. It never invents data — a source starts in
 * `not-configured` and only becomes `active` once a collector has actually
 * received something.
 */
export const TrafficPropertyDialog = () => {
	const [open, setOpen] = useState(false);
	const [platform, setPlatform] = useState("website");
	const [domain, setDomain] = useState("");
	const [sourceType, setSourceType] = useState<
		"traefik" | "web-instrumentation" | "external"
	>("traefik");
	const [logPath, setLogPath] = useState(DEFAULT_LOG_PATH);
	const utils = api.useUtils();

	const { mutateAsync, isPending } = api.traffic.createProperty.useMutation({
		onSuccess: async () => {
			await utils.traffic.invalidate();
		},
	});

	const submit = async () => {
		try {
			await mutateAsync({
				platform: platform.trim() || "website",
				domain: domain.trim(),
				sourceType,
				logPath: sourceType === "traefik" ? logPath.trim() : undefined,
			});
			toast.success(`${domain.trim()} is now watched`);
			setDomain("");
			setOpen(false);
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Unable to add this domain",
			);
		}
	};

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button variant="outline">Add domain</Button>
			</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Watch a new domain</DialogTitle>
					<DialogDescription>
						The domain is matched together with its sub-domains by default, and
						associated with a collection source. No data is created here.
					</DialogDescription>
				</DialogHeader>
				<div className="space-y-4">
					<div className="space-y-1">
						<Label htmlFor="traffic-new-domain">Domain</Label>
						<Input
							id="traffic-new-domain"
							placeholder="notploy.com"
							value={domain}
							onChange={(event) => setDomain(event.target.value)}
						/>
					</div>
					<div className="space-y-1">
						<Label htmlFor="traffic-new-platform">Platform</Label>
						<Input
							id="traffic-new-platform"
							placeholder="website"
							value={platform}
							onChange={(event) => setPlatform(event.target.value)}
						/>
					</div>
					<div className="space-y-1">
						<Label htmlFor="traffic-new-source">Collection source</Label>
						<Select
							value={sourceType}
							onValueChange={(value) =>
								setSourceType(
									value as "traefik" | "web-instrumentation" | "external",
								)
							}
						>
							<SelectTrigger id="traffic-new-source">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="traefik">
									Reverse proxy access log
								</SelectItem>
								<SelectItem value="web-instrumentation">
									Web instrumentation
								</SelectItem>
								<SelectItem value="external">External provider</SelectItem>
							</SelectContent>
						</Select>
					</div>
					{sourceType === "traefik" && (
						<div className="space-y-1">
							<Label htmlFor="traffic-new-logpath">Access log path</Label>
							<Input
								id="traffic-new-logpath"
								value={logPath}
								onChange={(event) => setLogPath(event.target.value)}
							/>
							<p className="text-xs text-muted-foreground">
								The collector starts at the current end of file, so already
								logged traffic is not attributed to a domain declared later.
							</p>
						</div>
					)}
				</div>
				<DialogFooter>
					<Button variant="outline" onClick={() => setOpen(false)}>
						Cancel
					</Button>
					<Button
						onClick={submit}
						isLoading={isPending}
						disabled={domain.trim().length < 3}
					>
						Add domain
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};
