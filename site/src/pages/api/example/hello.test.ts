import { test } from 'node:test';
import assert from 'node:assert';

// Import the route handler
import { GET } from './hello.ts';

// Helper to call the handler and read the response text
const callHandler = async () => {
  const resp = await GET();
  const text = await resp.text();
  return { status: resp.status, text };
};

test('hello endpoint returns greeting', async () => {
  const { status, text } = await callHandler();
  assert.strictEqual(status, 200);
  assert.ok(text.includes('Hello from ReplayGlows'));
});
