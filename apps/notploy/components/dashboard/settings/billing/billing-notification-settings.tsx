import { Bell } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { api } from "@/utils/api";

/**
 * Billing email notification preferences.
 *
 * Rendered as an icon button in the Billing header. Only organizations with a
 * Stripe subscription or an Enterprise agreement can manage the preference,
 * so the component renders nothing for everyone else.
 */
export const BillingNotificationSettings = () => {
	const { data: admin } = api.user.get.useQuery();
	const { mutateAsync: updateInvoiceNotifications } =
		api.stripe.updateInvoiceNotifications.useMutation();
	const utils = api.useUtils();

	const canManageNotifications =
		!!admin?.user.stripeSubscriptionId || !!admin?.user.isEnterpriseCloud;

	if (!canManageNotifications) {
		return null;
	}

	return (
		<Dialog>
			<DialogTrigger asChild>
				<Button
					variant="outline"
					size="icon"
					aria-label="Notification settings"
				>
					<Bell className="size-4" />
				</Button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Notification Settings</DialogTitle>
					<DialogDescription>
						Configure your billing email notifications.
					</DialogDescription>
				</DialogHeader>
				<div className="flex items-center justify-between rounded-lg border p-4">
					<div className="space-y-0.5">
						<Label htmlFor="invoice-notifications">Invoice Notifications</Label>
						<p className="text-sm text-muted-foreground">
							Receive email notifications for payments and failed charges.
						</p>
					</div>
					<Switch
						id="invoice-notifications"
						checked={admin?.user.sendInvoiceNotifications ?? false}
						onCheckedChange={async (checked) => {
							await updateInvoiceNotifications({ enabled: checked })
								.then(() => {
									utils.user.get.invalidate();
									toast.success(
										checked
											? "Invoice notifications enabled"
											: "Invoice notifications disabled",
									);
								})
								.catch(() => {
									toast.error("Failed to update invoice notifications");
								});
						}}
					/>
				</div>
			</DialogContent>
		</Dialog>
	);
};
