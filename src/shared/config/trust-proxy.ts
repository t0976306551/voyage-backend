/**
 * Resolves the Express `trust proxy` setting from the TRUST_PROXY env var.
 *
 * Why this exists: behind a reverse proxy / load balancer the backend's direct
 * peer is the proxy, not the user, so `req.ip` becomes the proxy's address and
 * every user collapses into one IP. IP-based rate limiting (login brute-force,
 * invite-code enumeration) then keys everyone into a single bucket. Telling
 * Express how many proxy hops to trust lets it recover the real client IP from
 * the X-Forwarded-For header.
 *
 * Design: inert by default. When TRUST_PROXY is unset we return `undefined` and
 * the caller does NOT touch Express's default (`false`) — identical to today's
 * behavior, zero regression. The setting only activates when explicitly given.
 *
 * Accepted values (see .env.example):
 *   - unset / empty      → undefined (keep Express default; correct for local
 *                          dev and direct-to-internet deployments)
 *   - a non-negative int → trust exactly N proxy hops (must equal the REAL
 *                          number of proxies that append X-Forwarded-For;
 *                          setting it too high makes req.ip spoofable)
 *   - "false"            → trust nothing
 *   - a comma list of IPs / CIDRs / presets (loopback, linklocal, uniquelocal)
 *                          → trust only those addresses (most robust: pins to
 *                          known proxy IPs even if hop count changes)
 *
 * Deliberately rejected: "true". Trusting every hop lets any client spoof
 * X-Forwarded-For and bypass IP-based rate limiting, so we ignore it (keeping
 * the safe default) and warn.
 */
export type TrustProxySetting = boolean | number | string;

export function resolveTrustProxy(raw: string | undefined): TrustProxySetting | undefined {
  const value = (raw ?? '').trim();
  if (value === '') return undefined;

  const lower = value.toLowerCase();
  if (lower === 'false') return false;
  if (lower === 'true') {
    console.warn(
      "[trust-proxy] TRUST_PROXY=true is unsafe — it lets clients spoof " +
        'X-Forwarded-For and bypass IP-based rate limiting. Ignoring it and ' +
        'keeping the default (off). Set the real number of proxy hops ' +
        '(e.g. TRUST_PROXY=1) or a proxy IP/CIDR list instead.',
    );
    return undefined;
  }

  // Pure non-negative integer → number of proxy hops to trust.
  if (/^\d+$/.test(value)) return parseInt(value, 10);

  // Otherwise: a comma-separated list of IPs / CIDRs / preset names.
  // Passed through verbatim to Express (proxy-addr handles parsing).
  return value;
}

/**
 * Logs the effective trust-proxy setting at startup so operators can confirm
 * what is in force. When unset in production, emits a hint (not an error —
 * direct-to-internet deployments legitimately need no proxy trust).
 */
export function logTrustProxyStatus(setting: TrustProxySetting | undefined): void {
  if (setting === undefined) {
    if (process.env.NODE_ENV === 'production') {
      console.warn(
        '[trust-proxy] TRUST_PROXY is not set. If this server runs behind a ' +
          'reverse proxy or load balancer (nginx, Cloudflare, Fly, Render, ' +
          'etc.), set TRUST_PROXY to the number of proxy hops so rate limiting ' +
          'can identify real client IPs. If it is exposed directly to the ' +
          'internet, no action is needed.',
      );
    }
    return;
  }
  console.log(`[trust-proxy] Express 'trust proxy' set to: ${JSON.stringify(setting)}`);
}
