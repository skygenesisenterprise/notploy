import { validateRequest } from "@notploy/server";
import type { GetServerSidePropsContext } from "next";
import type { ReactElement } from "react";
import { ShowIncidents } from "@/components/dashboard/incidents/show-incidents";
import { DashboardLayout } from "@/components/layouts/dashboard-layout";
import { loadStatusOverview, type StatusOverview } from "@/lib/status";

interface IncidentsPageProps {
	overview: StatusOverview;
}

const Page = ({ overview }: IncidentsPageProps) => {
	return <ShowIncidents overview={overview} />;
};

export default Page;

Page.getLayout = (page: ReactElement) => {
	return <DashboardLayout>{page}</DashboardLayout>;
};

/**
 * The console mirrors the whole status platform, so only platform operators
 * may see and drive it — same guard as the Blog page of the Website section.
 * The data itself comes from the status instance over HTTP (see
 * `@/lib/status`), which also picks up incidents introduced directly from
 * the status page or by the monitoring agent.
 */
export async function getServerSideProps(ctx: GetServerSidePropsContext) {
	const { user } = await validateRequest(ctx.req);
	if (!user || (user.role !== "owner" && user.role !== "admin")) {
		return {
			redirect: {
				permanent: false,
				destination: "/",
			},
		};
	}

	const overview = await loadStatusOverview();

	return {
		props: {
			overview,
		},
	};
}
