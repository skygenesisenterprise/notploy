import type { Metadata, Viewport } from "next";
import type * as React from "react";
import "../styles//globals.css";

export const metadata: Metadata = {
	title: {
		default: "Status",
		template: "%s · Status",
	},
	description:
		"Real-time status, incidents and uptime history for the platform services.",
	robots: { index: true, follow: true },
};

export const viewport: Viewport = {
	themeColor: [
		{ media: "(prefers-color-scheme: light)", color: "#eae4d8" },
		{ media: "(prefers-color-scheme: dark)", color: "#171717" },
	],
};

export default function RootLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<html lang="en">
			<body className="min-h-dvh antialiased">{children}</body>
		</html>
	);
}
