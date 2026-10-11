import { Link2 } from "lucide-react";
import type { ReactElement } from "react";
import { ConsoleComingSoon } from "@/components/dashboard/console/console-coming-soon";
import { DashboardLayout } from "@/components/layouts/dashboard-layout";
import { consolePageProps } from "@/lib/console-page";

export default function DomainsPage() {
	return (
		<ConsoleComingSoon
			icon={Link2}
			title="Domains"
			description="Manage domains and DNS routing for the platform."
		/>
	);
}

DomainsPage.getLayout = (page: ReactElement) => {
	return <DashboardLayout>{page}</DashboardLayout>;
};

export const getServerSideProps = consolePageProps;
