import { Wrench } from "lucide-react";
import type { ReactElement } from "react";
import { ConsoleComingSoon } from "@/components/dashboard/console/console-coming-soon";
import { DashboardLayout } from "@/components/layouts/dashboard-layout";
import { consolePageProps } from "@/lib/console-page";

export default function MaintenancePage() {
	return (
		<ConsoleComingSoon
			icon={Wrench}
			title="Maintenance"
			description="Schedule and track maintenance windows across the fleet."
		/>
	);
}

MaintenancePage.getLayout = (page: ReactElement) => {
	return <DashboardLayout>{page}</DashboardLayout>;
};

export const getServerSideProps = consolePageProps;
