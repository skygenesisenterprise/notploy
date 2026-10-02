import { validateRequest } from "@notploy/server";
import { createServerSideHelpers } from "@trpc/react-query/server";
import { ShieldCheck, Users } from "lucide-react";
import type { GetServerSidePropsContext } from "next";
import { useRouter } from "next/router";
import type { ReactElement } from "react";
import { useEffect } from "react";
import superjson from "superjson";
import { ShowUsers } from "@/components/dashboard/settings/users/show-users";
import { DashboardLayout } from "@/components/layouts/dashboard-layout";
import { ManageCustomRoles } from "@/components/proprietary/roles/manage-custom-roles";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { appRouter } from "@/server/api/root";
import { api } from "@/utils/api";

function SummaryStat({
	label,
	value,
	icon: Icon,
}: {
	label: string;
	value: number | string;
	icon: typeof Users;
}) {
	return (
		<Card>
			<CardContent className="flex items-center gap-3 p-4">
				<div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
					<Icon className="size-4" aria-hidden />
				</div>
				<div>
					<p className="text-2xl font-semibold tabular-nums">{value}</p>
					<p className="text-xs text-muted-foreground">{label}</p>
				</div>
			</CardContent>
		</Card>
	);
}

const Page = () => {
	const router = useRouter();
	const { data: auth } = api.user.get.useQuery();
	const { data: permissions } = api.user.getPermissions.useQuery();
	const { data: members, isPending: membersPending } = api.user.all.useQuery();
	const isOwnerOrAdmin = auth?.role === "owner" || auth?.role === "admin";
	const { data: customRoles } = api.customRole.all.useQuery(undefined, {
		enabled: isOwnerOrAdmin,
	});

	const requestedTab =
		typeof router.query.tab === "string" ? router.query.tab : "members";
	const availableTabs = ["members", ...(isOwnerOrAdmin ? ["roles"] : [])];
	const selectedTab = availableTabs.includes(requestedTab)
		? requestedTab
		: "members";

	useEffect(() => {
		if (!router.isReady || selectedTab === requestedTab) return;
		const { tab: _tab, ...query } = router.query;
		void router.replace({ pathname: router.pathname, query }, undefined, {
			shallow: true,
			scroll: false,
		});
	}, [requestedTab, router, selectedTab]);

	const selectTab = (tab: string) => {
		const query = { ...router.query };
		if (tab === "members") {
			delete query.tab;
		} else {
			query.tab = tab;
		}
		void router.push({ pathname: router.pathname, query }, undefined, {
			shallow: true,
			scroll: false,
		});
	};

	const activeMembers =
		members?.filter((member) => !member.user.banned).length ?? 0;
	const twoFactorMembers =
		members?.filter((member) => member.user.twoFactorEnabled).length ?? 0;
	const roleCount = isOwnerOrAdmin ? 3 + (customRoles?.length ?? 0) : null;

	return (
		<Card className="min-h-[85vh] w-full rounded-xl bg-sidebar p-2.5">
			<div className="flex h-full min-h-[calc(85vh-1.25rem)] flex-col gap-6 rounded-xl bg-background p-4 shadow-md sm:p-6">
				<header className="space-y-1">
					<h1 className="text-3xl font-semibold tracking-tight">Team</h1>
					<p className="text-sm text-muted-foreground">
						Manage the members, access and roles of your organization.
					</p>
				</header>

				<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
					<SummaryStat
						label="Members"
						value={membersPending ? "—" : (members?.length ?? 0)}
						icon={Users}
					/>
					<SummaryStat
						label="Active members"
						value={membersPending ? "—" : activeMembers}
						icon={Users}
					/>
					{roleCount !== null && (
						<SummaryStat
							label="Organization roles"
							value={customRoles ? roleCount : "—"}
							icon={ShieldCheck}
						/>
					)}
					{!membersPending && members && members.length > 0 && (
						<div className="sm:col-span-2 xl:col-span-4">
							<p className="text-xs text-muted-foreground">
								{twoFactorMembers} of {members.length} members have two-factor
								authentication enabled.
							</p>
						</div>
					)}
				</div>

				<Tabs value={selectedTab} onValueChange={selectTab} className="gap-4">
					<TabsList variant="line" className="w-full justify-start border-b">
						<TabsTrigger value="members">
							<Users aria-hidden />
							Members
						</TabsTrigger>
						{isOwnerOrAdmin && (
							<TabsTrigger value="roles">
								<ShieldCheck aria-hidden />
								Rôles
							</TabsTrigger>
						)}
					</TabsList>
					<TabsContent value="members" className="mt-0">
						<ShowUsers />
					</TabsContent>
					{isOwnerOrAdmin && (
						<TabsContent value="roles" className="mt-0">
							<ManageCustomRoles />
						</TabsContent>
					)}
				</Tabs>
			</div>
		</Card>
	);
};

export default Page;

Page.getLayout = (page: ReactElement) => {
	return <DashboardLayout metaName="Team">{page}</DashboardLayout>;
};
export async function getServerSideProps(
	ctx: GetServerSidePropsContext<{ serviceId: string }>,
) {
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

	try {
		await helpers.user.get.prefetch();
		await helpers.settings.isCloud.prefetch();

		const userPermissions = await helpers.user.getPermissions.fetch();

		if (!userPermissions?.member.read) {
			return {
				redirect: {
					permanent: false,
					destination: "/",
				},
			};
		}

		return {
			props: {
				trpcState: helpers.dehydrate(),
			},
		};
	} catch {
		return {
			props: {},
		};
	}
}
