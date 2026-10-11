import { Activity } from "lucide-react";
import type { ReactElement } from "react";
import { ConsoleComingSoon } from "@/components/dashboard/console/console-coming-soon";
import { DashboardLayout } from "@/components/layouts/dashboard-layout";
import { consolePageProps } from "@/lib/console-page";

export default function OperationsPage() {
	return (
		<ConsoleComingSoon
			icon={Activity}
			title="Operations"
			description="Run and audit operational tasks across the platform."
		/>
	);
}

OperationsPage.getLayout = (page: ReactElement) => {
	return <DashboardLayout>{page}</DashboardLayout>;
};

export const getServerSideProps = consolePageProps;
