import { AppWindow } from "lucide-react";
import type { ReactElement } from "react";
import { ConsoleComingSoon } from "@/components/dashboard/console/console-coming-soon";
import { DashboardLayout } from "@/components/layouts/dashboard-layout";
import { consolePageProps } from "@/lib/console-page";

export default function ApplicationsPage() {
	return (
		<ConsoleComingSoon
			icon={AppWindow}
			title="Applications"
			description="Manage the applications deployed across workspaces."
		/>
	);
}

ApplicationsPage.getLayout = (page: ReactElement) => {
	return <DashboardLayout>{page}</DashboardLayout>;
};

export const getServerSideProps = consolePageProps;
