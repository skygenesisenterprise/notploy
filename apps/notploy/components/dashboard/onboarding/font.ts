import localFont from "next/font/local";

// Fraunces is self-hosted (latin subset, weight 600, roman + italic) so the app
// never contacts Google Fonts at build or run time — an offline install used to
// fall back to a system font and log a download warning on every compile.
export const displayFont = localFont({
	src: [
		{
			path: "../../../fonts/Fraunces-latin-600-normal.woff2",
			weight: "600",
			style: "normal",
		},
		{
			path: "../../../fonts/Fraunces-latin-600-italic.woff2",
			weight: "600",
			style: "italic",
		},
	],
	display: "swap",
});
