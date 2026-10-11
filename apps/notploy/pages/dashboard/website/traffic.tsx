import { TrendingUp } from "lucide-react";
import type { ReactElement } from "react";
import { ConsoleComingSoon } from "@/components/dashboard/console/console-coming-soon";
import { DashboardLayout } from "@/components/layouts/dashboard-layout";
import { consolePageProps } from "@/lib/console-page";

export default function TrafficPage() {
	return (
		<ConsoleComingSoon
			icon={TrendingUp}
			title="Traffic"
			description="Monitor traffic and analytics for the Notploy website."
		/>
	);
}

TrafficPage.getLayout = (page: ReactElement) => {
	return <DashboardLayout>{page}</DashboardLayout>;
};

export const getServerSideProps = consolePageProps;
