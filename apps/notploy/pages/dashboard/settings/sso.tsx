import { validateRequest } from "@notploy/server";
import { createServerSideHelpers } from "@trpc/react-query/server";
import type { GetServerSidePropsContext } from "next";
import type { ReactElement } from "react";
import superjson from "superjson";
import { DashboardLayout } from "@/components/layouts/dashboard-layout";
import { SSOSettings } from "@/components/proprietary/sso/sso-settings";
import { Card } from "@/components/ui/card";
import { appRouter } from "@/server/api/root";

const Page = () => {
	return (
		<div className="pb-10">
			<Card className="min-h-[85vh] w-full rounded-xl bg-sidebar p-2.5">
				<div className="flex h-full min-h-[calc(85vh-1.25rem)] flex-col gap-6 rounded-xl bg-background p-4 shadow-md sm:p-6">
					<SSOSettings />
				</div>
			</Card>
		</div>
	);
};

export default Page;

Page.getLayout = (page: ReactElement) => {
	return <DashboardLayout metaName="SSO">{page}</DashboardLayout>;
};

export async function getServerSideProps(ctx: GetServerSidePropsContext) {
	const { req, res } = ctx;
	const { user, session } = await validateRequest(ctx.req);
	if (!user) {
		return {
			redirect: {
				permanent: false,
				destination: "/",
			},
		};
	}
	if (user.role === "member") {
		return {
			redirect: {
				permanent: false,
				destination: "/dashboard/settings/profile",
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
	await helpers.sso.listProviders.prefetch();

	return {
		props: {
			trpcState: helpers.dehydrate(),
		},
	};
}
