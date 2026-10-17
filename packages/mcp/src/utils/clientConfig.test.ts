import { describe, expect, it } from "vitest";
import { parseCustomHeaders } from "./clientConfig.js";

describe("parseCustomHeaders", () => {
  it("returns no custom headers when unset", () => {
    expect(parseCustomHeaders(undefined)).toEqual({});
  });

  it("accepts Cloudflare Access-style headers", () => {
    const headers = parseCustomHeaders(
      JSON.stringify({
        "CF-Access-Client-Id": "client-id-placeholder",
        "CF-Access-Client-Secret": "client-secret-placeholder",
      }),
    );

    expect(headers).toEqual({
      "CF-Access-Client-Id": "client-id-placeholder",
      "CF-Access-Client-Secret": "client-secret-placeholder",
    });
  });

  it("rejects malformed JSON", () => {
    expect(() => parseCustomHeaders("not-json")).toThrow(/must be valid JSON/);
  });

  it("rejects an empty string when configured", () => {
    expect(() => parseCustomHeaders("")).toThrow(/must be valid JSON/);
  });

  it("rejects arrays", () => {
    expect(() => parseCustomHeaders("[]")).toThrow(/must be a JSON object/);
  });

  it("rejects non-object JSON", () => {
    expect(() => parseCustomHeaders('"header-value"')).toThrow(/must be a JSON object/);
  });

  it("rejects non-string values", () => {
    expect(() => parseCustomHeaders(JSON.stringify({ "X-Custom-Header": 123 }))).toThrow(
      /only string header values/,
    );
  });

  it("rejects empty header names", () => {
    expect(() => parseCustomHeaders(JSON.stringify({ "": "value" }))).toThrow(/empty header name/);
  });

  it("rejects invalid header names", () => {
    expect(() => parseCustomHeaders(JSON.stringify({ "Bad Header": "value" }))).toThrow(
      /invalid header name/,
    );
    expect(() => parseCustomHeaders(JSON.stringify({ "X-Test\r\nInjected": "value" }))).toThrow(
      /invalid header name/,
    );
  });

  it("rejects control characters in values", () => {
    expect(() => parseCustomHeaders(JSON.stringify({ "X-Test": "a\r\nb" }))).toThrow(
      /control characters/,
    );
  });

  it("rejects reserved header names case-insensitively", () => {
    for (const name of [
      "X-API-Key",
      "Authorization",
      "Content-Type",
      "ACCEPT",
      "Host",
      "Cookie",
      "Mcp-Session-Id",
    ]) {
      expect(() => parseCustomHeaders(JSON.stringify({ [name]: "override" })), name).toThrow(
        /reserved header/,
      );
    }
  });
});
