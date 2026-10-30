import { ThinkingLevel } from '@google/genai';

import {
  buildGeminiGenerationConfig,
  GEMINI_MODEL_CAPABILITIES,
  geminiModelFamily,
} from '../gemini';

jest.mock('../sentry', () => ({ captureMessage: jest.fn() }));

describe('geminiModelFamily', () => {
  it.each([
    ['gemini-4-argon', 'gemini-4'],
    ['gemini-3-pro-preview', 'gemini-3-pro'],
    ['gemini-3.1-pro-preview', 'gemini-3-pro'],
    ['gemini-3-flash-preview', 'gemini-3-flash'],
    ['gemini-3.6-flash', 'gemini-3-flash'],
    ['gemini-3.5-flash-lite', 'gemini-3-flash'],
    ['gemini-3.8-flash', 'gemini-3-flash-no-minimal'],
    ['gemini-2.5-pro', 'gemini-2.5-pro'],
    ['gemini-2.5-flash', 'gemini-2.5-flash'],
    ['gemini-2.5-flash-lite', 'gemini-2.5-flash-lite'],
    ['gemini-2.5-flash-image', 'gemini-2.5-flash'],
    ['something-else', 'other'],
    [undefined, 'other'],
  ])('%s -> %s', (model, family) => {
    expect(geminiModelFamily(model)).toBe(family);
  });
});

describe('buildGeminiGenerationConfig', () => {
  const schema = { type: 'object' };

  it('gives Gemini 3 a thinkingLevel and never a budget', () => {
    const flash = buildGeminiGenerationConfig('gemini-3-flash-preview', {
      responseSchema: schema,
      thinking: 'low',
    });
    expect(flash.thinkingConfig).toEqual({ thinkingLevel: ThinkingLevel.MINIMAL });

    // Pro cannot go below LOW.
    const pro = buildGeminiGenerationConfig('gemini-3.1-pro-preview', {
      responseSchema: schema,
      thinking: 'low',
    });
    expect(pro.thinkingConfig).toEqual({ thinkingLevel: ThinkingLevel.LOW });
  });

  it('never sends MINIMAL to a model whose levels start at low', () => {
    for (const model of ['gemini-3.8-flash', 'gemini-4-argon', 'gemini-3.1-pro-preview']) {
      expect(buildGeminiGenerationConfig(model, { thinking: 'low' }).thinkingConfig).toEqual({
        thinkingLevel: ThinkingLevel.LOW,
      });
    }
  });

  it('gives Gemini 2.5 a thinkingBudget and never a level', () => {
    expect(
      buildGeminiGenerationConfig('gemini-2.5-flash', { responseSchema: schema, thinking: 'low' })
        .thinkingConfig
    ).toEqual({ thinkingBudget: 0 });
    // 2.5 Pro cannot turn thinking off: its minimum budget is 128.
    expect(
      buildGeminiGenerationConfig('gemini-2.5-pro', { responseSchema: schema, thinking: 'low' })
        .thinkingConfig
    ).toEqual({ thinkingBudget: 128 });
  });

  it('sets at most one thinking field for every known family', () => {
    for (const model of [
      'gemini-4-argon',
      'gemini-3.1-pro-preview',
      'gemini-3.8-flash',
      'gemini-3.6-flash',
      'gemini-3-flash-preview',
      'gemini-2.5-pro',
      'gemini-2.5-flash',
      'gemini-2.5-flash-lite',
    ]) {
      const thinking = buildGeminiGenerationConfig(model, { thinking: 'low' })
        .thinkingConfig as Record<string, unknown>;
      expect(Object.keys(thinking)).toHaveLength(1);
    }
  });

  it('leaves thinking to the model when the user asked for it', () => {
    expect(
      buildGeminiGenerationConfig('gemini-2.5-flash', { thinking: 'default' }).thinkingConfig
    ).toBeUndefined();
  });

  it('sends no thinking field to a model it does not know', () => {
    expect(
      buildGeminiGenerationConfig('gemini-9-ultra', { thinking: 'low' }).thinkingConfig
    ).toBeUndefined();
    expect(GEMINI_MODEL_CAPABILITIES.other.kind).toBe('none');
  });

  it('requests JSON with the schema', () => {
    expect(
      buildGeminiGenerationConfig('gemini-2.5-flash', { responseSchema: schema, thinking: 'low' })
    ).toMatchObject({
      responseMimeType: 'application/json',
      responseSchema: schema,
    });
  });
});
