import { validateRequest } from "@notploy/server/lib/auth";
import { hasPermission } from "@notploy/server/services/permission";
import { createServerSideHelpers } from "@trpc/react-query/server";
import type { GetServerSidePropsContext } from "next";
import type { ReactElement } from "react";
import superjson from "superjson";
import { CommunityManager } from "@/components/dashboard/website/community/community-manager";
import { DashboardLayout } from "@/components/layouts/dashboard-layout";
import { appRouter } from "@/server/api/root";

/**
 * Community console page.
 *
 * Follows the open-source activity of the repositories SGE tracks on GitHub. The
 * page is guarded twice: server-side, so an account without `community.read`
 * never sees it, and again on every procedure, so the data cannot be fetched
 * directly either.
 */
const Page = () => <CommunityManager />;

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
		{ community: ["read"] },
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
		// Hydrate the header: the sources and the overview so the first paint has
		// the status badges and the default period already resolved.
		await Promise.all([
			helpers.community.sources.prefetch(),
			helpers.community.repositories.prefetch({}),
			helpers.community.overview.prefetch({
				preset: "30d",
				repositoryIds: undefined,
			}),
		]);
		return { props: { trpcState: helpers.dehydrate() } };
	} catch {
		// The page renders its own error state and retries from the client.
		return { props: {} };
	}
}
