import { validateRequest } from "@notploy/server/lib/auth";
import { hasPermission } from "@notploy/server/services/permission";
import { createServerSideHelpers } from "@trpc/react-query/server";
import type { GetServerSidePropsContext } from "next";
import type { ReactElement } from "react";
import superjson from "superjson";
import { TrafficManager } from "@/components/dashboard/website/traffic/traffic-manager";
import { DashboardLayout } from "@/components/layouts/dashboard-layout";
import { appRouter } from "@/server/api/root";

/**
 * Traffic Manager console page.
 *
 * The page consumes Notploy's own API (`traffic.*`) and is guarded twice: here,
 * server-side, so an account without `traffic.read` never sees the page, and
 * again on each procedure, so the data cannot be fetched directly either.
 */
const Page = () => <TrafficManager />;

export default Page;

Page.getLayout = (page: ReactElement) => {
	return <DashboardLayout>{page}</DashboardLayout>;
};

export async function getServerSideProps(ctx: GetServerSidePropsContext) {
	const { user, session } = await validateRequest(ctx.req);
	if (!user) {
		return {
			redirect: {
				permanent: false,
				destination: "/",
			},
		};
	}

	const canView = await hasPermission(
		{
			user: { id: user.id },
			session: { activeOrganizationId: session?.activeOrganizationId || "" },
		},
		{ traffic: ["read"] },
	);
	if (!canView) {
		return {
			redirect: {
				permanent: false,
				destination: "/dashboard/home",
			},
		};
	}

	const helpers = createServerSideHelpers({
		router: appRouter,
		ctx: {
			req: ctx.req as never,
			res: ctx.res as never,
			db: null as never,
			session: session as never,
			user: user as never,
		},
		transformer: superjson,
	});

	try {
		// Hydrate the header filters and the default period so the first paint
		// already has the property list and the summary.
		await Promise.all([
			helpers.traffic.properties.prefetch(),
			helpers.traffic.overview.prefetch({
				preset: "24h",
				compare: false,
			}),
		]);
		return { props: { trpcState: helpers.dehydrate() } };
	} catch {
		// The page renders its own error state and retries from the client.
		return { props: {} };
	}
}
