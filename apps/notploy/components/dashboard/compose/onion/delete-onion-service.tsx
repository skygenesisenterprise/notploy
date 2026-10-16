import { Trash2 } from "lucide-react";
import { useState } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { api } from "@/utils/api";

interface Props {
	composeId: string;
	onionServiceId: string;
	/** `button` for the standalone action, `icon` inside a list or table row. */
	trigger?: "button" | "icon";
}

export const DeleteOnionService = ({
	composeId,
	onionServiceId,
	trigger = "button",
}: Props) => {
	const utils = api.useUtils();
	const [deleteIdentity, setDeleteIdentity] = useState(false);

	const { mutateAsync, isPending } = api.onion.delete.useMutation();

	const onDelete = async () => {
		try {
			await mutateAsync({ onionServiceId, deleteIdentity });
			toast.success("Onion Service deleted");
			await utils.onion.list.invalidate({ composeId });
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: "Could not delete the Onion Service",
			);
		}
	};

	return (
		<AlertDialog>
			<AlertDialogTrigger asChild>
				{trigger === "icon" ? (
					<Button
						variant="ghost"
						size="icon"
						className="group h-8 w-8 hover:bg-red-500/10"
						isLoading={isPending}
						title="Delete the Onion Service"
					>
						<Trash2 className="size-4 text-primary group-hover:text-red-500" />
					</Button>
				) : (
					<Button variant="destructive" size="sm">
						Delete
					</Button>
				)}
			</AlertDialogTrigger>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>Delete this Onion Service?</AlertDialogTitle>
					<AlertDialogDescription>
						The managed Tor container and the generated configuration are
						removed. The onion identity is kept by default, which makes the
						same address recoverable.
					</AlertDialogDescription>
				</AlertDialogHeader>

				<div className="flex items-start gap-2 rounded-lg border border-destructive/40 p-3">
					<Checkbox
						id={`delete-identity-${onionServiceId}`}
						checked={deleteIdentity}
						onCheckedChange={(checked) => setDeleteIdentity(checked === true)}
					/>
					<Label
						htmlFor={`delete-identity-${onionServiceId}`}
						className="flex flex-col gap-1"
					>
						<span>Also destroy the onion identity (private key)</span>
						<span className="font-normal text-muted-foreground text-xs">
							Irreversible: the <strong>.onion</strong> address can never be
							recovered or recreated. Only do this to deliberately burn the
							address.
						</span>
					</Label>
				</div>

				<AlertDialogFooter>
					<AlertDialogCancel>Cancel</AlertDialogCancel>
					<AlertDialogAction
						disabled={isPending}
						onClick={onDelete}
						variant="destructive"
					>
						Confirm
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
};
