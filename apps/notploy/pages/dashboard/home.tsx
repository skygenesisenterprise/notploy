import { getConfiguredProduct } from "@notploy/server";
import { validateRequest } from "@notploy/server/lib/auth";
import { createServerSideHelpers } from "@trpc/react-query/server";
import type { GetServerSidePropsContext } from "next";
import type { ReactElement } from "react";
import { useEffect, useState } from "react";
import superjson from "superjson";
import { HomePage } from "@/components/dashboard/home/home-page";
import {
	clearOnboardingActive,
	isOnboardingActive,
	markOnboardingActive,
} from "@/components/dashboard/onboarding/onboarding-lock";
import { OnboardingWizard } from "@/components/dashboard/onboarding/onboarding-wizard";
import { DashboardLayout } from "@/components/layouts/dashboard-layout";
import type { AppProduct } from "@/lib/product";
import { appRouter } from "@/server/api/root";
import { api } from "@/utils/api";

interface HomeProps {
	/** Environment the instance was launched as, resolved server-side. */
	environment: AppProduct;
}

const Home = ({ environment }: HomeProps) => {
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

	// Which homepage is composed follows the product the instance was launched
	// as (`self`, `cloud`, `console`) — never a URL parameter.
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

	// The home dashboard deliberately sources every panel from Notploy's own
	// authenticated API, rather than showing example observability data while the
	// client loads. Only the sources the caller may read are hydrated: a gated
	// source is composed as `restricted` instead of being fetched and failing.
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

	// The console's platform sources (`status.overview`, the control plane
	// runtime and the infrastructure probes) are read from external systems:
	// they stay client-side so a slow status instance cannot delay every console
	// page load. Their states are rendered explicitly while they resolve.

	return {
		props: {
			trpcState: helpers.dehydrate(),
			environment,
		},
	};
}
