import { BillingShell } from "@/components/dashboard/settings/billing/billing-shell";
import { ShowInvoices } from "./show-invoices";

export const ShowBillingInvoices = () => {
	return (
		<BillingShell>
			<ShowInvoices />
		</BillingShell>
	);
};
