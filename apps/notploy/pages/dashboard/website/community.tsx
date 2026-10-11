import { HeartHandshake } from "lucide-react";
import type { ReactElement } from "react";
import { ConsoleComingSoon } from "@/components/dashboard/console/console-coming-soon";
import { DashboardLayout } from "@/components/layouts/dashboard-layout";
import { consolePageProps } from "@/lib/console-page";

export default function CommunityPage() {
	return (
		<ConsoleComingSoon
			icon={HeartHandshake}
			title="Community"
			description="Manage community channels and engagement."
		/>
	);
}

CommunityPage.getLayout = (page: ReactElement) => {
	return <DashboardLayout>{page}</DashboardLayout>;
};

export const getServerSideProps = consolePageProps;
