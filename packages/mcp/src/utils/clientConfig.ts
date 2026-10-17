const RESERVED_CUSTOM_HEADER_NAMES = new Set([
  "x-api-key",
  "authorization",
  "content-type",
  "accept",
  "content-length",
  "host",
  "connection",
  "cookie",
  "set-cookie",
  "transfer-encoding",
  "mcp-session-id",
]);

// RFC 7230 token characters. Rejecting anything else prevents header injection
// through configuration and mirrors what fetch/undici accepts.
const HEADER_NAME_PATTERN = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;

/**
 * Parses NOTPLOY_CUSTOM_HEADERS.
 *
 * Authentication, content and transport headers are reserved: the API key must
 * come from NOTPLOY_API_KEY, and a custom header must not be able to replace
 * the credential, the session id or the request encoding.
 */
export function parseCustomHeaders(rawHeaders: string | undefined): Record<string, string> {
  if (rawHeaders === undefined) {
    return {};
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawHeaders);
  } catch (error) {
    throw new Error(
      "Environment variable NOTPLOY_CUSTOM_HEADERS must be valid JSON containing an object of string header names to string values",
      { cause: error },
    );
  }

  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(
      "Environment variable NOTPLOY_CUSTOM_HEADERS must be a JSON object of string header names to string values",
    );
  }

  const customHeaders: Record<string, string> = {};
  for (const [name, value] of Object.entries(parsed)) {
    if (name.trim() === "") {
      throw new Error("Environment variable NOTPLOY_CUSTOM_HEADERS contains an empty header name");
    }

    if (!HEADER_NAME_PATTERN.test(name)) {
      throw new Error(
        `Environment variable NOTPLOY_CUSTOM_HEADERS contains an invalid header name: ${JSON.stringify(name)}`,
      );
    }

    if (RESERVED_CUSTOM_HEADER_NAMES.has(name.toLowerCase())) {
      throw new Error(
        "Environment variable NOTPLOY_CUSTOM_HEADERS cannot override reserved headers (authentication, transport or content); configure Notploy authentication with NOTPLOY_API_KEY",
      );
    }

    if (typeof value !== "string") {
      throw new Error(
        "Environment variable NOTPLOY_CUSTOM_HEADERS must contain only string header values",
      );
    }

    // Reject CR/LF/NUL so a custom header cannot inject additional headers.
    // biome-ignore lint/suspicious/noControlCharactersInRegex: intentional header-injection validation
    if (/[\r\n\u0000]/.test(value)) {
      throw new Error(
        "Environment variable NOTPLOY_CUSTOM_HEADERS must not contain control characters in header values",
      );
    }

    customHeaders[name] = value;
  }

  return customHeaders;
}
