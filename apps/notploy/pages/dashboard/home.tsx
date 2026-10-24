import { getConfiguredProduct } from "@notploy/server";
import { validateRequest } from "@notploy/server/lib/auth";
import { createServerSideHelpers } from "@trpc/react-query/server";
import type { GetServerSidePropsContext } from "next";
import type { ReactElement } from "react";
import superjson from "superjson";
import { HomePage } from "@/components/dashboard/home/home-page";
import { DashboardLayout } from "@/components/layouts/dashboard-layout";
import type { AppProduct } from "@/lib/product";
import { appRouter } from "@/server/api/root";

interface HomeProps {
	/** Environment the instance was launched as, resolved server-side. */
	environment: AppProduct;
}

const Home = ({ environment }: HomeProps) => {
	return <HomePage environment={environment} />;
};

export default Home;

Home.getLayout = (page: ReactElement) => {
	return <DashboardLayout>{page}</DashboardLayout>;
};

export async function getServerSideProps(ctx: GetServerSidePropsContext) {
	const { req, res } = ctx;
	const { user, session } = await validateRequest(req);

	if (!user) {
		return {
			redirect: {
				permanent: false,
				destination: "/",
			},
		};
	}

	const environment = getConfiguredProduct();

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

	await helpers.settings.isCloud.prefetch();
	await helpers.user.get.prefetch();
	await helpers.project.onboardingStatus.prefetch();

	const permissions = await helpers.user.getPermissions.fetch();

	await Promise.all([
		helpers.project.homeStats.prefetch(),
		helpers.operationalEvent.list.prefetch(),
		permissions.service.read
			? helpers.overview.services.prefetch()
			: Promise.resolve(),
		permissions.deployment.read
			? helpers.deployment.homeActivity.prefetch()
			: Promise.resolve(),
		permissions.server.read ? helpers.server.all.prefetch() : Promise.resolve(),
	]);

	return {
		props: {
			trpcState: helpers.dehydrate(),
			environment,
		},
	};
}
