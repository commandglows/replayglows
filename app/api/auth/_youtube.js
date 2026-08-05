const DEFAULT_RETURN_TO = '/#/playlists';
const YOUTUBE_SCOPE = 'https://www.googleapis.com/auth/youtube';
const _HOST_PATTERN = /^[A-Za-z0-9.-]+(?::\d+)?$/;
const DEFAULT_PRODUCT_ID = 'replayglows';
const DEFAULT_LEGACY_PRODUCT_IDS = ['tubeflow'];
const OAUTH_TICKET_VERSION = 1;
const OAUTH_TICKET_TTL_MS = 15 * 60 * 1000;

function getEnv(...names) {
  for (const name of names) {
    const value = process.env[name];
    if (value && value.trim()) return value.trim();
  }
  return '';
}

function stripTrailingSlash(value) {
  return value.replace(/\/+$/, '');
}

function getRequestOrigin(req) {
  const configured = getEnv('REPLAYGLOWS_APP_URL');
  if (configured) return stripTrailingSlash(configured);

  const forwardedProto = req.headers['x-forwarded-proto'];
  const forwardedHost = req.headers['x-forwarded-host'];

  const rawProto = Array.isArray(forwardedProto)
    ? forwardedProto[0]
    : forwardedProto;
  const protoCandidate = String(rawProto || '')
    .split(',')[0]
    .trim()
    .toLowerCase();
  const protocol = protoCandidate === 'http' ? 'http' : 'https';

  const rawHost = Array.isArray(forwardedHost)
    ? forwardedHost[0]
    : forwardedHost || req.headers.host || 'localhost:3000';
  const hostCandidate = String(rawHost).split(',')[0].trim().toLowerCase();
  const host = _HOST_PATTERN.test(hostCandidate)
    ? hostCandidate
    : 'localhost:3000';

  return `${protocol}://${host}`;
}

function isSecureOrigin(origin) {
  return origin.startsWith('https://');
}

function parseCookies(header) {
  const source = typeof header === 'string' ? header : '';
  const cookies = {};

  for (const part of source.split(';')) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    const separator = trimmed.indexOf('=');
    if (separator <= 0) continue;

    const name = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim();
    try {
      cookies[name] = decodeURIComponent(value);
    } catch (_) {
      // Ignore malformed cookie values instead of crashing OAuth handlers.
    }
  }

  return cookies;
}

function serializeCookie(name, value, options = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`];

  if (options.maxAge !== undefined) parts.push(`Max-Age=${options.maxAge}`);
  if (options.domain) parts.push(`Domain=${options.domain}`);
  if (options.path) parts.push(`Path=${options.path}`);
  if (options.httpOnly) parts.push('HttpOnly');
  if (options.secure) parts.push('Secure');
  if (options.sameSite) parts.push(`SameSite=${options.sameSite}`);

  return parts.join('; ');
}

function appendCookies(res, cookies) {
  const current = res.getHeader('Set-Cookie');
  const normalized = Array.isArray(current)
    ? current.slice()
    : current
      ? [current]
      : [];
  res.setHeader('Set-Cookie', normalized.concat(cookies));
}

function sanitizeReturnTo(value) {
  if (!value) return DEFAULT_RETURN_TO;
  if (value === '/') return DEFAULT_RETURN_TO;

  if (value.startsWith('/#/')) {
    return value;
  }

  if (value.startsWith('#/')) {
    return `/${value}`;
  }

  if (value.startsWith('/')) {
    return `/#${value}`;
  }

  try {
    const parsed = new URL(value);
    if (parsed.hash.startsWith('#/')) {
      return `/${parsed.hash}`;
    }
  } catch (_) {
    // Fall through to default.
  }

  return DEFAULT_RETURN_TO;
}

function buildReturnUrl(origin, returnTo, extraParams = {}) {
  const safeReturn = sanitizeReturnTo(returnTo);
  const fragmentValue = safeReturn.slice(2); // '/#/playlists' -> '/playlists'
  const fragmentUrl = new URL(
    fragmentValue.startsWith('/') ? fragmentValue : `/${fragmentValue}`,
    'https://replayglows.local',
  );

  const params = new URLSearchParams(fragmentUrl.search);
  params.delete('youtube_connected');
  params.delete('youtube_error');

  for (const [key, value] of Object.entries(extraParams)) {
    if (value === undefined || value === null || value === '') {
      params.delete(key);
    } else {
      params.set(key, String(value));
    }
  }

  const url = new URL(origin);
  const query = params.toString();
  url.hash = `${fragmentUrl.pathname}${query ? `?${query}` : ''}`;
  return url.toString();
}

function sendRedirect(res, location, cookies = []) {
  if (cookies.length > 0) {
    appendCookies(res, cookies);
  }
  res.statusCode = 302;
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Location', location);
  res.end();
}

function getBearerTokenFromAuthHeader(authHeader) {
  const header = typeof authHeader === 'string' ? authHeader.trim() : '';
  if (!header.startsWith('Bearer ')) return '';
  return header.slice('Bearer '.length).trim();
}

function decodeJwtPayload(jwt) {
  try {
    const [, payload] = String(jwt || '').split('.');
    if (!payload) return {};
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(
      normalized.length + ((4 - (normalized.length % 4)) % 4),
      '=',
    );
    return JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
  } catch (_) {
    return {};
  }
}

function base64UrlEncode(value) {
  return Buffer.from(value)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64UrlDecode(value) {
  const normalized = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(
    normalized.length + ((4 - (normalized.length % 4)) % 4),
    '=',
  );
  return Buffer.from(padded, 'base64');
}

function resolveOAuthTicketSecret() {
  return getEnv(
    'REPLAYGLOWS_YOUTUBE_OAUTH_TICKET_SECRET',
    'SUITE_ENTITLEMENT_VERIFY_SECRET',
    'YOUTUBE_OAUTH_CLIENT_SECRET',
  );
}

function deriveOAuthTicketKey(secret) {
  return require('node:crypto').createHash('sha256').update(secret).digest();
}

function createOAuthTicket(payload, secret, now = Date.now()) {
  if (!secret) {
    throw new Error('ReplayGlows YouTube OAuth ticket secret is not configured.');
  }

  const crypto = require('node:crypto');
  const iv = crypto.randomBytes(12);
  const key = deriveOAuthTicketKey(secret);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const body = Buffer.from(
    JSON.stringify({
      ...payload,
      v: OAUTH_TICKET_VERSION,
      exp: now + OAUTH_TICKET_TTL_MS,
    }),
    'utf8',
  );
  const encrypted = Buffer.concat([cipher.update(body), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    String(OAUTH_TICKET_VERSION),
    base64UrlEncode(iv),
    base64UrlEncode(tag),
    base64UrlEncode(encrypted),
  ].join('.');
}

function openOAuthTicket(ticket, secret, now = Date.now()) {
  if (!ticket || !secret) {
    return null;
  }

  const [version, ivRaw, tagRaw, encryptedRaw] = String(ticket).split('.');
  if (version !== String(OAUTH_TICKET_VERSION) || !ivRaw || !tagRaw || !encryptedRaw) {
    return null;
  }

  try {
    const crypto = require('node:crypto');
    const key = deriveOAuthTicketKey(secret);
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      key,
      base64UrlDecode(ivRaw),
    );
    decipher.setAuthTag(base64UrlDecode(tagRaw));
    const decrypted = Buffer.concat([
      decipher.update(base64UrlDecode(encryptedRaw)),
      decipher.final(),
    ]);
    const payload = JSON.parse(decrypted.toString('utf8'));
    if (
      !payload ||
      payload.v !== OAUTH_TICKET_VERSION ||
      typeof payload.exp !== 'number' ||
      payload.exp < now
    ) {
      return null;
    }
    return payload;
  } catch (_) {
    return null;
  }
}

function parseLegacyProductIds(raw) {
  if (!raw || !raw.trim()) return DEFAULT_LEGACY_PRODUCT_IDS;
  const ids = raw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  return ids.length > 0 ? ids : DEFAULT_LEGACY_PRODUCT_IDS;
}

function resolveEntitlementInputs() {
  return {
    productId: getEnv('REPLAYGLOWS_PRODUCT_ID') || DEFAULT_PRODUCT_ID,
    legacyProductIds: parseLegacyProductIds(
      getEnv('REPLAYGLOWS_LEGACY_PRODUCT_IDS'),
    ),
    verifyUrl: getEnv('SUITE_ENTITLEMENT_VERIFY_URL'),
    verifySecret: getEnv('SUITE_ENTITLEMENT_VERIFY_SECRET'),
  };
}

function resolveEntitlementResult(payload, productId, legacyProductIds) {
  if (!payload || typeof payload !== 'object') {
    return { hasAccess: false, reasonCode: 'invalid_entitlement_payload' };
  }

  if (payload.hasAccess === true) {
    return {
      hasAccess: true,
      matchedProductId:
        typeof payload.matchedProductId === 'string'
          ? payload.matchedProductId
          : productId,
      globalUserId:
        typeof payload.globalUserId === 'string' ? payload.globalUserId : '',
    };
  }

  const entitlements = Array.isArray(payload.entitlements) ? payload.entitlements : [];
  const accepted = new Set([productId, ...legacyProductIds]);
  const hasAccess = entitlements.some((entitlement) => {
    if (!entitlement || typeof entitlement !== 'object') return false;
    const entitlementProductId = entitlement.productId;
    const status = entitlement.status;
    return (
      typeof entitlementProductId === 'string' &&
      accepted.has(entitlementProductId) &&
      (status === 'active' || status === 'trialing')
    );
  });

  return {
    hasAccess,
    matchedProductId: hasAccess ? productId : undefined,
    globalUserId:
      typeof payload.globalUserId === 'string' ? payload.globalUserId : '',
    reasonCode:
      typeof payload.reasonCode === 'string'
        ? payload.reasonCode
        : hasAccess
          ? undefined
          : 'missing_product_entitlement',
  };
}

async function verifySuiteSessionAndEntitlement({
  sessionToken,
  verifyUrl,
  verifySecret,
  productId,
  legacyProductIds,
  requestId,
}) {
  if (!verifyUrl) {
    return { ok: false, status: 503, error: 'suite_verify_url_not_configured' };
  }
  if (!verifySecret) {
    return {
      ok: false,
      status: 503,
      error: 'suite_verify_secret_not_configured',
    };
  }
  if (!sessionToken) {
    return { ok: false, status: 401, error: 'missing_suite_session_token' };
  }

  let response;
  try {
    response = await fetch(verifyUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${sessionToken}`,
        'Content-Type': 'application/json',
        'x-suite-entitlement-secret': verifySecret,
        ...(requestId ? { 'X-Request-ID': requestId } : {}),
      },
      body: JSON.stringify({
        productId,
        legacyProductIds,
      }),
    });
  } catch (_) {
    return { ok: false, status: 503, error: 'suite_verify_network_error' };
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch (_) {
    payload = null;
  }

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      error:
        typeof payload?.error === 'string'
          ? payload.error
          : 'suite_verify_failed',
    };
  }

  const entitlement = resolveEntitlementResult(
    payload,
    productId,
    legacyProductIds,
  );
  if (!entitlement.hasAccess) {
    return {
      ok: false,
      status: 403,
      error: entitlement.reasonCode || 'product_access_inactive',
      globalUserId: entitlement.globalUserId,
    };
  }

  return {
    ok: true,
    status: 200,
    globalUserId: entitlement.globalUserId,
    matchedProductId: entitlement.matchedProductId || productId,
  };
}

async function runConvexHttpOperation({ convexUrl, sessionToken, type, path, args }) {
  const endpoint = type === 'mutation' ? 'mutation' : 'query';
  const response = await fetch(`${convexUrl.replace(/\/+$/, '')}/api/${endpoint}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${sessionToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      path,
      args,
      format: 'json',
    }),
  });

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      error: `convex_${endpoint}_http_failed`,
    };
  }

  let payload;
  try {
    payload = await response.json();
  } catch (_) {
    return { ok: false, status: 502, error: `convex_${endpoint}_invalid_json` };
  }

  if (payload?.status === 'error') {
    return {
      ok: false,
      status: 502,
      error: `convex_${endpoint}_operation_failed`,
    };
  }

  return { ok: true, value: payload?.value };
}

async function verifyReplayGlowsSessionAndAccess({
  sessionToken,
  convexUrl,
  productId,
  legacyProductIds,
}) {
  if (!convexUrl) {
    return { ok: false, status: 503, error: 'convex_url_not_configured' };
  }
  if (!sessionToken) {
    return { ok: false, status: 401, error: 'missing_session_token' };
  }

  const claims = decodeJwtPayload(sessionToken);
  const emailAddress =
    claims.email ||
    claims.email_address ||
    claims?.primaryEmailAddress?.emailAddress;

  if (typeof emailAddress === 'string' && emailAddress.trim()) {
    const ensured = await runConvexHttpOperation({
      convexUrl,
      sessionToken,
      type: 'mutation',
      path: 'users:ensureUser',
      args: {
        email: emailAddress.trim(),
        name: typeof claims.name === 'string' ? claims.name : undefined,
        avatarUrl: typeof claims.picture === 'string' ? claims.picture : undefined,
      },
    });
    if (!ensured.ok) {
      return { ...ensured, localConvexVerified: true };
    }
  }

  const access = await runConvexHttpOperation({
    convexUrl,
    sessionToken,
    type: 'query',
    path: 'users:getProductAccessStatus',
    args: {
      productId,
      legacyProductIds,
    },
  });
  if (!access.ok) {
    return { ...access, localConvexVerified: true };
  }

  const status =
    access.value && typeof access.value === 'object' ? access.value : {};
  if (status.hasAccess !== true) {
    return {
      ok: false,
      status: 403,
      error:
        typeof status.reasonCode === 'string'
          ? status.reasonCode
          : 'product_access_inactive',
      globalUserId:
        typeof status.globalUserId === 'string' ? status.globalUserId : '',
      localConvexVerified: true,
    };
  }

  return {
    ok: true,
    status: 200,
    globalUserId: typeof status.globalUserId === 'string' ? status.globalUserId : '',
    matchedProductId:
      typeof status.matchedProductId === 'string'
        ? status.matchedProductId
        : productId,
    localConvexVerified: true,
  };
}

async function verifyReplayGlowsSessionAccessWithFallback({
  sessionToken,
  convexUrl,
  verifyUrl,
  verifySecret,
  productId,
  legacyProductIds,
  requestId,
}) {
  if (convexUrl) {
    const productVerification = await verifyReplayGlowsSessionAndAccess({
      sessionToken,
      convexUrl,
      productId,
      legacyProductIds,
    });
    if (productVerification.ok || productVerification.status !== 503) {
      return productVerification;
    }
  }

  return verifySuiteSessionAndEntitlement({
    sessionToken,
    verifyUrl,
    verifySecret,
    productId,
    legacyProductIds,
    requestId,
  });
}

module.exports = {
  DEFAULT_PRODUCT_ID,
  DEFAULT_LEGACY_PRODUCT_IDS,
  YOUTUBE_SCOPE,
  getEnv,
  getRequestOrigin,
  isSecureOrigin,
  getBearerTokenFromAuthHeader,
  decodeJwtPayload,
  parseLegacyProductIds,
  resolveEntitlementInputs,
  verifyReplayGlowsSessionAndAccess,
  verifyReplayGlowsSessionAccessWithFallback,
  verifySuiteSessionAndEntitlement,
  resolveOAuthTicketSecret,
  createOAuthTicket,
  openOAuthTicket,
  parseCookies,
  serializeCookie,
  appendCookies,
  sanitizeReturnTo,
  buildReturnUrl,
  sendRedirect,
};
