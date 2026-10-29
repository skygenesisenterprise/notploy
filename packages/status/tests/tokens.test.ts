/**
 * Token parsing tests.
 *
 * A token value is `nps_<tok_id>_<secret>`, where the id itself starts with
 * `tok_` and the secret is base64url (whose alphabet also contains `_`). The
 * separator is therefore ambiguous unless the id keeps a fixed shape — these
 * tests pin that down, because getting it wrong silently turns every
 * credential into a 401.
 */
import { describe, expect, it } from "vitest";
import {
	createTokenRecord,
	generateToken,
	hashSecret,
	parseToken,
	verifyBearer,
	verifySecret,
} from "../src/index";
import { createHarness } from "./helpers";

const ACTOR = { type: "system" as const, id: null, label: "test" };

const harness = () => createHarness().ctx;

describe("token parsing", () => {
	it("round-trips a freshly generated token", () => {
		const generated = generateToken();
		const parsed = parseToken(generated.value);
		expect(parsed).not.toBeNull();
		expect(parsed?.id).toBe(generated.id);
		// The stored hash is derived from the secret part of the value.
		const secret = generated.value.slice(generated.prefix.length + 1);
		expect(parsed?.secret).toBe(secret);
		expect(verifySecret(parsed?.secret ?? "", hashSecret(secret))).toBe(true);
	});

	it("keeps the id intact even though the secret contains underscores", () => {
		const id = `tok_${"a".repeat(12)}`;
		const secret = "abc_def_ghijklmnopqrstuv";
		expect(parseToken(`nps_${id}_${secret}`)).toEqual({ id, secret });
	});

	it("rejects malformed values", () => {
		expect(parseToken("")).toBeNull();
		expect(parseToken("not-a-token")).toBeNull();
		expect(parseToken("nps_wrong_abcdefghijklmnop")).toBeNull();
		expect(parseToken("nps_tok_short_secret")).toBeNull();
		expect(parseToken("nps_tok_aaaaaaaaaaaa")).toBeNull();
	});
});

describe("bearer authentication", () => {
	it("authenticates a token created through the service", () => {
		const ctx = harness();
		const created = createTokenRecord(
			ctx,
			{ name: "Reader", scopes: ["read"] },
			ACTOR,
		);
		const actor = verifyBearer(ctx, `Bearer ${created.value}`);
		expect(actor?.id).toBe(created.token.id);
		expect(actor?.scopes).toContain("read");
	});

	it("rejects a tampered or missing credential", () => {
		const ctx = harness();
		const created = createTokenRecord(
			ctx,
			{ name: "Reader", scopes: ["read"] },
			ACTOR,
		);
		expect(verifyBearer(ctx, undefined)).toBeNull();
		expect(verifyBearer(ctx, created.value)).toBeNull();
		expect(verifyBearer(ctx, `Bearer ${created.value}extra`)).toBeNull();
		expect(
			verifyBearer(ctx, "Bearer nps_tok_aaaaaaaaaaaa_zzzzzzzzzzzzzzzz"),
		).toBeNull();
	});
});
