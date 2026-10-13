import { validateRequest } from "@notploy/server/lib/auth";
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

export async function getServerSideProps(ctx: GetServerSidePropsContext) {
	const { req } = ctx;
	const { user } = await validateRequest(req);

	if (!user) {
		return {
			redirect: {
				permanent: false,
				destination: "/",
			},
		};
	}

	return {
		props: {},
	};
}
