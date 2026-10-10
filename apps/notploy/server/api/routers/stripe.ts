import {
	findServersByUserId,
	findUserById,
	IS_CLOUD,
	updateUser,
} from "@notploy/server";
import { db } from "@notploy/server/db";
import { member, organization } from "@notploy/server/db/schema";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import Stripe from "stripe";
import { z } from "zod";
import {
	getBillingStatus,
	getCurrentPlan as getCurrentPlanForOrganization,
	getStripeClient,
	TRIAL_DURATION_DAYS,
	TRIAL_SERVER_LIMITS,
} from "@/server/utils/billing";
import { PLAN_LIMITS } from "@/server/api/utils/plan-limits";
import { PLAN_DEFINITIONS } from "@/utils/plans";
import {
	type BillingTier,
	getStripeItems,
	HOBBY_PRICE_ANNUAL_ID,
	HOBBY_PRICE_MONTHLY_ID,
	HOBBY_PRODUCT_ID,
	LEGACY_PRICE_IDS,
	PRODUCT_ANNUAL_ID,
	PRODUCT_MONTHLY_ID,
	STARTUP_BASE_PRICE_ANNUAL_ID,
	STARTUP_BASE_PRICE_MONTHLY_ID,
	STARTUP_PRODUCT_ID,
	WEBSITE_URL,
} from "@/server/utils/stripe";
import {
	createTRPCRouter,
	protectedProcedure,
	withPermission,
} from "../trpc";

/**
 * Resolves the account that owns billing for the active organization.
 *
 * Notploy Cloud keeps Stripe state on the organization owner's user row, so
 * every billing operation is scoped through that owner rather than the caller.
 * This is what makes billing organization-level even though the data model is
 * denormalized.
 */
const getBillingOwner = async (ctx: { user: { ownerId: string } }) => {
	const owner = await findUserById(ctx.user.ownerId);
	if (!owner) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Billing account not found",
		});
	}
	return owner;
};

const toDisplayLimit = (value: number) =>
	Number.isFinite(value) ? value : null;

export const stripeRouter = createTRPCRouter({
	/** Returns the current billing plan for the user's organization. Used to gate features like chat (Startup only). */
	getCurrentPlan: protectedProcedure.query(async ({ ctx }) => {
		return getCurrentPlanForOrganization(ctx.session.activeOrganizationId);
	}),

	getBillingStatus: protectedProcedure.query(async ({ ctx }) => {
		return getBillingStatus(ctx.user.ownerId);
	}),

	/**
	 * Organization-level billing snapshot: plan, trial, subscription renewal,
	 * payment-method presence, seat usage and the Stripe customer we bill.
	 */
	getBillingOverview: withPermission("billing", "read").query(async ({ ctx }) => {
		const owner = await getBillingOwner(ctx);
		const status = await getBillingStatus(owner.id);
		const servers = await findServersByUserId(owner.id);

		let subscriptionStatus: string | null = null;
		let currentPeriodEnd: Date | null = null;
		let cancelAtPeriodEnd = false;
		let customerEmail: string | null = owner.email;
		let customerName: string | null = null;

		if (owner.stripeCustomerId) {
			const stripe = getStripeClient();
			const customer = await stripe.customers.retrieve(owner.stripeCustomerId);
			if (!customer.deleted) {
				customerEmail = customer.email ?? owner.email;
				customerName = customer.name ?? null;
			}
			if (owner.stripeSubscriptionId) {
				const subscription = await stripe.subscriptions.retrieve(
					owner.stripeSubscriptionId,
				);
				subscriptionStatus = subscription.status;
				cancelAtPeriodEnd = subscription.cancel_at_period_end;
				currentPeriodEnd = subscription.current_period_end
					? new Date(subscription.current_period_end * 1000)
					: null;
			}
		}

		return {
			organizationId: ctx.session.activeOrganizationId,
			plan: status.plan,
			isOnTrial: status.isOnTrial,
			trialEndsAt: status.trialEndsAt,
			trialDaysRemaining: status.trialDaysRemaining,
			hasUsedTrial: status.hasUsedTrial,
			hasActiveAccess: status.hasActiveAccess,
			hasPaymentMethod: status.hasPaymentMethod,
			isAnnual: status.isAnnual,
			serversUsed: servers.length,
			serversIncluded: owner.serversQuantity,
			isEnterpriseCloud: owner.isEnterpriseCloud,
			customerEmail,
			customerName,
			subscriptionStatus,
			currentPeriodEnd,
			cancelAtPeriodEnd,
		};
	}),

	/** Public plan catalogue enriched with the enforced resource limits. */
	getPlans: withPermission("billing", "read").query(async () => {
		return PLAN_DEFINITIONS.map((plan) => {
			if (plan.id === "enterprise") {
				return { ...plan, limits: null };
			}
			const limits = PLAN_LIMITS[plan.id];
			return {
				...plan,
				limits: {
					organization: toDisplayLimit(limits.organization),
					member: toDisplayLimit(limits.member),
					environment: toDisplayLimit(limits.environment),
					volumeBackup: toDisplayLimit(limits.volumeBackup),
					databaseBackup: toDisplayLimit(limits.databaseBackup),
					scheduledJob: toDisplayLimit(limits.scheduledJob),
				},
			};
		});
	}),

	/** Current consumption against the organization's plan limits. */
	getUsage: withPermission("billing", "read").query(async ({ ctx }) => {
		const owner = await getBillingOwner(ctx);
		const organizationId = ctx.session.activeOrganizationId;
		const [servers, organizations, members, status] = await Promise.all([
			findServersByUserId(owner.id),
			db.query.organization.findMany({
				where: eq(organization.ownerId, owner.id),
			}),
			db.query.member.findMany({
				where: eq(member.organizationId, organizationId),
			}),
			getBillingStatus(owner.id),
		]);
		const limits = PLAN_LIMITS[status.plan ?? "legacy"];
		return {
			plan: status.plan,
			resources: [
				{
					resource: "server" as const,
					label: "Servers",
					used: servers.length,
					limit: owner.serversQuantity,
				},
				{
					resource: "organization" as const,
					label: "Organizations",
					used: organizations.length,
					limit: toDisplayLimit(limits.organization),
				},
				{
					resource: "member" as const,
					label: "Members",
					used: members.length,
					limit: toDisplayLimit(limits.member),
				},
			],
		};
	}),

	/** Saved payment methods on the organization's Stripe customer. */
	getPaymentMethods: withPermission("billing", "read").query(async ({ ctx }) => {
		const owner = await getBillingOwner(ctx);
		if (!owner.stripeCustomerId) {
			return { defaultPaymentMethodId: null, paymentMethods: [] };
		}
		const stripe = getStripeClient();
		try {
			let defaultPaymentMethodId: string | null = null;
			const customer = await stripe.customers.retrieve(owner.stripeCustomerId);
			if (!customer.deleted) {
				const fallback = customer.invoice_settings?.default_payment_method;
				defaultPaymentMethodId =
					typeof fallback === "string" ? fallback : (fallback?.id ?? null);
			}
			const methods = await stripe.paymentMethods.list({
				customer: owner.stripeCustomerId,
				type: "card",
			});
			return {
				defaultPaymentMethodId,
				paymentMethods: methods.data.map((pm) => ({
					id: pm.id,
					brand: pm.card?.brand ?? null,
					last4: pm.card?.last4 ?? null,
					expMonth: pm.card?.exp_month ?? null,
					expYear: pm.card?.exp_year ?? null,
				})),
			};
		} catch {
			return { defaultPaymentMethodId: null, paymentMethods: [] };
		}
	}),

	/** Billing contact details held on the Stripe customer. */
	getBillingContact: withPermission("billing", "read").query(async ({ ctx }) => {
		const owner = await getBillingOwner(ctx);
		if (!owner.stripeCustomerId) {
			return { email: owner.email, name: null };
		}
		const stripe = getStripeClient();
		try {
			const customer = await stripe.customers.retrieve(owner.stripeCustomerId);
			if (customer.deleted) {
				return { email: owner.email, name: null };
			}
			return {
				email: customer.email ?? owner.email,
				name: customer.name ?? null,
			};
		} catch {
			return { email: owner.email, name: null };
		}
	}),

	startFreeTrial: withPermission("billing", "manage")
		.input(z.object({ tier: z.enum(["hobby", "startup"]) }))
		.mutation(async ({ ctx, input }) => {
			if (!IS_CLOUD) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "This feature is only available in Notploy Cloud",
				});
			}

			const trialPriceId =
				input.tier === "startup"
					? STARTUP_BASE_PRICE_MONTHLY_ID
					: HOBBY_PRICE_MONTHLY_ID;
			if (!trialPriceId) {
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Trials are not configured",
				});
			}

			const owner = await findUserById(ctx.user.ownerId);
			const billingStatus = await getBillingStatus(owner.id);

			if (billingStatus.hasActiveAccess) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "You already have an active plan or trial",
				});
			}

			if (billingStatus.hasUsedTrial) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "You have already used your free trial",
				});
			}

			const stripe = getStripeClient();

			let stripeCustomerId = owner.stripeCustomerId;
			if (stripeCustomerId) {
				const customer = await stripe.customers.retrieve(stripeCustomerId);
				if (customer.deleted) {
					stripeCustomerId = null;
				}
			}
			if (!stripeCustomerId) {
				const customer = await stripe.customers.create({ email: owner.email });
				stripeCustomerId = customer.id;
			}

			const subscription = await stripe.subscriptions.create({
				customer: stripeCustomerId,
				items: [{ price: trialPriceId, quantity: 1 }],
				trial_period_days: TRIAL_DURATION_DAYS,
				trial_settings: { end_behavior: { missing_payment_method: "cancel" } },
				metadata: {
					source: "onboarding_trial",
					adminId: owner.id,
					tier: input.tier,
				},
			});

			await updateUser(owner.id, {
				stripeCustomerId,
				stripeSubscriptionId: subscription.id,
				serversQuantity: TRIAL_SERVER_LIMITS[input.tier],
			});

			return {
				trialEndsAt: subscription.trial_end
					? new Date(subscription.trial_end * 1000)
					: null,
			};
		}),

	getProducts: withPermission("billing", "read").query(async ({ ctx }) => {
		const user = await findUserById(ctx.user.ownerId);
		const stripeCustomerId = user.stripeCustomerId;

		const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
			apiVersion: "2024-09-30.acacia",
		});

		const products = await stripe.products.list({
			expand: ["data.default_price"],
			active: true,
		});

		const productIds = [
			PRODUCT_MONTHLY_ID,
			PRODUCT_ANNUAL_ID,
			HOBBY_PRODUCT_ID,
			STARTUP_PRODUCT_ID,
		].filter(Boolean);
		const filteredProducts = products.data.filter((product) =>
			productIds.includes(product.id),
		);

		if (!stripeCustomerId) {
			return {
				products: filteredProducts,
				subscriptions: [],
				hobbyProductId: HOBBY_PRODUCT_ID || undefined,
				startupProductId: STARTUP_PRODUCT_ID || undefined,
				currentPlan: null as "legacy" | "hobby" | "startup" | null,
				isAnnualCurrent: false,
				currentPriceAmount: null,
			};
		}

		const subscriptions = await stripe.subscriptions.list({
			customer: stripeCustomerId,
			status: "active",
			expand: ["data.items.data.price"],
		});

		type CurrentPlan = "legacy" | "hobby" | "startup";
		let currentPlan: CurrentPlan = "legacy";
		let isAnnualCurrent = false;
		let currentPriceAmount: number | null = null;
		if (subscriptions.data.length > 0) {
			const matchedSub = subscriptions.data.find((sub) =>
				sub.items.data.some(
					(item) =>
						(item.price as Stripe.Price).id === STARTUP_BASE_PRICE_MONTHLY_ID ||
						(item.price as Stripe.Price).id === STARTUP_BASE_PRICE_ANNUAL_ID,
				),
			);
			const hobbySub = subscriptions.data.find((sub) =>
				sub.items.data.some(
					(item) =>
						(item.price as Stripe.Price).id === HOBBY_PRICE_MONTHLY_ID ||
						(item.price as Stripe.Price).id === HOBBY_PRICE_ANNUAL_ID,
				),
			);
			const legacySub = subscriptions.data.find((sub) =>
				sub.items.data.some((item) =>
					LEGACY_PRICE_IDS.includes((item.price as Stripe.Price).id),
				),
			);

			const activeSub = matchedSub ?? hobbySub ?? legacySub;
			if (matchedSub) {
				currentPlan = "startup";
			} else if (hobbySub) {
				currentPlan = "hobby";
			} else if (legacySub) {
				currentPlan = "legacy";
			}

			const firstPrice = activeSub?.items.data[0]?.price as
				| Stripe.Price
				| undefined;
			isAnnualCurrent = firstPrice?.recurring?.interval === "year";

			const totalCents = (activeSub?.items.data ?? []).reduce((sum, item) => {
				const price = item.price as Stripe.Price;
				const amount = price.unit_amount ?? 0;
				const qty = item.quantity ?? 1;
				return sum + amount * qty;
			}, 0);
			currentPriceAmount = totalCents / 100;
		}

		return {
			products: filteredProducts,
			subscriptions: subscriptions.data,
			hobbyProductId: HOBBY_PRODUCT_ID || undefined,
			startupProductId: STARTUP_PRODUCT_ID || undefined,
			currentPlan: currentPlan as "legacy" | "hobby" | "startup" | null,
			isAnnualCurrent,
			currentPriceAmount,
		};
	}),
	createCheckoutSession: withPermission("billing", "manage")
		.input(
			z
				.object({
					tier: z.enum(["legacy", "hobby", "startup"]),
					productId: z.string(),
					serverQuantity: z.number().min(1),
					isAnnual: z.boolean(),
				})
				.refine((data) => data.tier !== "startup" || data.serverQuantity >= 3, {
					message: "Startup plan requires at least 3 servers",
					path: ["serverQuantity"],
				}),
		)
		.mutation(async ({ ctx, input }) => {
			const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
				apiVersion: "2024-09-30.acacia",
			});

			const items = getStripeItems(
				input.tier as BillingTier,
				input.serverQuantity,
				input.isAnnual,
			);
			// Always operate on the organization owner's Stripe customer
			const owner = await findUserById(ctx.user.ownerId);

			let stripeCustomerId = owner.stripeCustomerId;

			if (stripeCustomerId) {
				const customer = await stripe.customers.retrieve(stripeCustomerId);

				if (customer.deleted) {
					await updateUser(owner.id, {
						stripeCustomerId: null,
					});
					stripeCustomerId = null;
				}
			}

			const session = await stripe.checkout.sessions.create({
				mode: "subscription",
				line_items: items,
				...(stripeCustomerId
					? {
							customer: stripeCustomerId,
							customer_update: { name: "auto", address: "auto" },
						}
					: { customer_email: owner.email }),
				metadata: {
					adminId: owner.id,
				},
				billing_address_collection: "required",
				tax_id_collection: { enabled: true },
				allow_promotion_codes: true,
				success_url: `${WEBSITE_URL}/dashboard/settings/servers?success=true`,
				cancel_url: `${WEBSITE_URL}/dashboard/settings/billing`,
			});

			return { sessionId: session.id };
		}),
	createCustomerPortalSession: withPermission("billing", "manage").mutation(
		async ({ ctx }) => {
		// Use the organization's owner account for billing portal
		const owner = await findUserById(ctx.user.ownerId);

		if (!owner.stripeCustomerId) {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message: "Stripe Customer ID not found",
			});
		}
		const stripeCustomerId = owner.stripeCustomerId;

		const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
			apiVersion: "2024-09-30.acacia",
		});

		try {
			const session = await stripe.billingPortal.sessions.create({
				customer: stripeCustomerId,
				return_url: `${WEBSITE_URL}/dashboard/settings/billing`,
			});

			return { url: session.url };
		} catch (_) {
			return {
				url: "",
			};
		}
	}),

	upgradeSubscription: withPermission("billing", "manage")
		.input(
			z
				.object({
					tier: z.enum(["hobby", "startup"]),
					serverQuantity: z.number().min(1),
					isAnnual: z.boolean(),
				})
				.refine((data) => data.tier !== "startup" || data.serverQuantity >= 3, {
					message: "Startup plan requires at least 3 servers",
					path: ["serverQuantity"],
				}),
		)
		.mutation(async ({ ctx, input }) => {
			const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
				apiVersion: "2024-09-30.acacia",
			});
			const owner = await findUserById(ctx.user.ownerId);

			if (!owner.stripeSubscriptionId) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "No active subscription found",
				});
			}

			const subscription = await stripe.subscriptions.retrieve(
				owner.stripeSubscriptionId,
				{ expand: ["items.data.price"] },
			);

			if (
				subscription.status !== "active" &&
				subscription.status !== "trialing"
			) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Subscription is not active",
				});
			}

			const isTrialing = subscription.status === "trialing";
			// Trials are capped at the plan's included servers; paid plans can scale.
			const serverQuantity = isTrialing
				? TRIAL_SERVER_LIMITS[input.tier]
				: input.serverQuantity;

			const newItems = getStripeItems(
				input.tier as BillingTier,
				serverQuantity,
				input.isAnnual,
			);
			const currentItems = subscription.items.data;

			const updateItems: Stripe.SubscriptionUpdateParams["items"] =
				currentItems.map((item, i) => {
					if (i < newItems.length) {
						return {
							id: item.id,
							price: newItems[i]!.price,
							quantity: newItems[i]!.quantity,
						};
					}
					return { id: item.id, deleted: true };
				});

			for (let i = currentItems.length; i < newItems.length; i++) {
				updateItems.push({
					price: newItems[i]!.price,
					quantity: newItems[i]!.quantity,
				});
			}

			await stripe.subscriptions.update(owner.stripeSubscriptionId, {
				items: updateItems,
				proration_behavior: isTrialing ? "none" : "create_prorations",
				...(isTrialing && subscription.trial_end
					? { trial_end: subscription.trial_end }
					: {}),
			});

			return { ok: true };
		}),

	canCreateMoreServers: withPermission("server", "create").query(
		async ({ ctx }) => {
			const user = await findUserById(ctx.user.ownerId);
			const servers = await findServersByUserId(user.id);

			if (!IS_CLOUD) {
				return true;
			}

			return servers.length < user.serversQuantity;
		},
	),

	updateInvoiceNotifications: withPermission("billing", "manage")
		.input(z.object({ enabled: z.boolean() }))
		.mutation(async ({ ctx, input }) => {
			if (!IS_CLOUD) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "This feature is only available in Notploy Cloud",
				});
			}
			const owner = await findUserById(ctx.user.ownerId);
			await updateUser(owner.id, {
				sendInvoiceNotifications: input.enabled,
			});
			return { ok: true };
		}),

	getInvoices: withPermission("billing", "read").query(async ({ ctx }) => {
		const user = await findUserById(ctx.user.ownerId);
		const stripeCustomerId = user.stripeCustomerId;

		if (!stripeCustomerId) {
			return [];
		}

		const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
			apiVersion: "2024-09-30.acacia",
		});

		try {
			const invoices = await stripe.invoices.list({
				customer: stripeCustomerId,
				limit: 100,
			});

			return invoices.data.map((invoice) => ({
				id: invoice.id,
				number: invoice.number,
				status: invoice.status,
				amountDue: invoice.amount_due,
				amountPaid: invoice.amount_paid,
				currency: invoice.currency,
				created: invoice.created,
				dueDate: invoice.due_date,
				hostedInvoiceUrl: invoice.hosted_invoice_url,
				invoicePdf: invoice.invoice_pdf,
			}));
		} catch (_) {
			return [];
		}
	}),
});
