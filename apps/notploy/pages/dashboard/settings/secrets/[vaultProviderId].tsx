import { validateRequest } from "@notploy/server";
import { createServerSideHelpers } from "@trpc/react-query/server";
import type { GetServerSidePropsContext } from "next";
import type { ReactElement } from "react";
import superjson from "superjson";
import { ShowVaultSecrets } from "@/components/dashboard/settings/vault/show-vault-secrets";
import { DashboardLayout } from "@/components/layouts/dashboard-layout";
import { appRouter } from "@/server/api/root";

interface Props {
	vaultProviderId: string;
}

const Page = ({ vaultProviderId }: Props) => {
	return <ShowVaultSecrets vaultProviderId={vaultProviderId} />;
};

export default Page;

Page.getLayout = (page: ReactElement) => {
	return <DashboardLayout metaName="Secrets">{page}</DashboardLayout>;
};

export async function getServerSideProps(
	ctx: GetServerSidePropsContext<{ vaultProviderId: string }>,
) {
	const { req, res, params } = ctx;
	const { user, session } = await validateRequest(req);
	if (!user || user.role === "member" || !params?.vaultProviderId) {
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
			vaultProviderId: params.vaultProviderId,
		},
	};
}
