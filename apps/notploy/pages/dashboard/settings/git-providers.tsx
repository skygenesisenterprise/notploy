import { validateRequest } from "@notploy/server";
import { createServerSideHelpers } from "@trpc/react-query/server";
import type { GetServerSidePropsContext } from "next";
import type { ReactElement } from "react";
import superjson from "superjson";
import { ShowGitProviders } from "@/components/dashboard/settings/git/show-git-providers";
import { DashboardLayout } from "@/components/layouts/dashboard-layout";
import { appRouter } from "@/server/api/root";

const Page = () => {
	return <ShowGitProviders />;
};

export default Page;

Page.getLayout = (page: ReactElement) => {
	return <DashboardLayout metaName="Git Providers">{page}</DashboardLayout>;
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
	const userPermissions = await helpers.user.getPermissions.fetch();

	if (!userPermissions?.gitProviders.read) {
		return {
			redirect: {
				permanent: false,
				destination: "/",
			},
		};
	}

	return {
		props: {
			trpcState: helpers.dehydrate(),
		},
	};
}
