/**
 * Cross-service domain configuration of the Notploy platform.
 *
 * The public website is served on its historical domain:
 *
 *   https://notploy.com                      ← main website
 *   https://app.notploy.com                  ← hosted control plane (Notploy Cloud)
 *   https://docs.notploy.com                 ← documentation
 *   https://templates.notploy.com            ← template gallery
 *
 * The `sso` / `studios` groups are the identity and platform surfaces served by
 * the notploy application itself (`apps/notploy`); the marketing website only
 * needs the main group, but the routing layers keep deriving every absolute URL
 * from this single place so a domain move never requires touching a component.
 */
export type Environment = "production" | "localhost";

export interface DomainConfig {
  main: string;
  studios: string;
  sso: string;
  protocol: string;
}

const DOMAINS: Record<Environment, DomainConfig> = {
  production: {
    main: "notploy.com",
    studios: "app.notploy.com",
    sso: "sso.notploy.com",
    protocol: "https",
  },
  localhost: {
    main: "notploy.localhost",
    studios: "studios.notploy.localhost",
    sso: "sso.notploy.localhost",
    protocol: "http",
  },
};

export function detectEnvironment(): Environment {
  if (typeof window === "undefined") {
    return process.env.NODE_ENV === "production" ? "production" : "localhost";
  }

  return window.location.hostname.includes("localhost") ? "localhost" : "production";
}

export function getDomainConfig(): DomainConfig {
  return DOMAINS[detectEnvironment()];
}

export function getDomainUrl(service: "main" | "studios" | "sso", path = ""): string {
  const config = getDomainConfig();
  return `${config.protocol}://${config[service]}${path}`;
}

export function switchDomain(target: "main" | "studios" | "sso", path: string): string {
  return getDomainUrl(target, path);
}
