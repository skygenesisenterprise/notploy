import { ChartPie } from "lucide-react";
import type { ReactElement } from "react";
import { ConsoleComingSoon } from "@/components/dashboard/console/console-coming-soon";
import { DashboardLayout } from "@/components/layouts/dashboard-layout";
import { consolePageProps } from "@/lib/console-page";

export default function UsagePage() {
	return (
		<ConsoleComingSoon
			icon={ChartPie}
			title="Usage"
			description="Review resource usage and consumption across workspaces."
		/>
	);
}

UsagePage.getLayout = (page: ReactElement) => {
	return <DashboardLayout>{page}</DashboardLayout>;
};

export const getServerSideProps = consolePageProps;
