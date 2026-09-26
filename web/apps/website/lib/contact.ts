/**
 * Contact form delivery.
 *
 * The Node deployment (web/Dockerfile.website) runs app/api/contact, which
 * forwards to HubSpot and Resend. A GitHub Pages build has no server at all, so
 * there the form is delivered by one of:
 *
 *   1. NEXT_PUBLIC_CONTACT_ENDPOINT, when set: any endpoint that accepts the
 *      same JSON body (a form service such as Formspree, or the contact route
 *      of the Docker deployment). Because it is NEXT_PUBLIC_ it is inlined at
 *      build time, so it must be an absolute URL.
 *   2. A mailto: hand-off, so the page still does something useful instead of
 *      posting into the void.
 */

const isStaticExport = process.env.NEXT_OUTPUT === "export";

/** Set on the Pages build only. Absolute URL, never a relative path. */
const externalEndpoint =
	process.env.NEXT_PUBLIC_CONTACT_ENDPOINT?.trim() || undefined;

export interface ContactSubmission {
	inquiryType: string;
	firstName: string;
	lastName: string;
	email: string;
	company: string;
	message: string;
	[key: string]: unknown;
}

export type ContactDelivery = "api" | "endpoint" | "mailto";

export function contactDelivery(): ContactDelivery {
	if (!isStaticExport) {
		return "api";
	}

	return externalEndpoint ? "endpoint" : "mailto";
}

function buildMailto(submission: ContactSubmission): string {
	const lines = [
		`Type: ${submission.inquiryType}`,
		`Name: ${submission.firstName} ${submission.lastName}`,
		`Email: ${submission.email}`,
		`Company: ${submission.company}`,
		"",
		submission.message,
	];

	return `mailto:contact@notploy.com?subject=${encodeURIComponent(
		`[${submission.inquiryType.toUpperCase()}] Website enquiry from ${submission.firstName} ${submission.lastName}`,
	)}&body=${encodeURIComponent(lines.join("\n"))}`;
}

export interface SubmitResult {
	ok: boolean;
	/** True when the browser opened a mail client instead of POSTing. */
	usedMailto?: boolean;
	error?: string;
}

/**
 * Deliver a contact submission through whichever transport this build has.
 * Resolves rather than throws so callers can share one code path.
 */
export async function submitContactForm(
	submission: ContactSubmission,
): Promise<SubmitResult> {
	const delivery = contactDelivery();

	if (delivery === "mailto") {
		if (typeof window === "undefined") {
			return { ok: false, error: "No contact endpoint configured" };
		}

		window.location.href = buildMailto(submission);
		return { ok: true, usedMailto: true };
	}

	const endpoint = delivery === "endpoint" ? externalEndpoint : "/api/contact";

	try {
		const response = await fetch(endpoint as string, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(submission),
		});

		if (!response.ok) {
			return { ok: false, error: `Endpoint responded ${response.status}` };
		}

		return { ok: true };
	} catch (error) {
		return {
			ok: false,
			error: error instanceof Error ? error.message : "Unknown error",
		};
	}
}
