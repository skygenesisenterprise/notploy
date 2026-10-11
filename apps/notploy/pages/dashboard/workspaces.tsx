import { Building2 } from "lucide-react";
import type { ReactElement } from "react";
import { ConsoleComingSoon } from "@/components/dashboard/console/console-coming-soon";
import { DashboardLayout } from "@/components/layouts/dashboard-layout";
import { consolePageProps } from "@/lib/console-page";

export default function WorkspacesPage() {
	return (
		<ConsoleComingSoon
			icon={Building2}
			title="Workspaces"
			description="Manage the workspaces hosted on Notploy Cloud."
		/>
	);
}

WorkspacesPage.getLayout = (page: ReactElement) => {
	return <DashboardLayout>{page}</DashboardLayout>;
};

export const getServerSideProps = consolePageProps;
