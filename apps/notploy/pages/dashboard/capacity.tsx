import { Gauge } from "lucide-react";
import type { ReactElement } from "react";
import { ConsoleComingSoon } from "@/components/dashboard/console/console-coming-soon";
import { DashboardLayout } from "@/components/layouts/dashboard-layout";
import { consolePageProps } from "@/lib/console-page";

export default function CapacityPage() {
	return (
		<ConsoleComingSoon
			icon={Gauge}
			title="Capacity"
			description="Plan capacity and scaling headroom for the fleet."
		/>
	);
}

CapacityPage.getLayout = (page: ReactElement) => {
	return <DashboardLayout>{page}</DashboardLayout>;
};

export const getServerSideProps = consolePageProps;
