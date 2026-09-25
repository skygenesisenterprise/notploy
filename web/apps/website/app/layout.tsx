import { GoogleAnalytics, GoogleTagManager } from "@next/third-parties/google";
import { OpenPanelComponent } from "@openpanel/nextjs";
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
		default: "Notploy - Deploy your applications with ease",
		template: "%s | Notploy",
	},
	description: "Deploy your applications with ease using Notploy",
	icons: {
		icon: "/icon.svg",
		apple: "/apple-touch-icon.png",
	},
	openGraph: {
		title: "Notploy - Deploy your applications with ease",
		description: "Deploy your applications with ease using Notploy",
		images: "/og.png",
		type: "website",
	},
	twitter: {
		card: "summary_large_image",
		title: "Notploy - Deploy your applications with ease",
		description: "Deploy your applications with ease using Notploy",
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
			<GoogleTagManager gtmId="GTM-PWBFB2V2" />
			<head>
				<script
					type="text/javascript"
					id="hs-script-loader"
					async
					defer
					src="//js-eu1.hs-scripts.com/147033433.js"
				/>
			</head>
			<body>
				<GoogleAnalytics gaId="G-0RTZ5EPB26" />
				<OpenPanelComponent
					apiUrl="https://openpanel.notploy.com/api"
					clientId="bf5a178b-7f28-4461-bf47-d63feff15922"
					trackScreenViews={true}
					trackOutgoingLinks={true}
					trackAttributes={true}
					globalProperties={{ site: "website" }}
				/>
				<div className="flex h-full flex-col">
					<Header />
					{children}
					<Footer />
				</div>
			</body>
		</html>
	);
}
