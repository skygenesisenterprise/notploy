import type { GatewayErrorPageConfig } from "./config";
import type { GatewayErrorDefinition } from "./registry";

const STATUS_TEXT: Record<number, string> = {
	400: "Bad Request",
	401: "Unauthorized",
	403: "Forbidden",
	404: "Not Found",
	408: "Request Timeout",
	429: "Too Many Requests",
	500: "Internal Server Error",
	501: "Not Implemented",
	502: "Bad Gateway",
	503: "Service Unavailable",
	504: "Gateway Timeout",
	505: "HTTP Version Not Supported",
};

const STATUS_HEADLINES: Record<number, string> = {
	400: "Bad request",
	401: "Unauthorized",
	403: "Forbidden",
	404: "Not found",
	408: "Request timeout",
	429: "Too many requests",
	500: "Internal server error",
	501: "Not implemented",
	502: "Bad gateway",
	503: "Service unavailable",
	504: "Gateway timeout",
	505: "HTTP version not supported",
};

const escapeHtml = (value: string): string =>
	value.replace(/[&<>"']/g, (character) => {
		switch (character) {
			case "&":
				return "&amp;";
			case "<":
				return "&lt;";
			case ">":
				return "&gt;";
			case '"':
				return "&quot;";
			case "'":
				return "&#39;";
			default:
				return character;
		}
	});

const formatTimestamp = (date: Date): string =>
	date.toISOString().replace(/\.\d{3}Z$/, "Z");

const formatDisplayTimestamp = (iso: string): string =>
	iso.replace("T", " ").replace(/Z$/, " UTC");

const statusText = (status: number): string =>
	STATUS_TEXT[status] ?? "Gateway Error";

const statusHeadline = (status: number): string =>
	STATUS_HEADLINES[status] ?? "Gateway error";

const docsHref = (
	config: GatewayErrorPageConfig,
	definition: GatewayErrorDefinition,
): string | null => {
	if (!config.docsUrl || !definition.docsPath) return null;
	return `${config.docsUrl.replace(/\/$/, "")}${definition.docsPath}`;
};

export interface RenderGatewayErrorOptions {
	error: GatewayErrorDefinition;
	requestId: string;
	timestamp: Date;
	config: GatewayErrorPageConfig;
}

const USER_ICON = `<svg viewBox="0 0 80 80" fill="none" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg">
<rect x="5" y="5" width="70" height="70" rx="12" stroke="#ababab" stroke-width="2"/>
<circle cx="40" cy="31" r="10" fill="currentColor"/>
<path d="M22 59c0-9.941 8.059-18 18-18s18 8.059 18 18" fill="currentColor"/>
</svg>`;

const GATEWAY_ICON = `<svg viewBox="0 0 80 80" fill="none" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg">
<rect x="5" y="5" width="70" height="70" rx="12" stroke="#ababab" stroke-width="2"/>
<circle cx="40" cy="40" r="17" stroke="currentColor" stroke-width="4"/>
<path d="M40 23c5.2 5.6 5.2 28.4 0 34M23 40h34" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>
<path d="M27 29.5c3.7 2.4 8.1 3.7 13 3.7s9.3-1.3 13-3.7M27 50.5c3.7-2.4 8.1-3.7 13-3.7s9.3 1.3 13 3.7" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
</svg>`;

const HOST_ICON = `<svg viewBox="0 0 80 80" fill="none" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg">
<rect x="5" y="5" width="70" height="70" rx="12" stroke="#ababab" stroke-width="2"/>
<rect x="24" y="24" width="32" height="13" rx="3" fill="currentColor"/>
<rect x="24" y="43" width="32" height="13" rx="3" fill="currentColor"/>
<circle cx="31" cy="30.5" r="2" fill="#ebebeb"/>
<circle cx="31" cy="49.5" r="2" fill="#ebebeb"/>
</svg>`;

export const renderGatewayErrorPage = ({
	error,
	requestId,
	timestamp,
	config,
}: RenderGatewayErrorOptions): string => {
	const title = escapeHtml(error.title);
	const description = escapeHtml(error.description);
	const visitorGuidance = escapeHtml(error.visitorGuidance);
	const operatorGuidance = escapeHtml(error.operatorGuidance);
	const brandName = escapeHtml(config.brandName);
	const code = escapeHtml(error.code);
	const id = escapeHtml(requestId);
	const headline = escapeHtml(statusHeadline(error.httpStatus));
	const statusLabel = escapeHtml(
		`${error.httpStatus} ${statusText(error.httpStatus)}`,
	);
	const iso = formatTimestamp(timestamp);
	const displayTimestamp = formatDisplayTimestamp(iso);
	const environmentLabel = config.isCloud ? "Cloud" : "Self-hosted";
	const docsLink = docsHref(config, error) ?? config.docsUrl;
	const learnMoreHref = docsLink ?? config.supportUrl ?? null;

	const learnMore = learnMoreHref
		? `Visit <a href="${escapeHtml(learnMoreHref)}" rel="noreferrer">${brandName}</a> for more information.`
		: `Visit ${brandName} for more information.`;

	const brandHeading = docsLink
		? `<a href="${escapeHtml(docsLink)}" rel="noreferrer">${brandName}</a>`
		: brandName;

	const footerItems = [
		`<span>${brandName} request ID: <strong>${id}</strong></span>`,
		`<span>Error code: <strong>${code}</strong></span>`,
		`<span>${environmentLabel}</span>`,
	];
	if (docsLink) {
		footerItems.push(
			`<a href="${escapeHtml(docsLink)}" rel="noreferrer">Documentation</a>`,
		);
	}
	if (config.statusUrl) {
		footerItems.push(
			`<a href="${escapeHtml(config.statusUrl)}" rel="noreferrer">Status</a>`,
		);
	}
	if (config.supportUrl) {
		footerItems.push(
			`<a href="${escapeHtml(config.supportUrl)}" rel="noreferrer">Support</a>`,
		);
	}

	const footer = footerItems.join(
		`<span class="sep" aria-hidden="true">•</span>`,
	);

	return `<!doctype html>
<html lang="${escapeHtml(config.locale)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${headline} · ${brandName}</title>
<style>
:root {
	color-scheme: light;
	--bg: #ffffff;
	--text: #404040;
	--band: #ebebeb;
	--band-edge: #dedede;
	--link: #2f7bbf;
	--ok: #9bca3e;
	--error: #bd2426;
	--pill: #d9d9d9;
	--sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
	--mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
}
*, *::before, *::after { box-sizing: border-box; }
html { background: var(--bg); }
body {
	margin: 0;
	background: var(--bg);
	color: var(--text);
	font-family: var(--sans);
	font-size: 16px;
	line-height: 1.5;
	-webkit-font-smoothing: antialiased;
	text-rendering: optimizeLegibility;
}
.container { width: min(960px, calc(100% - 48px)); margin: 0 auto; }
.header { padding-top: 42px; }
h1 {
	margin: 0;
	display: flex;
	align-items: center;
	flex-wrap: wrap;
	gap: 14px 18px;
	font-size: clamp(40px, 6.2vw, 60px);
	line-height: 1.05;
	font-weight: 700;
	letter-spacing: -0.02em;
	color: var(--text);
}
.status-pill {
	display: inline-flex;
	align-items: center;
	min-height: 35px;
	padding: 4px 16px;
	border-radius: 999px;
	background: var(--pill);
	color: #4e4e4e;
	font-size: 13px;
	font-weight: 400;
	line-height: 1.2;
	letter-spacing: 0;
	white-space: nowrap;
}
.lede { margin: 12px 0 0; font-size: 16px; line-height: 1.5; color: var(--text); }
.lede a, .footer a, .status-name a { color: var(--link); text-decoration: none; }
.lede a:hover, .footer a:hover, .status-name a:hover { text-decoration: underline; }
.timestamp { margin: 5px 0 0; font-size: 16px; line-height: 1.5; color: var(--text); }
.status-band {
	margin-top: 32px;
	padding: 60px 0 64px;
	background: linear-gradient(to bottom, var(--band-edge) 0, var(--band) 10px, var(--band) calc(100% - 10px), var(--band-edge) 100%);
}
.status-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); }
.status-column {
	display: flex;
	flex-direction: column;
	align-items: center;
	min-width: 0;
	text-align: center;
}
.status-icon { display: flex; width: 80px; height: 80px; align-items: center; justify-content: center; color: var(--ok); }
.status-icon.is-error { color: var(--error); }
.status-icon svg { display: block; width: 80px; height: 80px; }
.status-label { margin: 36px 0 0; font-size: 16px; line-height: 1.4; color: var(--text); }
.status-name {
	margin: 12px 0 0;
	font-size: 24px;
	font-weight: 600;
	line-height: 1.2;
	color: #ababab;
	overflow-wrap: anywhere;
}
.status-name a { color: var(--link); }
.status-state { margin: 0; font-size: 24px; font-weight: 600; line-height: 1.2; }
.status-state.is-ok { color: var(--ok); }
.status-state.is-error { color: var(--error); }
.content { padding: 30px 0 64px; }
.guidance { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
.guidance section { padding-right: 64px; }
.guidance section:last-child { padding-right: 0; }
.guidance h2 {
	margin: 0 0 21px;
	font-size: 30px;
	font-weight: 600;
	line-height: 1.2;
	color: var(--text);
}
.guidance p { margin: 0 0 12px; font-size: 16px; line-height: 1.5; color: var(--text); }
.guidance p:last-child { margin-bottom: 0; }
.guidance strong { font-weight: 600; }
.footer {
	margin-top: 96px;
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	justify-content: center;
	gap: 6px 8px;
	font-size: 13px;
	line-height: 1.4;
	color: var(--text);
	text-align: center;
}
.footer .sep { color: var(--text); }
.footer strong { font-weight: 600; }
.sr-only {
	position: absolute;
	width: 1px;
	height: 1px;
	padding: 0;
	margin: -1px;
	overflow: hidden;
	clip: rect(0, 0, 0, 0);
	white-space: nowrap;
	border: 0;
}
@media (max-width: 720px) {
	.container { width: calc(100% - 32px); }
	.header { padding-top: 28px; }
	h1 { gap: 10px 12px; }
	.status-band { margin-top: 24px; padding: 40px 0; }
	.status-grid { grid-template-columns: 1fr; row-gap: 32px; }
	.status-icon, .status-icon svg { width: 64px; height: 64px; }
	.status-label { margin-top: 18px; }
	.content { padding-top: 28px; padding-bottom: 48px; }
	.guidance { grid-template-columns: 1fr; row-gap: 28px; }
	.guidance section { padding-right: 0; }
	.footer { margin-top: 56px; }
}
</style>
</head>
<body>
<div class="container header">
	<h1>${headline} <span class="status-pill" aria-label="HTTP status ${statusLabel}">Error code ${error.httpStatus}</span></h1>
	<p class="lede">${learnMore}</p>
	<p class="timestamp"><time datetime="${iso}">${displayTimestamp}</time></p>
</div>
<div class="status-band">
	<div class="container">
		<h2 class="sr-only">Connection status</h2>
		<div class="status-grid">
			<div class="status-column">
				<div class="status-icon" aria-hidden="true">${USER_ICON}</div>
				<p class="status-label">You</p>
				<p class="status-name">Browser</p>
				<p class="status-state is-ok">Working</p>
			</div>
			<div class="status-column">
				<div class="status-icon" aria-hidden="true">${GATEWAY_ICON}</div>
				<p class="status-label">${environmentLabel}</p>
				<p class="status-name">${brandHeading}</p>
				<p class="status-state is-ok">Working</p>
			</div>
			<div class="status-column">
				<div class="status-icon is-error" aria-hidden="true">${HOST_ICON}</div>
				<p class="status-label">Application</p>
				<p class="status-name">Host</p>
				<p class="status-state is-error">Error</p>
			</div>
		</div>
	</div>
</div>
<div class="container content">
	<div class="guidance">
		<section>
			<h2>What happened?</h2>
			<p><strong>${title}.</strong> ${description}</p>
		</section>
		<section>
			<h2>What can I do?</h2>
			<p><strong>If you are visiting this site:</strong> ${visitorGuidance}</p>
			<p><strong>If you operate this application:</strong> ${operatorGuidance}</p>
		</section>
	</div>
	<footer class="footer">${footer}</footer>
</div>
</body>
</html>`;
};

export const renderFallbackGatewayErrorPage = (): string => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Gateway error</title>
<style>
:root { color-scheme: light; }
*, *::before, *::after { box-sizing: border-box; }
body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #ffffff; color: #404040; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; padding: 24px; }
main { max-width: 560px; }
h1 { margin: 0 0 16px; font-size: clamp(40px, 6vw, 60px); line-height: 1.05; letter-spacing: -0.02em; }
p { margin: 0 0 12px; color: #404040; line-height: 1.5; }
code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
</style>
</head>
<body>
<main>
<h1>Gateway error</h1>
<p>This page could not be rendered. The request failed before the application could respond.</p>
<p>Reference <code>NP-1999</code></p>
</main>
</body>
</html>`;
