import { validateRequest } from "@notploy/server";
import { createServerSideHelpers } from "@trpc/react-query/server";
import type { GetServerSidePropsContext } from "next";
import type { ReactElement } from "react";
import superjson from "superjson";
import { ShowObjectStorageBuckets } from "@/components/dashboard/settings/object-storage/show-object-storage-buckets";
import { DashboardLayout } from "@/components/layouts/dashboard-layout";
import { appRouter } from "@/server/api/root";

interface Props {
	objectStorageProviderId: string;
}

const Page = ({ objectStorageProviderId }: Props) => {
	return (
		<ShowObjectStorageBuckets
			objectStorageProviderId={objectStorageProviderId}
		/>
	);
};

export default Page;

Page.getLayout = (page: ReactElement) => {
	return <DashboardLayout metaName="Object Storage">{page}</DashboardLayout>;
};

export async function getServerSideProps(
	ctx: GetServerSidePropsContext<{ objectStorageProviderId: string }>,
) {
	const { req, res, params } = ctx;
	const { user, session } = await validateRequest(req);
	if (!user || user.role === "member" || !params?.objectStorageProviderId) {
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

	return {
		props: {
			trpcState: helpers.dehydrate(),
			objectStorageProviderId: params.objectStorageProviderId,
		},
	};
}
