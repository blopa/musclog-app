import { describe, expect, it } from 'vitest';

import { parseJsonUsage, parseTail, TailBuffer, TAIL_BYTES } from '../src/proxy/sse';
import { sseChunks } from './fakes/openrouter';

describe('parseTail', () => {
  it('reads the last usage chunk before [DONE]', () => {
    const t = parseTail(sseChunks({ cost: 0.00123 }).join(''));
    expect(t.costUsd).toBe(0.00123);
    expect(t.promptTokens).toBe(100);
    expect(t.completionTokens).toBe(50);
    expect(t.error).toBe(false);
  });

  it('ignores SSE comment lines and finds nothing without usage', () => {
    const t = parseTail(': OPENROUTER PROCESSING\n\n: keepalive\n\n');
    expect(t).toEqual({ costUsd: null, promptTokens: null, completionTokens: null, error: false });
    expect(parseTail(sseChunks({}).join('')).costUsd).toBeNull();
  });

  it('flags an error chunk, with or without usage', () => {
    expect(parseTail(sseChunks({ errorChunk: true }).join('')).error).toBe(true);
    const withUsage = parseTail(sseChunks({ errorChunk: true, cost: 0.5 }).join(''));
    expect(withUsage.error).toBe(true);
    expect(withUsage.costUsd).toBe(0.5);
    const fin = 'data: {"choices":[{"finish_reason":"error"}]}\n\n';
    expect(parseTail(fin).error).toBe(true);
  });

  it('never throws on malformed JSON or a cut first line', () => {
    expect(
      parseTail('data: {"usage":{"cost":\n\ndata: not json\n\ndata: [DONE]\n').costUsd
    ).toBeNull();
    expect(parseTail('lf":"x"}}]}\n\ndata: {"usage":{"cost":0.1}}\n\n').costUsd).toBe(0.1);
    expect(parseTail('').costUsd).toBeNull();
  });

  it('takes the last of several usage objects and skips non-numeric cost', () => {
    const t = parseTail(
      'data: {"usage":{"cost":0.1}}\n\ndata: {"usage":{"cost":"x"}}\n\ndata: {"usage":{"cost":0.3}}\n\n'
    );
    expect(t.costUsd).toBe(0.3);
  });
});

describe('TailBuffer', () => {
  const enc = new TextEncoder();

  it('keeps only the last 2 KB across many chunks and still finds the usage', () => {
    const tb = new TailBuffer();
    for (let i = 0; i < 2000; i++)
      tb.push(enc.encode(`data: {"id":"gen-9","choices":[{"delta":{"content":"tok${i} "}}]}\n\n`));
    tb.push(
      enc.encode(
        'data: {"choices":[],"usage":{"prompt_tokens":1,"completion_tokens":2,"cost":0.5}}\n\ndata: [DONE]\n\n'
      )
    );
    expect(enc.encode(tb.text()).length).toBeLessThanOrEqual(TAIL_BYTES + 4);
    expect(parseTail(tb.text()).costUsd).toBe(0.5);
    expect(tb.generationId()).toBe('gen-9');
  });

  it('handles a chunk larger than the tail', () => {
    const tb = new TailBuffer();
    tb.push(enc.encode('x'.repeat(10_000) + '\ndata: {"usage":{"cost":0.2}}\n'));
    expect(parseTail(tb.text()).costUsd).toBe(0.2);
  });
});

describe('parseJsonUsage', () => {
  it('reads usage and id, tolerates junk', () => {
    const u = parseJsonUsage(
      JSON.stringify({ id: 'gen-1', usage: { prompt_tokens: 3, completion_tokens: 4, cost: 0.01 } })
    );
    expect(u).toMatchObject({ costUsd: 0.01, promptTokens: 3, completionTokens: 4, id: 'gen-1' });
    expect(parseJsonUsage('{"id":"g"}').costUsd).toBeNull();
    expect(parseJsonUsage('not json').costUsd).toBeNull();
    expect(parseJsonUsage('[1]').id).toBeNull();
  });
});
