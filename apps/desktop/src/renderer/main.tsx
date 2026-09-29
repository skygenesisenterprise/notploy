/**
 * Renderer entry point.
 *
 * `React.StrictMode` is on: in development it surfaces effects that are not
 * idempotent, which matters here because every page loads data in an effect and
 * a double-invocation would otherwise hide a request storm.
 */

import * as React from "react";
import { createRoot } from "react-dom/client";
import { App } from "@/renderer/app";
import "@/renderer/styles.css";

const container = document.getElementById("root");
if (!container) {
	throw new Error("The renderer root element is missing from index.html");
}

createRoot(container).render(
	<React.StrictMode>
		<App />
	</React.StrictMode>,
);
