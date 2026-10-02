import { validateRequest } from "@notploy/server/lib/auth";
import { createServerSideHelpers } from "@trpc/react-query/server";
import type { GetServerSidePropsContext } from "next";
import type { ReactElement } from "react";
import superjson from "superjson";
import { ShowContainers } from "@/components/dashboard/docker/show/show-containers";
import { DashboardLayout } from "@/components/layouts/dashboard-layout";
import { appRouter } from "@/server/api/root";

const ContainersPage = () => <ShowContainers />;

export default ContainersPage;

ContainersPage.getLayout = (page: ReactElement) => (
	<DashboardLayout metaName="Containers">{page}</DashboardLayout>
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

	const { req, res } = ctx;
	const helpers = createServerSideHelpers({
		router: appRouter,
		ctx: {
			req: req as any,
			res: res as any,
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
					permanent: true,
					destination: "/",
				},
			};
		}
		return { props: { trpcState: helpers.dehydrate() } };
	} catch {
		return { props: {} };
	}
}
