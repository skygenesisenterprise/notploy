"use client";

import { useEffect } from "react";

const DESTINATION = "/docs/core/";

export default function Page() {
	useEffect(() => {
		window.location.replace(DESTINATION);
	}, []);

	return (
		<main className="flex min-h-screen flex-col items-center justify-center gap-4">
			<meta httpEquiv="refresh" content={`0;url=${DESTINATION}`} />
			<h1 className="text-2xl font-semibold">Notploy Documentation</h1>
			<p>
				The documentation moved to{" "}
				<a className="underline" href={DESTINATION}>
					the Core section
				</a>
				.
			</p>
		</main>
	);
}
