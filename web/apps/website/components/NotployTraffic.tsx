import Script from "next/script";

/**
 * Loads the first-party Notploy Traffic Manager instrumentation.
 *
 * The whole instrumentation lives in the collector (`traffic.js`, served by the
 * Notploy instance), so this component only declares *which* property the site
 * is: `data-property-key` is the public key issued by the Traffic Manager for
 * this domain, and `data-endpoint` is the Notploy origin that receives the
 * events. Both come from the environment, so an instance without a Traffic
 * Manager configured simply renders nothing.
 *
 * See `apps/notploy/public/traffic.js` for what is collected (page views, route
 * changes, explicit events) and what is not (no cookie, no user agent, no
 * fingerprint, no IP address).
 */
export const NotployTraffic = () => {
	const propertyKey = process.env.NEXT_PUBLIC_NOTPLOY_TRAFFIC_KEY;
	const endpoint = process.env.NEXT_PUBLIC_NOTPLOY_TRAFFIC_ENDPOINT;

	if (!propertyKey || !endpoint) {
		return null;
	}

	return (
		<Script
			id="notploy-traffic"
			strategy="afterInteractive"
			src={`${endpoint.replace(/\/+$/, "")}/traffic.js`}
			data-property-key={propertyKey}
			data-endpoint={endpoint.replace(/\/+$/, "")}
		/>
	);
};
