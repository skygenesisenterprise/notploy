import clsx from "clsx";
import type { Metadata } from "next";
import { Inter, Lexend } from "next/font/google";
import type { ReactNode } from "react";
import "@/styles/tailwind.css";
import "react-photo-view/dist/react-photo-view.css";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";

type Props = {
	children: ReactNode;
};

export const metadata: Metadata = {
	metadataBase: new URL("https://notploy.com"),
	title: {
		default:
			"Notploy - The open-source infrastructure platform for deploying and operating applications",
		template: "%s | Notploy",
	},
	description:
		"Notploy is an open-source infrastructure platform. Deploy applications, databases and Compose projects, manage servers and clusters, and handle routing, certificates and backups — self-hosted with Notploy Self or managed with Notploy Cloud.",
	icons: {
		icon: "/icon.svg",
		apple: "/apple-touch-icon.png",
	},
	openGraph: {
		title: "Notploy - The open-source infrastructure platform",
		description:
			"Deploy applications, databases and Compose projects, manage servers and clusters, and handle routing, certificates and backups — self-hosted with Notploy Self or managed with Notploy Cloud.",
		images: "/og.png",
		type: "website",
	},
	twitter: {
		card: "summary_large_image",
		title: "Notploy - The open-source infrastructure platform",
		description:
			"Deploy applications, databases and Compose projects, manage servers and clusters, and handle routing, certificates and backups — self-hosted with Notploy Self or managed with Notploy Cloud.",
		images: ["/og.png"],
	},
};
const inter = Inter({
	subsets: ["latin"],
	display: "swap",
	variable: "--font-inter",
});

const lexend = Lexend({
	subsets: ["latin"],
	display: "swap",
	variable: "--font-lexend",
});
// Since we have a `not-found.tsx` page on the root, a layout file
// is required, even if it's just passing children through.
export default function RootLayout({ children }: { children: ReactNode }) {
	return (
		<html
			lang="en"
			className={clsx(
				"h-full scroll-smooth antialiased",
				inter.variable,
				lexend.variable,
			)}
		>
			<body>
				<div className="flex h-full flex-col">
					<Header />
					{children}
					<Footer />
				</div>
			</body>
		</html>
	);
}
