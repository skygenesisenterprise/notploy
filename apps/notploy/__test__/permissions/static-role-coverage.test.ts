import {
	adminRole,
	memberRole,
	ownerRole,
	statements,
} from "@notploy/server/lib/access-control";
import { describe, expect, it } from "vitest";

/**
 * Notploy does not have licensed resource tiers: every resource in
 * `statements` is reachable by every deployment. What must hold instead is
 * that the static roles cover every resource declared in `statements`, so no
 * resource is silently unreachable for owner/admin and none is accidentally
 * granted to member.
 */
describe("static roles cover every statement resource", () => {
	for (const [roleName, role] of [
		["owner", ownerRole],
		["admin", adminRole],
	] as const) {
		it(`${roleName} authorizes every resource/action except its documented exclusions`, () => {
			const excluded = new Set(
				roleName === "admin" ? ["organization:delete"] : [],
			);

			for (const [resource, actions] of Object.entries(statements)) {
				for (const action of actions) {
					const result = role.authorize({
						[resource]: [action],
					} as never);
					if (excluded.has(`${resource}:${action}`)) {
						expect(result.success).toBe(false);
					} else {
						expect(
							result.success,
							`${roleName} should be authorized for ${resource}:${action}`,
						).toBe(true);
					}
				}
			}
		});
	}

	it("member is denied every org-level resource", () => {
		for (const resource of [
			"organization",
			"server",
			"registry",
			"certificate",
			"destination",
			"notification",
			"auditLog",
		] as const) {
			for (const action of statements[resource]) {
				const result = memberRole.authorize({
					[resource]: [action],
				} as never);
				expect(
					result.success,
					`member should NOT be authorized for ${resource}:${action}`,
				).toBe(false);
			}
		}
	});

	it("no resource in statements is missing from the owner role", () => {
		const missing = Object.entries(statements).filter(([resource, actions]) =>
			actions.some(
				(action) => !ownerRole.authorize({ [resource]: [action] } as never).success,
			),
		);
		expect(missing).toEqual([]);
	});
});