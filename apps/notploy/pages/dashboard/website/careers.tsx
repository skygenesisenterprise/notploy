import { validateRequest } from "@notploy/server";
import type { GetServerSidePropsContext } from "next";
import type { ReactElement } from "react";
import { ShowCareers } from "@/components/dashboard/website/careers/show-careers";
import { DashboardLayout } from "@/components/layouts/dashboard-layout";
import type { Job } from "@/lib/ghost";
import { getJobs } from "@/lib/ghost";

interface CareersPageProps {
	jobs: Job[];
}

const Page = ({ jobs }: CareersPageProps) => {
	return <ShowCareers jobs={jobs} />;
};

export default Page;

Page.getLayout = (page: ReactElement) => {
	return <DashboardLayout>{page}</DashboardLayout>;
};

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

	const jobs = await getJobs();

	return {
		props: {
			jobs,
		},
	};
}
