import { useState } from "react";
import { OnionServiceForm } from "@/components/dashboard/compose/onion/onion-service-form";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";

interface Props {
	composeId: string;
	onionServiceId: string;
	children: React.ReactNode;
}

export const EditOnionService = ({
	composeId,
	onionServiceId,
	children,
}: Props) => {
	const [open, setOpen] = useState(false);

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger className="" asChild>
				{children}
			</DialogTrigger>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>Onion Service</DialogTitle>
					<DialogDescription>
						Update the target service and ports of this Tor Onion Service. The
						onion identity is kept, so the address does not change.
					</DialogDescription>
				</DialogHeader>

				<OnionServiceForm
					composeId={composeId}
					onionServiceId={onionServiceId}
					onDone={() => setOpen(false)}
				/>
			</DialogContent>
		</Dialog>
	);
};
