import { validateRequest } from "@notploy/server/lib/auth";
import { createServerSideHelpers } from "@trpc/react-query/server";
import type { GetServerSidePropsContext } from "next";
import type { ReactElement } from "react";
import superjson from "superjson";
import { SwarmConsole } from "@/components/dashboard/swarm/swarm-console";
import { DashboardLayout } from "@/components/layouts/dashboard-layout";
import { ServerFilter } from "@/components/shared/server-filter";
import { appRouter } from "@/server/api/root";

const SwarmPage = () => (
	<ServerFilter>
		{(serverId) => <SwarmConsole serverId={serverId} />}
	</ServerFilter>
);

export default SwarmPage;

SwarmPage.getLayout = (page: ReactElement) => (
	<DashboardLayout metaName="Swarm">{page}</DashboardLayout>
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
		if (!permissions?.docker.read) {
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
