import { IS_CLOUD } from "@notploy/server/constants";
import { validateRequest } from "@notploy/server/lib/auth";
import { hasPermission } from "@notploy/server/services/permission";
import type { GetServerSidePropsContext } from "next";
import type { ReactElement } from "react";
import { MonitoringOverview } from "@/components/dashboard/monitoring/monitoring-overview";
import { DashboardLayout } from "@/components/layouts/dashboard-layout";

const Dashboard = () => {
	return (
		<div className="space-y-4 pb-10">
			<MonitoringOverview />
		</div>
	);
};

export default Dashboard;

Dashboard.getLayout = (page: ReactElement) => {
	return <DashboardLayout>{page}</DashboardLayout>;
};

export async function getServerSideProps(
	ctx: GetServerSidePropsContext<{ serviceId: string }>,
) {
	if (IS_CLOUD) {
		return {
			redirect: {
				permanent: false,
				destination: "/dashboard/home",
			},
		};
	}
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
		{ monitoring: ["read"] },
	);

	if (!canView) {
		return {
			redirect: {
				permanent: false,
				destination: "/dashboard/home",
			},
		};
	}

	return {
		props: {},
	};
}
