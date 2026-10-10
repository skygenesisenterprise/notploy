import {
	AlertTriangle,
	Building2,
	CreditCard,
	ExternalLink,
	Loader2,
	Server,
	Users,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { api } from "@/utils/api";

const PLAN_LABELS: Record<string, string> = {
	hobby: "Hobby",
	startup: "Startup",
	legacy: "Legacy",
};

const SUBSCRIPTION_STATUS_LABELS: Record<string, string> = {
	active: "Active",
	trialing: "Trialing",
	past_due: "Past due",
	canceled: "Canceled",
	unpaid: "Unpaid",
	incomplete: "Incomplete",
	incomplete_expired: "Expired",
	paused: "Paused",
};

const formatDate = (value: Date | string | null) => {
	if (!value) return null;
	const date = typeof value === "string" ? new Date(value) : value;
	if (Number.isNaN(date.getTime())) return null;
	return date.toLocaleDateString(undefined, {
		year: "numeric",
		month: "short",
		day: "numeric",
	});
};

const UsageRow = ({
	label,
	icon: Icon,
	used,
	limit,
}: {
	label: string;
	icon: typeof Server;
	used: number;
	limit: number | null;
}) => {
	const percentage =
		limit && limit > 0
			? Math.min((used / limit) * 100, 100)
			: used > 0
				? 100
				: 0;
	return (
		<div className="flex flex-col gap-2">
			<div className="flex items-center justify-between text-sm">
				<span className="flex items-center gap-2 text-muted-foreground">
					<Icon className="size-4" />
					{label}
				</span>
				<span className="font-medium">
					{used}
					{limit !== null ? ` / ${limit}` : " / Unlimited"}
				</span>
			</div>
			<Progress value={percentage} />
		</div>
	);
};

/**
 * Organization-level billing overview.
 *
 * Summarises the plan the organization is on, its consumption against the
 * plan's limits, the card on file, and the billing contact. Any mutation is
 * delegated to the Stripe customer portal so Notploy never handles card data.
 */
export const BillingOverview = () => {
	const { data: overview, isPending: isOverviewPending } =
		api.stripe.getBillingOverview.useQuery();
	const { data: usage } = api.stripe.getUsage.useQuery();
	const { data: paymentMethods } = api.stripe.getPaymentMethods.useQuery();
	const { data: contact } = api.stripe.getBillingContact.useQuery();
	const {
		mutateAsync: createCustomerPortalSession,
		isPending: isOpeningPortal,
	} = api.stripe.createCustomerPortalSession.useMutation();

	const openPortal = async () => {
		const session = await createCustomerPortalSession().catch(() => null);
		if (session?.url) {
			window.open(session.url, "_blank");
			return;
		}
		toast.error("Unable to open the billing portal");
	};

	if (isOverviewPending) {
		return (
			<Card>
				<CardContent className="flex items-center justify-center py-10 text-muted-foreground">
					<Loader2 className="mr-2 size-4 animate-spin" />
					Loading billing details…
				</CardContent>
			</Card>
		);
	}

	if (overview?.isEnterpriseCloud) {
		return (
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Building2 className="size-5 text-muted-foreground" />
						Enterprise billing
					</CardTitle>
					<CardDescription>
						Your organization is billed directly under an Enterprise agreement.
						Contact your account manager for invoices or plan changes.
					</CardDescription>
				</CardHeader>
			</Card>
		);
	}

	if (!overview) {
		return null;
	}

	const planLabel = overview.plan ? PLAN_LABELS[overview.plan] : null;
	const statusLabel = overview.isOnTrial
		? "Free trial"
		: overview.subscriptionStatus
			? (SUBSCRIPTION_STATUS_LABELS[overview.subscriptionStatus] ??
				overview.subscriptionStatus)
			: null;
	const renewal = formatDate(overview.currentPeriodEnd);
	const trialEnd = formatDate(overview.trialEndsAt);
	const defaultMethod = paymentMethods?.paymentMethods.find(
		(method) => method.id === paymentMethods.defaultPaymentMethodId,
	);
	const hasCustomer = !!overview.customerEmail;

	return (
		<div className="grid gap-4 lg:grid-cols-3">
			<Card className="lg:col-span-2">
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<CreditCard className="size-5 text-muted-foreground" />
						Current plan
					</CardTitle>
					<CardDescription>
						The subscription that powers this organization and every project in
						it.
					</CardDescription>
				</CardHeader>
				<CardContent className="flex flex-col gap-5">
					<div className="flex flex-wrap items-center gap-3">
						<span className="text-2xl font-semibold tracking-tight">
							{planLabel ?? (overview.isOnTrial ? "Trial" : "No active plan")}
						</span>
						{statusLabel && (
							<Badge variant="secondary" className="w-fit">
								{statusLabel}
							</Badge>
						)}
						{overview.isAnnual && (
							<Badge variant="outline" className="w-fit">
								Annual
							</Badge>
						)}
					</div>

					{overview.isOnTrial && (
						<div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/10 p-3 text-sm">
							<AlertTriangle className="mt-0.5 size-4 shrink-0 text-primary" />
							<span>
								{overview.trialDaysRemaining !== null &&
								overview.trialDaysRemaining > 0
									? `${overview.trialDaysRemaining} day${
											overview.trialDaysRemaining === 1 ? "" : "s"
										} left in your free trial`
									: "Your free trial ends today"}
								{trialEnd ? ` (ends ${trialEnd})` : ""}.
								{!overview.hasPaymentMethod &&
									" Add a payment method to keep your servers."}
							</span>
						</div>
					)}

					{!overview.isOnTrial && renewal && (
						<p className="text-sm text-muted-foreground">
							{overview.cancelAtPeriodEnd
								? `Cancels on ${renewal}.`
								: `Renews on ${renewal}.`}
						</p>
					)}

					{!overview.hasActiveAccess && (
						<div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm">
							<AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
							<span>
								This organization has no active plan. Choose a plan below to
								activate your servers.
							</span>
						</div>
					)}

					<div className="flex flex-wrap gap-2">
						{hasCustomer && (
							<Button
								variant="outline"
								isLoading={isOpeningPortal}
								onClick={openPortal}
							>
								<ExternalLink className="mr-2 size-4" />
								Manage subscription
							</Button>
						)}
					</div>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle className="text-base">Usage</CardTitle>
					<CardDescription>
						Consumption against your plan limits.
					</CardDescription>
				</CardHeader>
				<CardContent className="flex flex-col gap-4">
					{(usage?.resources ?? []).map((resource) => (
						<UsageRow
							key={resource.resource}
							label={resource.label}
							icon={
								resource.resource === "server"
									? Server
									: resource.resource === "member"
										? Users
										: Building2
							}
							used={resource.used}
							limit={resource.limit}
						/>
					))}
					{!usage?.resources?.length && (
						<p className="text-sm text-muted-foreground">
							No usage information available yet.
						</p>
					)}
				</CardContent>
			</Card>

			<Card className="lg:col-span-2">
				<CardHeader>
					<CardTitle className="flex items-center gap-2 text-base">
						<CreditCard className="size-4 text-muted-foreground" />
						Payment method
					</CardTitle>
					<CardDescription>
						Cards are stored securely by Stripe. Notploy never sees your card
						details.
					</CardDescription>
				</CardHeader>
				<CardContent className="flex flex-wrap items-center justify-between gap-3">
					{defaultMethod ? (
						<div className="text-sm">
							<span className="font-medium capitalize">
								{defaultMethod.brand ?? "Card"}
							</span>{" "}
							<span className="text-muted-foreground">
								•••• {defaultMethod.last4}
								{defaultMethod.expMonth && defaultMethod.expYear
									? ` · expires ${String(defaultMethod.expMonth).padStart(2, "0")}/${defaultMethod.expYear}`
									: ""}
							</span>
						</div>
					) : (
						<p className="text-sm text-muted-foreground">
							{overview.hasPaymentMethod
								? "A payment method is on file."
								: "No payment method on file."}
						</p>
					)}
					{hasCustomer && (
						<Button variant="outline" size="sm" onClick={openPortal}>
							Update payment method
						</Button>
					)}
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle className="text-base">Billing contact</CardTitle>
					<CardDescription>
						Where invoices and receipts are sent.
					</CardDescription>
				</CardHeader>
				<CardContent className="flex flex-col gap-1 text-sm">
					{contact?.name && <span className="font-medium">{contact.name}</span>}
					<span className="text-muted-foreground">
						{contact?.email ?? "No billing email on file"}
					</span>
				</CardContent>
			</Card>
		</div>
	);
};
