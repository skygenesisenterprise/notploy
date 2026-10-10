import { CreditCard, FileText } from "lucide-react";
import { useRouter } from "next/router";
import type { ReactNode } from "react";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const BILLING_TABS = [
	{
		value: "subscription",
		label: "Subscription",
		href: "/dashboard/settings/billing",
		icon: CreditCard,
	},
	{
		value: "invoices",
		label: "Invoices",
		href: "/dashboard/settings/invoices",
		icon: FileText,
	},
] as const;

/**
 * Shared frame for the Billing section.
 *
 * Follows the settings design pattern (see the DNS providers page): a
 * sidebar-tinted card that wraps a content surface, a header with title,
 * description and an optional action, and the Subscription/Invoices
 * sub-navigation shared by both routes.
 */
export const BillingShell = ({
	children,
	action,
}: {
	children: ReactNode;
	action?: ReactNode;
}) => {
	const router = useRouter();
	const activeTab =
		BILLING_TABS.find((tab) => router.pathname === tab.href)?.value ??
		"subscription";

	return (
		<div className="w-full">
			<Card className="h-full w-full bg-sidebar p-2.5 rounded-xl">
				<div className="rounded-xl bg-background shadow-md">
					<div className="flex flex-wrap items-center justify-between gap-4 p-6">
						<CardHeader className="flex-1 p-0">
							<CardTitle className="text-xl flex flex-row gap-2">
								<CreditCard className="size-6 text-muted-foreground self-center" />
								Billing
							</CardTitle>
							<CardDescription>
								Manage your subscription, usage and invoices.
							</CardDescription>
						</CardHeader>
						{action && <div className="flex items-center gap-2">{action}</div>}
					</div>

					<CardContent className="flex min-h-[60vh] flex-col gap-4 border-t py-8">
						<Tabs
							value={activeTab}
							onValueChange={(value) => {
								const tab = BILLING_TABS.find((item) => item.value === value);
								if (tab && router.pathname !== tab.href)
									void router.push(tab.href);
							}}
							className="w-full"
						>
							<TabsList
								variant="line"
								className="w-full justify-start border-b"
							>
								{BILLING_TABS.map((tab) => {
									const Icon = tab.icon;
									return (
										<TabsTrigger key={tab.value} value={tab.value}>
											<Icon aria-hidden />
											{tab.label}
										</TabsTrigger>
									);
								})}
							</TabsList>
						</Tabs>

						{children}
					</CardContent>
				</div>
			</Card>
		</div>
	);
};
