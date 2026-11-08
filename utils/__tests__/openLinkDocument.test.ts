import { documentParser } from '@/utils/openLinkDocument';
import { buildOpenHttpsUrl } from '@/utils/openLink';

type Result = { ok: true; value: unknown } | { ok: false; error: string };

const parse = documentParser<Result>({
  kind: 'workout',
  maxBytes: 200,
  normalize: (parsed) => ({ ok: true, value: parsed }),
  fail: (error) => ({ ok: false, error }),
});

describe('documentParser', () => {
  it('reads plain JSON text', () => {
    expect(parse('{"a":1}')).toEqual({ ok: true, value: { a: 1 } });
  });

  it('reads JSON wrapped in a code fence', () => {
    expect(parse('```json\n{"a":1}\n```')).toEqual({ ok: true, value: { a: 1 } });
  });

  it('reports an empty or whitespace-only text as empty', () => {
    expect(parse('')).toEqual({ ok: false, error: 'empty' });
    expect(parse('   \n  ')).toEqual({ ok: false, error: 'empty' });
  });

  it('reports text that is not JSON as notJson', () => {
    expect(parse('hello there')).toEqual({ ok: false, error: 'notJson' });
  });

  it('reports a JSON string longer than maxBytes as tooLarge', () => {
    const big = JSON.stringify({ text: 'x'.repeat(300) });

    expect(parse(big)).toEqual({ ok: false, error: 'tooLarge' });
  });

  it('reads an open link of its kind embedded in a sentence', () => {
    const link = buildOpenHttpsUrl({ kind: 'workout', payload: '{"a":1}' });

    expect(parse(`Here is your plan: [Open in Musclog](${link}) thanks`)).toEqual({
      ok: true,
      value: { a: 1 },
    });
  });

  it('reports an open link of another kind as wrongSchema', () => {
    const link = buildOpenHttpsUrl({ kind: 'food', payload: '{"a":1}' });

    expect(parse(link)).toEqual({ ok: false, error: 'wrongSchema' });
  });
});
