const crypto = require('node:crypto');

const {
  YOUTUBE_SCOPE,
  getRequestOrigin,
  isSecureOrigin,
  getBearerTokenFromAuthHeader,
  getEnv,
  resolveEntitlementInputs,
  verifySuiteSessionAndEntitlement,
  serializeCookie,
  sanitizeReturnTo,
} = require('./_youtube');

const REPLAYGLOWZ_SUITE_SESSION_TOKEN_COOKIE =
  'replayglowz_youtube_suite_session_token';
const REPLAYGLOWZ_OAUTH_GLOBAL_USER_COOKIE =
  'replayglowz_youtube_global_user_id';

function sendJsonError(res, statusCode, message) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify({ error: message }));
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.statusCode = 405;
    res.setHeader('Allow', 'GET');
    res.end('Method Not Allowed');
    return;
  }

  const origin = getRequestOrigin(req);
  const secure = isSecureOrigin(origin);
  const requestUrl = new URL(req.url, origin);
  const returnTo = sanitizeReturnTo(requestUrl.searchParams.get('return_to'));
  const sessionToken = getBearerTokenFromAuthHeader(req.headers.authorization);
  const requestId = req.headers['x-request-id'];
  const googleClientId = getEnv('GOOGLE_CLIENT_ID');
  const { productId, legacyProductIds, verifySecret, verifyUrl } =
    resolveEntitlementInputs();

  if (!googleClientId) {
    sendJsonError(
      res,
      500,
      'Google OAuth is not configured on this deployment.',
    );
    return;
  }

  if (!sessionToken) {
    sendJsonError(res, 401, 'Missing suite session token.');
    return;
  }

  const verification = await verifySuiteSessionAndEntitlement({
    sessionToken,
    verifyUrl,
    verifySecret,
    productId,
    legacyProductIds,
    requestId: Array.isArray(requestId) ? requestId[0] : requestId,
  });
  if (!verification.ok) {
    sendJsonError(
      res,
      verification.status,
      verification.status === 403
        ? 'Product access inactive for this account.'
        : 'Suite session verification failed.',
    );
    return;
  }

  const state = crypto.randomUUID();
  const redirectUri = new URL('/api/auth/youtube/callback', origin).toString();
  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');

  authUrl.searchParams.set('client_id', googleClientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', YOUTUBE_SCOPE);
  authUrl.searchParams.set('access_type', 'offline');
  authUrl.searchParams.set('prompt', 'consent');
  authUrl.searchParams.set('include_granted_scopes', 'true');
  authUrl.searchParams.set('state', state);

  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Set-Cookie', [
    serializeCookie('youtube_oauth_state', state, {
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
      secure,
      maxAge: 600,
    }),
    serializeCookie('youtube_oauth_return_to', returnTo, {
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
      secure,
      maxAge: 600,
    }),
    serializeCookie(REPLAYGLOWZ_SUITE_SESSION_TOKEN_COOKIE, sessionToken, {
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
      secure,
      maxAge: 900,
    }),
    serializeCookie(
      REPLAYGLOWZ_OAUTH_GLOBAL_USER_COOKIE,
      verification.globalUserId || '',
      {
        path: '/',
        httpOnly: true,
        sameSite: 'Lax',
        secure,
        maxAge: 900,
      },
    ),
    serializeCookie('replayglowz_oauth_product_id', verification.matchedProductId, {
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
      secure,
      maxAge: 900,
    }),
  ]);
  res.end(JSON.stringify({ authUrl: authUrl.toString() }));
};
