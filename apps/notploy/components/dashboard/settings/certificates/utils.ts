import type { CertificateStatus } from "@notploy/server";

/** Certificate states from issue #59: pending, active, expiring, expired. */
export type CertificateLifecycleStatus = CertificateStatus;

const STATUS_CLASS: Record<CertificateLifecycleStatus, string> = {
	pending: "text-muted-foreground",
	active: "text-muted-foreground",
	expiring: "text-yellow-500",
	expired: "text-red-500",
};

const formatDate = (value: string | Date | null | undefined) =>
	value
		? new Date(value).toLocaleDateString([], {
				year: "numeric",
				month: "long",
				day: "numeric",
			})
		: null;

export const describeExpiration = (certificate: {
	status: CertificateLifecycleStatus;
	notAfter: string | Date | null | undefined;
	daysUntilExpiration: number | null;
}) => {
	const expirationDate = formatDate(certificate.notAfter);

	switch (certificate.status) {
		case "expired":
			return {
				className: STATUS_CLASS.expired,
				message:
					`Expired ${expirationDate ? `on ${expirationDate}` : ""}`.trim(),
			};
		case "expiring":
			return {
				className: STATUS_CLASS.expiring,
				message: `Expires in ${certificate.daysUntilExpiration} days (${expirationDate})`,
			};
		case "pending":
			return {
				className: STATUS_CLASS.pending,
				message: "Not valid yet",
			};
		default:
			return {
				className: STATUS_CLASS.active,
				message: expirationDate ? `Expires ${expirationDate}` : "Valid",
			};
	}
};

/** Presentation for one certificate of a bundled chain. */
export const describeChainEntry = (entry: {
	isLeaf: boolean;
	unparsable: boolean;
	commonName: string | null;
	notAfter: string | null;
	daysUntilExpiration: number | null;
}) => {
	const label = entry.isLeaf
		? "Certificate 1 (Leaf)"
		: `Certificate ${entry.index + 1}`;

	if (entry.unparsable) {
		return {
			label,
			className: "text-red-500",
			message: "Could not be parsed",
		};
	}

	const expirationDate = formatDate(entry.notAfter);

	if (entry.daysUntilExpiration === null) {
		return { label, className: STATUS_CLASS.pending, message: "Unknown" };
	}
	if (entry.daysUntilExpiration < 0) {
		return {
			label,
			className: STATUS_CLASS.expired,
			message: `Expired on ${expirationDate}`,
		};
	}
	if (entry.daysUntilExpiration <= 30) {
		return {
			label,
			className: STATUS_CLASS.expiring,
			message: `Expires in ${entry.daysUntilExpiration} days`,
		};
	}
	return {
		label,
		className: STATUS_CLASS.active,
		message: `Expires ${expirationDate}`,
	};
};

export const countChainCertificates = (certificateData: string) =>
	(certificateData.match(/-----BEGIN CERTIFICATE-----/g) ?? []).length;
