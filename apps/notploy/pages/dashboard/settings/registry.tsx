import { validateRequest } from "@notploy/server";
import { createServerSideHelpers } from "@trpc/react-query/server";
import type { GetServerSidePropsContext } from "next";
import type { ReactElement } from "react";
import superjson from "superjson";
import { ShowRegistry } from "@/components/dashboard/settings/registry/show-registry";
import { DashboardLayout } from "@/components/layouts/dashboard-layout";
import { appRouter } from "@/server/api/root";

const Page = () => {
	return <ShowRegistry />;
};

export default Page;

Page.getLayout = (page: ReactElement) => {
	return <DashboardLayout metaName="Container Registries">{page}</DashboardLayout>;
};

export async function getServerSideProps(ctx: GetServerSidePropsContext) {
	const { req, res } = ctx;
	const { user, session } = await validateRequest(req);
	if (!user || user.role === "member") {
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
			req: req as any,
			res: res as any,
			db: null as any,
			session: session as any,
			user: user as any,
		},
		transformer: superjson,
	});
	await helpers.user.get.prefetch();
	await helpers.settings.isCloud.prefetch();

	return {
		props: {
			trpcState: helpers.dehydrate(),
		},
	};
}
