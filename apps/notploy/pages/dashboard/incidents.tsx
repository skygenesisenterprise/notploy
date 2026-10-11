import { TriangleAlert } from "lucide-react";
import type { ReactElement } from "react";
import { ConsoleComingSoon } from "@/components/dashboard/console/console-coming-soon";
import { DashboardLayout } from "@/components/layouts/dashboard-layout";
import { consolePageProps } from "@/lib/console-page";

export default function IncidentsPage() {
	return (
		<ConsoleComingSoon
			icon={TriangleAlert}
			title="Incidents"
			description="Track and manage platform incidents and their resolution timeline."
		/>
	);
}

IncidentsPage.getLayout = (page: ReactElement) => {
	return <DashboardLayout>{page}</DashboardLayout>;
};

export const getServerSideProps = consolePageProps;
