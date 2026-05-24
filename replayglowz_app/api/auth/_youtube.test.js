const test = require('node:test');
const assert = require('node:assert/strict');

const {
  sanitizeReturnTo,
  buildReturnUrl,
  parseCookies,
  getRequestOrigin,
  sendRedirect,
  parseLegacyProductIds,
} = require('./_youtube');
const youtubeStartHandler = require('./youtube');
const youtubeCallbackHandler = require('./youtube/callback');

function createMockRes() {
  const headers = new Map();
  return {
    statusCode: 200,
    setHeader(name, value) {
      headers.set(name.toLowerCase(), value);
    },
    getHeader(name) {
      return headers.get(name.toLowerCase());
    },
    body: '',
    endCalled: false,
    end(value = '') {
      this.body = value;
      this.endCalled = true;
    },
  };
}

async function withEnv(nextEnv, fn) {
  const snapshot = {};
  for (const [key, value] of Object.entries(nextEnv)) {
    snapshot[key] = process.env[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  try {
    await fn();
  } finally {
    for (const [key, value] of Object.entries(snapshot)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

test('sanitizeReturnTo falls back to default for missing and root values', () => {
  const inputs = [undefined, null, '', '/'];

  for (const input of inputs) {
    assert.equal(sanitizeReturnTo(input), '/#/playlists');
  }
});

test('sanitizeReturnTo keeps already-sanitized hash routes', () => {
  assert.equal(
    sanitizeReturnTo('/#/playlists?tab=recent'),
    '/#/playlists?tab=recent',
  );
});

test('sanitizeReturnTo normalizes hash-only routes', () => {
  assert.equal(sanitizeReturnTo('#/settings'), '/#/settings');
});

test('sanitizeReturnTo converts root-relative routes to hash routes', () => {
  assert.equal(
    sanitizeReturnTo('/playlists/favorites?sort=new'),
    '/#/playlists/favorites?sort=new',
  );
});

test('sanitizeReturnTo extracts hash routes from absolute URLs', () => {
  assert.equal(
    sanitizeReturnTo('https://example.com/somewhere#/studio?view=compact'),
    '/#/studio?view=compact',
  );
});

test('sanitizeReturnTo rejects non-hash absolute URLs', () => {
  assert.equal(
    sanitizeReturnTo('https://example.com/playlists?tab=recent'),
    '/#/playlists',
  );
});

test('sanitizeReturnTo keeps potentially hostile double-slash input internal', () => {
  const value = sanitizeReturnTo('//evil.example.com/path?q=1');
  assert.equal(value, '/#//evil.example.com/path?q=1');
  assert.ok(value.startsWith('/#'));
});

test('buildReturnUrl merges normalized route and extra params', () => {
  const output = buildReturnUrl(
    'https://app.example.com',
    '/#/playlists?tab=recent',
    { youtube_connected: 'true' },
  );

  const url = new URL(output);
  assert.equal(url.origin, 'https://app.example.com');
  assert.equal(url.hash, '#/playlists?tab=recent&youtube_connected=true');
});

test('buildReturnUrl removes stale youtube query parameters', () => {
  const output = buildReturnUrl(
    'https://app.example.com',
    '/#/playlists?youtube_connected=false&youtube_error=denied&keep=1',
  );

  const url = new URL(output);
  assert.equal(url.hash, '#/playlists?keep=1');
});

test('buildReturnUrl allows extra params to delete existing values', () => {
  const output = buildReturnUrl(
    'https://app.example.com',
    '/#/playlists?keep=1&remove_me=1',
    { remove_me: '', keep: 2 },
  );

  const url = new URL(output);
  assert.equal(url.hash, '#/playlists?keep=2');
});

test('buildReturnUrl falls back to default route for invalid return_to', () => {
  const output = buildReturnUrl('https://app.example.com', 'not-a-route', {
    youtube_error: 'state_mismatch',
  });

  const url = new URL(output);
  assert.equal(url.hash, '#/playlists?youtube_error=state_mismatch');
});

test('buildReturnUrl accepts hash-only return_to values via sanitization', () => {
  const output = buildReturnUrl('https://app.example.com', '#/studio');
  const url = new URL(output);
  assert.equal(url.hash, '#/studio');
});

test('parseCookies ignores malformed percent-encoding instead of throwing', () => {
  const cookies = parseCookies('ok=one; bad=%E0%A4%A; keep=two');
  assert.deepEqual(cookies, { ok: 'one', keep: 'two' });
});

test('parseLegacyProductIds falls back to tubeflow when missing', () => {
  assert.deepEqual(parseLegacyProductIds(''), ['tubeflow']);
  assert.deepEqual(parseLegacyProductIds('   '), ['tubeflow']);
});

test('getRequestOrigin normalizes forwarded host/proto lists', () => {
  const origin = getRequestOrigin({
    headers: {
      'x-forwarded-proto': 'https,http',
      'x-forwarded-host': 'app.example.com, proxy.internal',
      host: 'fallback.example.com',
    },
  });
  assert.equal(origin, 'https://app.example.com');
});

test('sendRedirect sets no-store cache headers', () => {
  const headers = new Map();
  const res = {
    statusCode: 200,
    setHeader(name, value) {
      headers.set(name.toLowerCase(), value);
    },
    getHeader(name) {
      return headers.get(name.toLowerCase());
    },
    endCalled: false,
    end() {
      this.endCalled = true;
    },
  };

  sendRedirect(res, 'https://app.example.com/#/playlists');

  assert.equal(res.statusCode, 302);
  assert.equal(headers.get('cache-control'), 'no-store');
  assert.equal(headers.get('pragma'), 'no-cache');
  assert.equal(headers.get('location'), 'https://app.example.com/#/playlists');
  assert.equal(res.endCalled, true);
});

test(
  'youtube start denies when suite entitlement is inactive',
  { concurrency: false },
  async () => {
  await withEnv(
    {
      GOOGLE_CLIENT_ID: 'client-id',
      SUITE_ENTITLEMENT_VERIFY_URL: 'https://suite.example.com/verify',
      SUITE_ENTITLEMENT_VERIFY_SECRET: 'secret',
      REPLAYGLOWZ_PRODUCT_ID: 'replayglowz',
      REPLAYGLOWZ_LEGACY_PRODUCT_IDS: 'tubeflow',
      REPLAYGLOWZ_APP_URL: 'https://app.example.com',
    },
    async () => {
      global.fetch = async () => {
        return {
          ok: true,
          status: 200,
          async json() {
            return { hasAccess: false, reasonCode: 'missing_product_entitlement' };
          },
        };
      };

      const req = {
        method: 'GET',
        url: '/api/auth/youtube?return_to=%2F%23%2Fplaylists',
        headers: {
          authorization: 'Bearer suite-session-token',
          host: 'app.example.com',
          'x-forwarded-proto': 'https',
          'x-forwarded-host': 'app.example.com',
        },
      };
      const res = createMockRes();

      await youtubeStartHandler(req, res);

      assert.equal(res.statusCode, 403);
      const payload = JSON.parse(res.body);
      assert.equal(payload.error, 'Product access inactive for this account.');
    },
  );
  },
);

test(
  'youtube start sets suite cookies when entitlement is active',
  { concurrency: false },
  async () => {
  await withEnv(
    {
      GOOGLE_CLIENT_ID: 'client-id',
      SUITE_ENTITLEMENT_VERIFY_URL: 'https://suite.example.com/verify',
      SUITE_ENTITLEMENT_VERIFY_SECRET: 'secret',
      REPLAYGLOWZ_PRODUCT_ID: 'replayglowz',
      REPLAYGLOWZ_LEGACY_PRODUCT_IDS: 'tubeflow',
      REPLAYGLOWZ_APP_URL: 'https://app.example.com',
    },
    async () => {
      const calls = [];
      global.fetch = async (url, options = {}) => {
        calls.push({ url: String(url), options });
        return {
          ok: true,
          status: 200,
          async json() {
            return {
              hasAccess: true,
              globalUserId: 'gu_123',
              matchedProductId: 'replayglowz',
            };
          },
        };
      };

      const req = {
        method: 'GET',
        url: '/api/auth/youtube?return_to=%2F%23%2Fplaylists',
        headers: {
          authorization: 'Bearer suite-session-token',
          host: 'app.example.com',
          'x-forwarded-proto': 'https',
          'x-forwarded-host': 'app.example.com',
        },
      };
      const res = createMockRes();

      await youtubeStartHandler(req, res);

      assert.equal(res.statusCode, 200);
      const suiteCall = calls[0];
      assert.equal(suiteCall.options.method, 'POST');
      assert.equal(
        suiteCall.options.headers.Authorization,
        'Bearer suite-session-token',
      );
      assert.equal(
        suiteCall.options.headers['x-suite-entitlement-secret'],
        'secret',
      );
      assert.equal(
        suiteCall.options.headers['X-Suite-Verify-Secret'],
        undefined,
      );
      const payload = JSON.parse(res.body);
      assert.ok(payload.authUrl.includes('accounts.google.com'));
      const setCookie = res.getHeader('set-cookie');
      assert.ok(Array.isArray(setCookie));
      assert.ok(
        setCookie.some((value) =>
          value.includes('replayglowz_youtube_suite_session_token='),
        ),
      );
      assert.ok(
        setCookie.some((value) =>
          value.includes('replayglowz_youtube_global_user_id=gu_123'),
        ),
      );
    },
  );
  },
);

test(
  'youtube callback fails closed when suite token cookie is missing',
  { concurrency: false },
  async () => {
  await withEnv(
    {
      GOOGLE_CLIENT_ID: 'client-id',
      GOOGLE_CLIENT_SECRET: 'client-secret',
      CONVEX_URL: 'https://product.convex.cloud',
      SUITE_ENTITLEMENT_VERIFY_URL: 'https://suite.example.com/verify',
      SUITE_ENTITLEMENT_VERIFY_SECRET: 'secret',
      REPLAYGLOWZ_APP_URL: 'https://app.example.com',
    },
    async () => {
      global.fetch = async () => {
        throw new Error('fetch should not be called in missing-token branch');
      };

      const req = {
        method: 'GET',
        url: '/api/auth/youtube/callback?code=abc&state=s1',
        headers: {
          cookie: 'youtube_oauth_state=s1; youtube_oauth_return_to=%2F%23%2Fplaylists',
          host: 'app.example.com',
          'x-forwarded-proto': 'https',
          'x-forwarded-host': 'app.example.com',
        },
      };
      const res = createMockRes();

      await youtubeCallbackHandler(req, res);
      assert.equal(res.statusCode, 302);
      const location = res.getHeader('location');
      assert.ok(location.includes('youtube_error='));
      assert.ok(location.includes('suite'));
    },
  );
  },
);

test(
  'youtube callback success persists tokens with suite auth',
  { concurrency: false },
  async () => {
  await withEnv(
    {
      GOOGLE_CLIENT_ID: 'client-id',
      GOOGLE_CLIENT_SECRET: 'client-secret',
      CONVEX_URL: 'https://product.convex.cloud',
      SUITE_ENTITLEMENT_VERIFY_URL: 'https://suite.example.com/verify',
      SUITE_ENTITLEMENT_VERIFY_SECRET: 'secret',
      REPLAYGLOWZ_PRODUCT_ID: 'replayglowz',
      REPLAYGLOWZ_LEGACY_PRODUCT_IDS: 'tubeflow',
      REPLAYGLOWZ_APP_URL: 'https://app.example.com',
    },
    async () => {
      const calls = [];
      global.fetch = async (url, options = {}) => {
        calls.push({ url: String(url), options });
        if (String(url) === 'https://suite.example.com/verify') {
          return {
            ok: true,
            status: 200,
            async json() {
              return { hasAccess: true, globalUserId: 'gu_123' };
            },
          };
        }
        if (String(url) === 'https://oauth2.googleapis.com/token') {
          return {
            ok: true,
            async json() {
              return {
                access_token: 'yt-access',
                refresh_token: 'yt-refresh',
                expires_in: 3600,
              };
            },
          };
        }
        if (String(url) === 'https://product.convex.cloud/api/mutation') {
          return {
            ok: true,
            async json() {
              return { status: 'success' };
            },
          };
        }
        throw new Error(`Unexpected URL ${url}`);
      };

      const payload = Buffer.from(
        JSON.stringify({ email: 'user@example.com', name: 'Test User' }),
      )
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
      const suiteToken = `x.${payload}.y`;

      const req = {
        method: 'GET',
        url: '/api/auth/youtube/callback?code=abc&state=s1',
        headers: {
          cookie:
            'youtube_oauth_state=s1; youtube_oauth_return_to=%2F%23%2Fplaylists;' +
            ` replayglowz_youtube_suite_session_token=${encodeURIComponent(suiteToken)}`,
          host: 'app.example.com',
          'x-forwarded-proto': 'https',
          'x-forwarded-host': 'app.example.com',
        },
      };
      const res = createMockRes();

      await youtubeCallbackHandler(req, res);
      assert.equal(res.statusCode, 302);
      const location = res.getHeader('location');
      assert.ok(location.includes('youtube_connected=true'));
      assert.equal(
        calls.filter((call) => call.url === 'https://product.convex.cloud/api/mutation')
          .length,
        2,
      );
      const setCookie = res.getHeader('set-cookie');
      assert.ok(
        setCookie.some((value) =>
          value.includes('replayglowz_youtube_suite_session_token='),
        ),
      );
    },
  );
  },
);
