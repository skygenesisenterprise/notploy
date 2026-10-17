import type { AppProduct } from "@/lib/product";
import { CloudHome } from "./cloud/cloud-home";
import { ConsoleHome } from "./console/console-home";
import { SelfHome } from "./self/self-home";

/**
 * Homepage entry point (`/dashboard/home`).
 *
 * The environment is resolved from the product the instance was launched as and
 * passed down by `getServerSideProps`, so the composition follows the instance
 * itself rather than a query string or a browser-side preference. Each business
 * composition owns its own data contract; this component only selects one.
 */
export const HomePage = ({ environment }: { environment: AppProduct }) => {
	if (environment === "console") return <ConsoleHome />;
	if (environment === "cloud") return <CloudHome />;
	return <SelfHome />;
};

export default HomePage;
