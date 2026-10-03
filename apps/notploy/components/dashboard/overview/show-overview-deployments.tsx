import { useRouter } from "next/router";
import { ShowDeploymentsTable } from "@/components/dashboard/deployments/show-deployments-table";
import { ShowQueueTable } from "@/components/dashboard/deployments/show-queue-table";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const SUBTAB_VALUES = ["deployments", "queue"] as const;
type SubtabValue = (typeof SUBTAB_VALUES)[number];
const DEFAULT_SUBTAB: SubtabValue = "deployments";

function isValidSubtab(t: string): t is SubtabValue {
	return SUBTAB_VALUES.includes(t as SubtabValue);
}

export const ShowOverviewDeployments = () => {
	const router = useRouter();
	const subtab =
		typeof router.query.subtab === "string" &&
		isValidSubtab(router.query.subtab)
			? router.query.subtab
			: DEFAULT_SUBTAB;

	const setSubtab = (value: string) => {
		if (!isValidSubtab(value)) return;
		const { subtab: _current, ...query } = router.query;
		router.replace(
			{
				pathname: router.pathname,
				query: value === DEFAULT_SUBTAB ? query : { ...query, subtab: value },
			},
			undefined,
			{ shallow: true },
		);
	};

	return (
		<Card className="min-h-[85vh] w-full rounded-xl bg-sidebar p-2.5">
			<div className="flex h-full min-h-[calc(85vh-1.25rem)] flex-col gap-6 rounded-xl bg-background p-4 shadow-md sm:p-6">
				<header className="space-y-1">
					<h1 className="text-3xl font-semibold tracking-tight">Deployments</h1>
					<p className="text-sm text-muted-foreground">
						Track, inspect and manage workload deployments across your Notploy
						infrastructure.
					</p>
				</header>
				<Tabs
					value={subtab}
					onValueChange={setSubtab}
					className="w-full min-w-0"
				>
					<TabsList>
						<TabsTrigger value="deployments">Deployments</TabsTrigger>
						<TabsTrigger value="queue">Queue</TabsTrigger>
					</TabsList>
					<TabsContent value="deployments" className="mt-4 min-w-0">
						<ShowDeploymentsTable />
					</TabsContent>
					<TabsContent value="queue" className="mt-4">
						<ShowQueueTable />
					</TabsContent>
				</Tabs>
			</div>
		</Card>
	);
};
