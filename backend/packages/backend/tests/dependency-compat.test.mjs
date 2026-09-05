import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { Readable } from 'node:stream';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';

// Resolve the consumers from Firebase's optional Storage tree, not a test-only uuid.
const require = createRequire(import.meta.url);
const storageRequire = createRequire(require.resolve('@google-cloud/storage'));
const gaxiosPath = storageRequire.resolve('gaxios');
const retryRequire = createRequire(storageRequire.resolve('retry-request'));
const teenyPath = retryRequire.resolve('teeny-request');

test('Storage HTTP clients load patched CommonJS uuid and enforce buffer bounds', () => {
  for (const consumer of [gaxiosPath, teenyPath]) {
    const consumerRequire = createRequire(consumer);
    const uuid = consumerRequire('uuid');
    assert.equal(consumerRequire('uuid/package.json').version, '11.1.1');
    assert.equal(uuid.version(uuid.v4()), 4);
    assert.throws(() => uuid.v5('local-test', uuid.v5.DNS, Buffer.alloc(16), 1), RangeError);
  }
});

test('Storage clients transmit multipart boundaries with the patched uuid', { timeout: 15000 }, async t => {
  const received = [];
  const server = createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    received.push({ type: req.headers['content-type'], body: Buffer.concat(chunks).toString() });
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end('{"ok":true}');
  });
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const url = `http://127.0.0.1:${server.address().port}/upload`;
  const { Gaxios } = require(gaxiosPath);
  const response = await new Gaxios().request({
    url, method: 'POST', noProxy: ['127.0.0.1'],
    multipart: [{ headers: { 'Content-Type': 'text/plain' }, content: 'gaxios-payload' }],
  });
  assert.equal(response.status, 200);
  const { teenyRequest } = require(teenyPath);
  await new Promise((resolve, reject) => teenyRequest({
    uri: url, method: 'POST', headers: {},
    multipart: [
      { 'Content-Type': 'application/json', body: '{"local":true}' },
      { 'Content-Type': 'text/plain', body: Readable.from(['teeny-payload']) },
    ],
  }, (error, result) => {
    if (error) return reject(error);
    try { assert.equal(result.statusCode, 200); resolve(); } catch (failure) { reject(failure); }
  }));
  assert.equal(received.length, 2);
  for (const [index, request] of received.entries()) {
    const boundary = request.type.split('boundary=')[1];
    assert.match(boundary, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    assert.ok(request.body.includes(`--${boundary}`));
    assert.ok(request.body.includes(index === 0 ? 'gaxios-payload' : 'teeny-payload'));
  }
});

test('Firebase messaging initializes without a live credential or send', async () => {
  const app = initializeApp({ projectId: 'local-dependency-test' }, 'dependency-compat');
  try { assert.equal(typeof getMessaging(app).sendEach, 'function'); }
  finally { await deleteApp(app); }
});
