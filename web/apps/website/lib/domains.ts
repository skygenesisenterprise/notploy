/**
 * Cross-service domain configuration of the Astoria government platform.
 *
 * The ministry portal is currently served on its historical domain:
 *
 *   https://bca.astoria-gouv.org             ← current production domain
 *
 * A move to a longer institutional domain is planned:
 *
 *   https://bca.astoria-gouv.org             ← future institutional domain
 *
 * Nothing in this file forces that migration: `main` still resolves to
 * `bca.astoria-gouv.org` so the live portal keeps working, and the routing layers
 * (see `getDomainConfig`) already derive every absolute URL from this single
 * place, so switching the canonical domain later only requires updating the
 * `main` value (and DNS/nginx aliases, which are out of scope of the app).
 */
export type Environment = 'production' | 'localhost'

export interface DomainConfig {
  main: string
  studios: string
  sso: string
  protocol: string
}

const DOMAINS: Record<Environment, DomainConfig> = {
  production: {
    main: 'bca.astoria-gouv.org',
    studios: 'studios.astoria-gouv.org',
    sso: 'sso.astoria-gouv.org',
    protocol: 'https',
  },
  localhost: {
    main: 'bca.astoria-gouv.localhost',
    studios: 'studios.astoria-gouv.localhost',
    sso: 'sso.astoria-gouv.localhost',
    protocol: 'http',
  },
}

export function detectEnvironment(): Environment {
  if (typeof window === 'undefined') {
    return process.env.NODE_ENV === 'production' ? 'production' : 'localhost'
  }

  return window.location.hostname.includes('localhost') ? 'localhost' : 'production'
}

export function getDomainConfig(): DomainConfig {
  return DOMAINS[detectEnvironment()]
}

export function getDomainUrl(service: 'main' | 'studios' | 'sso', path: string = ''): string {
  const config = getDomainConfig()
  return `${config.protocol}://${config[service]}${path}`
}

export function switchDomain(target: 'main' | 'studios' | 'sso', path: string): string {
  return getDomainUrl(target, path)
}
