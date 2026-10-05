import {
	certificateCoversHostname,
	createCertificate,
	findCertificateById,
	findCertificatesByOrganization,
	findPublicCertificateById,
	getCertificateChainDetails,
	IS_CLOUD,
	parseCertificate,
	removeCertificateById,
	toPublicCertificate,
	updateCertificate,
	validateCertificate,
} from "@notploy/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createTRPCRouter, withPermission } from "@/server/api/trpc";
import { audit } from "@/server/api/utils/audit";
import {
	apiCreateCertificate,
	apiFindCertificate,
	apiUpdateCertificate,
} from "@/server/db/schema";

/**
 * Rejects an upload before it is stored or written to disk. Keeps malformed
 * material from reaching Traefik, which would only fail later at handshake time.
 */
const assertValidCertificate = (
	certificateData: string,
	privateKey: string,
	requiredHostnames?: string[],
) => {
	const result = validateCertificate(certificateData, privateKey, {
		requiredHostnames,
	});

	if (!result.valid) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: result.errors.join(". "),
		});
	}

	return result;
};

const assertOrganization = (
	certificate: { organizationId: string },
	activeOrganizationId: string,
	action: string,
) => {
	if (certificate.organizationId !== activeOrganizationId) {
		throw new TRPCError({
			code: "UNAUTHORIZED",
			message: `You are not allowed to ${action} this certificate`,
		});
	}
};

export const certificateRouter = createTRPCRouter({
	create: withPermission("certificate", "create")
		.input(apiCreateCertificate)
		.mutation(async ({ input, ctx }) => {
			if (IS_CLOUD && !input.serverId) {
				throw new TRPCError({
					code: "UNAUTHORIZED",
					message: "Please set a server to create a certificate",
				});
			}

			assertValidCertificate(input.certificateData, input.privateKey);

			const cert = await createCertificate(
				input,
				ctx.session.activeOrganizationId,
			);
			await audit(ctx, {
				action: "create",
				resourceType: "certificate",
				resourceId: cert.certificateId,
				resourceName: cert.name,
			});
			return toPublicCertificate(cert);
		}),

	one: withPermission("certificate", "read")
		.input(apiFindCertificate)
		.query(async ({ input, ctx }) => {
			const certificate = await findCertificateById(input.certificateId);
			assertOrganization(
				certificate,
				ctx.session.activeOrganizationId,
				"access",
			);
			// Never returns privateKey.
			return findPublicCertificateById(input.certificateId);
		}),

	remove: withPermission("certificate", "delete")
		.input(apiFindCertificate)
		.mutation(async ({ input, ctx }) => {
			const certificate = await findCertificateById(input.certificateId);
			assertOrganization(
				certificate,
				ctx.session.activeOrganizationId,
				"delete",
			);
			await audit(ctx, {
				action: "delete",
				resourceType: "certificate",
				resourceId: certificate.certificateId,
				resourceName: certificate.name,
			});
			await removeCertificateById(input.certificateId);
			return true;
		}),

	/**
	 * Certificate inventory. Projects away `privateKey` at the SQL level so no
	 * secret material is loaded into the API process for a list request.
	 */
	all: withPermission("certificate", "read").query(async ({ ctx }) => {
		return await findCertificatesByOrganization(ctx.session.activeOrganizationId);
	}),

	update: withPermission("certificate", "update")
		.input(apiUpdateCertificate)
		.mutation(async ({ input, ctx }) => {
			const certificate = await findCertificateById(input.certificateId);
			assertOrganization(
				certificate,
				ctx.session.activeOrganizationId,
				"update",
			);

			if (input.certificateData || input.privateKey) {
				// Re-validate against the stored material so a partial update
				// cannot leave a certificate whose key no longer matches.
				assertValidCertificate(
					input.certificateData ?? certificate.certificateData,
					input.privateKey ?? certificate.privateKey,
				);
			}

			const updated = await updateCertificate(input.certificateId, {
				name: input.name,
				certificateData: input.certificateData,
				privateKey: input.privateKey,
			});

			await audit(ctx, {
				action: "update",
				resourceType: "certificate",
				resourceId: updated.certificateId,
				resourceName: updated.name,
			});

			return toPublicCertificate(updated);
		}),

	/**
	 * Dry-run validation used by the import form so users see exactly why a
	 * certificate would be rejected before submitting it.
	 */
	validate: withPermission("certificate", "create")
		.input(
			z.object({
				certificateData: z.string().min(1),
				privateKey: z.string().min(1),
				requiredHostnames: z.array(z.string().min(1)).optional(),
			}),
		)
		.mutation(async ({ input }) => {
			const result = validateCertificate(input.certificateData, input.privateKey, {
				requiredHostnames: input.requiredHostnames,
			});
			return result;
		}),

	/**
	 * Per-certificate detail for a bundled chain: Notploy parses the PEM
	 * server side so the browser never has to hand-roll X.509 parsing on
	 * attacker-supplied input.
	 */
	chain: withPermission("certificate", "read")
		.input(apiFindCertificate)
		.query(async ({ input, ctx }) => {
			const certificate = await findCertificateById(input.certificateId);
			assertOrganization(
				certificate,
				ctx.session.activeOrganizationId,
				"access",
			);

			return getCertificateChainDetails(certificate.certificateData);
		}),

	/**
	 * Checks whether the stored certificate covers a hostname. Used before
	 * attaching a certificate to a domain.
	 */
	covers: withPermission("certificate", "read")
		.input(apiFindCertificate.extend({ hostname: z.string().min(1) }))
		.query(async ({ input, ctx }) => {
			const certificate = await findCertificateById(input.certificateId);
			assertOrganization(
				certificate,
				ctx.session.activeOrganizationId,
				"access",
			);

			try {
				const parsed = parseCertificate(certificate.certificateData);
				return {
					covers: certificateCoversHostname(parsed, input.hostname),
					hostnames: parsed.hostnames,
				};
			} catch {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "The stored certificate could not be parsed",
				});
			}
		}),
});
