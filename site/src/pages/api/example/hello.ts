import type { APIRoute } from 'astro';
import { Data, Effect, Option } from 'effect';

// Simple error type for demonstration
class HelloError extends Data.TaggedError('HelloError')<{
  readonly reason: string;
}> {}

// Effect that may fail with HelloError or succeed with a greeting
const helloEffect = Effect.gen(function* () {
  // Simulate a possible failure condition
  const fail = false; // Change to true to test error path
  if (fail) {
    return yield* Effect.fail(new HelloError({ reason: 'Forced failure' }));
  }
  return yield* Effect.succeed('Hello from ReplayGlows!');
});

export const GET: APIRoute = async () => {
  // Run the effect, catching HelloError to return a 500 response
  const result = await Effect.runPromise(
    helloEffect,
    Effect.catchTag('HelloError', (e) => Effect.succeed(`Error: ${e.reason}`))
  );
  const body = typeof result === 'string' && result.startsWith('Error')
    ? result
    : result;
  const status = typeof result === 'string' && result.startsWith('Error') ? 500 : 200;
  return new Response(body, { status, headers: { 'content-type': 'text/plain' } });
};
