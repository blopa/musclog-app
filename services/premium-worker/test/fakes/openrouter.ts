// Scripted OpenRouterClient for tests. No network. Every chatCompletions body is recorded
// (parsed) together with its AbortSignal, so tests can assert on what would have been sent.
//   const or = fakeOpenRouter(jsonCompletion(0.0012));
//   or.calls[0].body            // parsed upstream body
//   or.generations.push({ total_cost: 0.002 })   // queue for getGeneration (null when empty)
import type { OpenRouterClient, OpenRouterKeyInfo, ZdrEndpoint } from '../../src/upstream/types';

export type Script =
  | { kind: 'json'; body: unknown; headers?: Record<string, string> }
  | {
      kind: 'sse';
      /** Strings are encoded as is; each is one chunk. */
      chunks: string[];
      /** After the chunks: close, error the stream, or stall until the signal aborts. */
      then?: 'close' | 'error' | 'stall';
      headers?: Record<string, string>;
    }
  | { kind: 'http'; status: number }
  | { kind: 'hang' }
  | { kind: 'throw' };

export interface Recorded {
  body: Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  text: string;
  signal: AbortSignal;
}

/** Every recording of every fake in the test file; the privacy invariant is asserted over it. */
export const allRecorded: Recorded[] = [];

export type ScriptSource =
  Script | ((i: number, body: Recorded['body']) => Script | Promise<Script>);

export interface FakeOpenRouter extends OpenRouterClient {
  calls: Recorded[];
  /** Results of successive getGeneration calls: a cost, null (not yet available) or an Error. */
  generations: ({ total_cost: number } | null | Error)[];
  generationCalls: string[];
}

const te = new TextEncoder();

export function fakeOpenRouter(script: ScriptSource): FakeOpenRouter {
  const calls: Recorded[] = [];
  const fake: FakeOpenRouter = {
    calls,
    generations: [],
    generationCalls: [],
    async chatCompletions(text, init) {
      const rec: Recorded = { body: JSON.parse(text), text, signal: init.signal };
      calls.push(rec);
      allRecorded.push(rec);
      const s = typeof script === 'function' ? await script(calls.length - 1, rec.body) : script;
      return respond(s, init.signal);
    },
    async getGeneration(id) {
      fake.generationCalls.push(id);
      const next = fake.generations.shift();
      if (next instanceof Error) throw next;
      return next ?? null;
    },
    async getKey(): Promise<OpenRouterKeyInfo> {
      throw new Error('unexpected getKey');
    },
    async listZdrEndpoints(): Promise<ZdrEndpoint[]> {
      throw new Error('unexpected listZdrEndpoints');
    },
  };
  return fake;
}

function abortError(): Error {
  const e = new Error('aborted');
  e.name = 'AbortError';
  return e;
}

function respond(s: Script, signal: AbortSignal): Promise<Response> | Response {
  switch (s.kind) {
    case 'json':
      return new Response(JSON.stringify(s.body), {
        status: 200,
        headers: { 'content-type': 'application/json', ...s.headers },
      });
    case 'http':
      return new Response(JSON.stringify({ error: { message: 'SECRET_UPSTREAM_BODY' } }), {
        status: s.status,
        headers: { 'content-type': 'application/json' },
      });
    case 'throw':
      throw new TypeError('network down');
    case 'hang':
      return new Promise((_, reject) => {
        if (signal.aborted) reject(abortError());
        signal.addEventListener('abort', () => reject(abortError()));
      });
    case 'sse': {
      let i = 0;
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          signal.addEventListener('abort', () => {
            try {
              controller.error(abortError());
            } catch {
              /* already closed */
            }
          });
        },
        pull(controller) {
          if (i < s.chunks.length) {
            controller.enqueue(te.encode(s.chunks[i++]!));
            return;
          }
          const then = s.then ?? 'close';
          if (then === 'close') controller.close();
          else if (then === 'error') controller.error(new Error('connection reset'));
          else return new Promise(() => {}); // stall until abort errors the stream
        },
      });
      return new Response(stream, {
        status: 200,
        headers: { 'content-type': 'text/event-stream', ...s.headers },
      });
    }
  }
}

// ---------- builders ----------

export const usageObject = (cost: number, prompt = 100, completion = 50) => ({
  prompt_tokens: prompt,
  completion_tokens: completion,
  total_tokens: prompt + completion,
  cost,
});

export function jsonCompletion(cost: number | null, content = 'hello', id = 'gen-json-1'): Script {
  return {
    kind: 'json',
    headers: { 'x-generation-id': id },
    body: {
      id,
      choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }],
      ...(cost === null ? {} : { usage: usageObject(cost) }),
    },
  };
}

const data = (o: unknown) => `data: ${JSON.stringify(o)}\n\n`;

/** SSE chunks: processing comment, content deltas, optional usage chunk, [DONE]. */
export function sseChunks(
  o: {
    pieces?: string[];
    cost?: number | null;
    id?: string;
    errorChunk?: boolean;
    done?: boolean;
  } = {}
): string[] {
  const id = o.id ?? 'gen-sse-1';
  const out = [': OPENROUTER PROCESSING\n\n'];
  for (const p of o.pieces ?? ['Hel', 'lo']) {
    out.push(data({ id, choices: [{ index: 0, delta: { content: p } }] }));
  }
  if (o.errorChunk)
    out.push(
      data({
        id,
        error: { code: 'server_error', message: 'provider disconnected' },
        choices: [{ index: 0, delta: { content: '' }, finish_reason: 'error' }],
        ...(o.cost != null ? { usage: usageObject(o.cost) } : {}),
      })
    );
  else out.push(data({ id, choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] }));
  if (o.cost != null && !o.errorChunk)
    out.push(data({ id, choices: [], usage: usageObject(o.cost) }));
  out.push(': OPENROUTER PROCESSING\n\n');
  if (o.done !== false) out.push('data: [DONE]\n\n');
  return out;
}

export const sseCompletion = (
  cost: number | null,
  opts: Parameters<typeof sseChunks>[0] = {}
): Script => ({
  kind: 'sse',
  chunks: sseChunks({ ...opts, cost }),
});
