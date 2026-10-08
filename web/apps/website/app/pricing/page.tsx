import { Pricing } from "@/components/pricing";
import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Notploy Pricing",
	description:
		"Notploy Self is open source and free to self-host. Notploy Cloud is a managed service operated by Notploy Enterprise, with a commercial Enterprise edition.",
};

export default function PricingPage() {
	return (
		<div className="relative w-full">
			<Pricing />
		</div>
	);
}
