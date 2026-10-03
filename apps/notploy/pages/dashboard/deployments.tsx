import { validateRequest } from "@notploy/server/lib/auth";
import { createServerSideHelpers } from "@trpc/react-query/server";
import type { GetServerSidePropsContext } from "next";
import type { ReactElement } from "react";
import superjson from "superjson";
import { ShowOverviewDeployments } from "@/components/dashboard/overview/show-overview-deployments";
import { DashboardLayout } from "@/components/layouts/dashboard-layout";
import { appRouter } from "@/server/api/root";

const Deployments = () => <ShowOverviewDeployments />;

export default Deployments;

Deployments.getLayout = (page: ReactElement) => (
	<DashboardLayout metaName="Deployments">{page}</DashboardLayout>
);

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

	const helpers = createServerSideHelpers({
		router: appRouter,
		ctx: {
			req: ctx.req as any,
			res: ctx.res as any,
			db: null as any,
			session: session as any,
			user: user as any,
		},
		transformer: superjson,
	});

	try {
		const permissions = await helpers.user.getPermissions.fetch();
		if (!permissions?.deployment.read) {
			return {
				redirect: {
					permanent: false,
					destination: "/",
				},
			};
		}
		return { props: { trpcState: helpers.dehydrate() } };
	} catch {
		return { props: {} };
	}
}
