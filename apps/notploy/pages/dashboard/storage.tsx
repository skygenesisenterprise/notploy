import { Database } from "lucide-react";
import type { ReactElement } from "react";
import { ConsoleComingSoon } from "@/components/dashboard/console/console-coming-soon";
import { DashboardLayout } from "@/components/layouts/dashboard-layout";
import { consolePageProps } from "@/lib/console-page";

export default function StoragePage() {
	return (
		<ConsoleComingSoon
			icon={Database}
			title="Storage"
			description="Manage platform storage volumes and backends."
		/>
	);
}

StoragePage.getLayout = (page: ReactElement) => {
	return <DashboardLayout>{page}</DashboardLayout>;
};

export const getServerSideProps = consolePageProps;
