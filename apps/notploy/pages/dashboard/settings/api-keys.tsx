import { validateRequest } from "@notploy/server";
import type { GetServerSidePropsContext } from "next";
import type { ReactElement } from "react";
import { DashboardLayout } from "@/components/layouts/dashboard-layout";

const Page = () => null;

export default Page;

Page.getLayout = (page: ReactElement) => {
	return <DashboardLayout metaName="API Keys">{page}</DashboardLayout>;
};

export async function getServerSideProps(
	ctx: GetServerSidePropsContext<{ serviceId: string }>,
) {
	const { user } = await validateRequest(ctx.req);

	if (!user) {
		return {
			redirect: {
				permanent: false,
				destination: "/",
			},
		};
	}

	return {
		redirect: {
			permanent: false,
			destination: "/dashboard/settings/profile#developer-access",
		},
	};
}
