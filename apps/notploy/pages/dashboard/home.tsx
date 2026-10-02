import { validateRequest } from "@notploy/server/lib/auth";
import { createServerSideHelpers } from "@trpc/react-query/server";
import type { GetServerSidePropsContext } from "next";
import type { ReactElement } from "react";
import { useEffect, useState } from "react";
import superjson from "superjson";
import { OperationsCenter } from "@/components/dashboard/home/operations-center";
import {
	clearOnboardingActive,
	isOnboardingActive,
	markOnboardingActive,
} from "@/components/dashboard/onboarding/onboarding-lock";
import { OnboardingWizard } from "@/components/dashboard/onboarding/onboarding-wizard";
import { DashboardLayout } from "@/components/layouts/dashboard-layout";
import { appRouter } from "@/server/api/root";
import { api } from "@/utils/api";

const Home = () => {
	const { data } = api.project.onboardingStatus.useQuery();
	const utils = api.useUtils();
	const { mutateAsync: completeOnboarding } =
		api.project.completeOnboarding.useMutation();
	const [showWizard, setShowWizard] = useState<boolean | null>(null);

	useEffect(() => {
		if (showWizard === null && data) {
			const show = isOnboardingActive() || data.shouldShowOnboarding;
			setShowWizard(show);
			if (show) markOnboardingActive();
		}
	}, [data, showWizard]);

	if (showWizard) {
		return (
			<OnboardingWizard
				onClose={async () => {
					await completeOnboarding();
					await utils.project.onboardingStatus.invalidate();
					clearOnboardingActive();
					setShowWizard(false);
				}}
			/>
		);
	}

	return <OperationsCenter />;
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

	// Hydrate the operational panels on the first render. The home dashboard
	// deliberately sources every panel from Notploy's own authenticated API,
	// rather than showing example observability data while the client loads.
	await Promise.all([
		helpers.user.getPermissions.prefetch(),
		helpers.project.homeStats.prefetch(),
		helpers.overview.services.prefetch(),
		helpers.deployment.homeActivity.prefetch(),
		helpers.server.all.prefetch(),
	]);

	return {
		props: {
			trpcState: helpers.dehydrate(),
		},
	};
}
