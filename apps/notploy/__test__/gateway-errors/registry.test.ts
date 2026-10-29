import {
	GATEWAY_ERRORS,
	GATEWAY_ERROR_CODES,
	getDefaultGatewayError,
	getGatewayErrorByCode,
	resolveGatewayError,
} from "@notploy/server";
import { describe, expect, test } from "vitest";

describe("gateway error registry", () => {
	test("every code has a valid definition", () => {
		for (const code of GATEWAY_ERROR_CODES) {
			const definition = GATEWAY_ERRORS[code];
			expect(definition.code).toBe(code);
			expect(definition.httpStatus).toBeGreaterThanOrEqual(400);
			expect(definition.httpStatus).toBeLessThanOrEqual(599);
			expect(definition.title.length).toBeGreaterThan(0);
			expect(definition.description.length).toBeGreaterThan(0);
			expect(definition.visitorGuidance.length).toBeGreaterThan(0);
			expect(definition.operatorGuidance.length).toBeGreaterThan(0);
		}
	});

	test("maps common gateway statuses to their default code", () => {
		expect(getDefaultGatewayError(404).code).toBe("NP-1001");
		expect(getDefaultGatewayError(502).code).toBe("NP-1003");
		expect(getDefaultGatewayError(503).code).toBe("NP-1002");
		expect(getDefaultGatewayError(504).code).toBe("NP-1004");
	});

	test("falls back to NP-1999 for unmapped statuses", () => {
		expect(getDefaultGatewayError(500).code).toBe("NP-1999");
		expect(getDefaultGatewayError(599).code).toBe("NP-1999");
	});

	test("accepts a known code only when its status matches", () => {
		expect(resolveGatewayError(503, "NP-1503").code).toBe("NP-1503");
		expect(resolveGatewayError(502, "NP-1503").code).toBe("NP-1003");
		expect(resolveGatewayError(502, "NP-1001").code).toBe("NP-1003");
	});

	test("ignores unknown codes and invalid statuses", () => {
		expect(getGatewayErrorByCode("NP-0000")).toBeNull();
		expect(getGatewayErrorByCode(null)).toBeNull();
		expect(resolveGatewayError(200).code).toBe("NP-1003");
		expect(resolveGatewayError(200).httpStatus).toBe(502);
		expect(resolveGatewayError(Number.NaN).code).toBe("NP-1003");
	});
});
