import { Layers } from "lucide-react";
import type { ReactElement } from "react";
import { ConsoleComingSoon } from "@/components/dashboard/console/console-coming-soon";
import { DashboardLayout } from "@/components/layouts/dashboard-layout";
import { consolePageProps } from "@/lib/console-page";

export default function PlatformServicesPage() {
	return (
		<ConsoleComingSoon
			icon={Layers}
			title="Platform Services"
			description="Operate the shared platform services."
		/>
	);
}

PlatformServicesPage.getLayout = (page: ReactElement) => {
	return <DashboardLayout>{page}</DashboardLayout>;
};

export const getServerSideProps = consolePageProps;
