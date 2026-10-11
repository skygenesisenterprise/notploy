import { validateRequest } from "@notploy/server/lib/auth";
import type { GetServerSidePropsContext, GetServerSidePropsResult } from "next";

type ConsolePageProps = Record<string, never>;

/**
 * Shared server-side guard for the reserved console pages. Only requires an
 * authenticated session: the navigation tree decides which destinations the
 * current user may see through its access-control pass.
 */
export async function consolePageProps(
	ctx: GetServerSidePropsContext,
): Promise<GetServerSidePropsResult<ConsolePageProps>> {
	const { user } = await validateRequest(ctx.req);
	if (!user) {
		return {
			redirect: {
				permanent: false,
				destination: "/",
			},
		};
	}
	return { props: {} };
}
