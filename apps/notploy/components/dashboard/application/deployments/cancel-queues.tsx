import { Ban } from "lucide-react";
import { toast } from "sonner";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { api } from "@/utils/api";

interface Props {
	id: string;
	type: "application" | "compose";
}

export const CancelQueues = ({ id, type }: Props) => {
	const applicationMutation = api.application.cleanQueues.useMutation();
	const composeMutation = api.compose.cleanQueues.useMutation();
	const { mutateAsync, isPending } = type === "application" ? applicationMutation : composeMutation;
	const { data: isCloud } = api.settings.isCloud.useQuery();
	const { data: product } = api.settings.getProduct.useQuery();
	// The console shares the cloud runtime (IS_CLOUD=true) but keeps the
	// self-hosted feature set: only a managed Cloud hides this action.
	const isManagedCloud = !!isCloud && !!product && product !== "console";

	if (isManagedCloud) {
		return null;
	}

	return (
		<AlertDialog>
			<AlertDialogTrigger asChild>
				<Button variant="destructive" className="w-fit" isLoading={isPending}>
					Cancel Queues
					<Ban className="size-4" />
				</Button>
			</AlertDialogTrigger>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>
						Are you sure to cancel the incoming deployments?
					</AlertDialogTitle>
					<AlertDialogDescription>
						This will cancel all the incoming deployments
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel>Cancel</AlertDialogCancel>
					<AlertDialogAction
						onClick={async () => {
							await mutateAsync({
								applicationId: id || "",
								composeId: id || "",
							})
								.then(() => {
									toast.success("Queues are being cleaned");
								})
								.catch((err) => {
									toast.error(err.message);
								});
						}}
					>
						Confirm
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
};
