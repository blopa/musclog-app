import {
  buildExternalChatUrl,
  buildExternalInstructions,
  EXTERNAL_TARGETS,
  EXTERNAL_URL_MAX_CHARS,
  INSTRUCTIONS_REVISION,
} from '@/utils/aiOnboarding/instructions';
import { buildContractJsonSchema } from '@/utils/aiOnboarding/jsonSchema';

describe('buildExternalInstructions', () => {
  const text = buildExternalInstructions({ language: 'pt-BR' });

  it('carries the revision, the language and the embedded schema', () => {
    expect(text).toContain(`revision ${INSTRUCTIONS_REVISION}`);
    expect(text).toContain('"pt-BR"');
    expect(text).toContain(JSON.stringify(buildContractJsonSchema()));
  });

  it('states every rule the brief requires', () => {
    expect(text).toMatch(/at most 2 or 3/);
    expect(text).toMatch(/Never invent/);
    expect(text).toMatch(/confirm/i);
    expect(text).toMatch(/Python/);
    expect(text).toMatch(/jsonschema/);
    expect(text).toContain('musclog-onboarding.json');
    expect(text).toMatch(/single JSON code block/);
    expect(text).toMatch(/could not validate/);
  });

  it('never asks about the cycle and is deterministic', () => {
    expect(text).toMatch(/menstrual cycle/);
    expect(buildExternalInstructions({ language: 'pt-BR' })).toBe(text);
  });

  it('contains no secrets or links back to personal data', () => {
    expect(text).not.toMatch(/api[_ -]?key/i);
    expect(text).not.toMatch(/sk-|AIza/);
  });
});

describe('buildExternalChatUrl', () => {
  it('prefills a short prompt', () => {
    const { url, prefilled } = buildExternalChatUrl('claude', 'hello there');

    expect(prefilled).toBe(true);
    expect(url).toBe('https://claude.ai/new?q=hello%20there');
    expect(buildExternalChatUrl('chatgpt', 'a&b').url).toBe('https://chatgpt.com/?q=a%26b');
  });

  it('falls back to the bare address when the encoded link is too long', () => {
    const long = 'x'.repeat(EXTERNAL_URL_MAX_CHARS);

    expect(buildExternalChatUrl('claude', long)).toEqual({
      url: EXTERNAL_TARGETS.claude,
      prefilled: false,
    });
  });

  it('keeps a link exactly at the limit', () => {
    const base = `${EXTERNAL_TARGETS.chatgpt}?q=`;
    const fits = 'y'.repeat(EXTERNAL_URL_MAX_CHARS - base.length);

    expect(buildExternalChatUrl('chatgpt', fits).prefilled).toBe(true);
    expect(buildExternalChatUrl('chatgpt', `${fits}y`).prefilled).toBe(false);
  });

  it('cannot prefill the real instructions, so the clipboard is the main path', () => {
    const real = buildExternalInstructions({ language: 'en-US' });

    expect(buildExternalChatUrl('claude', real).prefilled).toBe(false);
  });
});
