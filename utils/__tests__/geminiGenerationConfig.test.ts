import { ThinkingLevel } from '@google/genai';

import {
  buildGeminiGenerationConfig,
  GEMINI_MODEL_CAPABILITIES,
  geminiModelFamily,
} from '../gemini';

jest.mock('../sentry', () => ({ captureMessage: jest.fn() }));

const ALL_MODELS = [
  'gemini-4-argon',
  'gemini-3-pro-preview',
  'gemini-3.1-pro-preview',
  'gemini-3-flash-preview',
  'gemini-3.6-flash',
  'gemini-3.8-flash',
  'gemini-2.5-pro',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
];

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
      effort: 'minimal',
    });
    expect(flash.thinkingConfig).toEqual({ thinkingLevel: ThinkingLevel.MINIMAL });

    // Pro cannot go below LOW.
    const pro = buildGeminiGenerationConfig('gemini-3.1-pro-preview', {
      responseSchema: schema,
      effort: 'minimal',
    });
    expect(pro.thinkingConfig).toEqual({ thinkingLevel: ThinkingLevel.LOW });
  });

  it('never sends MINIMAL to a model whose levels start at low', () => {
    for (const model of ['gemini-3.8-flash', 'gemini-4-argon', 'gemini-3.1-pro-preview']) {
      expect(buildGeminiGenerationConfig(model, { effort: 'minimal' }).thinkingConfig).toEqual({
        thinkingLevel: ThinkingLevel.LOW,
      });
    }
  });

  it('sends LOW, not MINIMAL, for low effort on gemini-3.6-flash', () => {
    expect(
      buildGeminiGenerationConfig('gemini-3.6-flash', { effort: 'low' }).thinkingConfig
    ).toEqual({ thinkingLevel: ThinkingLevel.LOW });
  });

  it('sends MEDIUM for medium effort on gemini-3.8-flash', () => {
    expect(
      buildGeminiGenerationConfig('gemini-3.8-flash', { effort: 'medium' }).thinkingConfig
    ).toEqual({ thinkingLevel: ThinkingLevel.MEDIUM });
  });

  it('gives Gemini 2.5 a thinkingBudget and never a level', () => {
    expect(
      buildGeminiGenerationConfig('gemini-2.5-flash', { responseSchema: schema, effort: 'minimal' })
        .thinkingConfig
    ).toEqual({ thinkingBudget: 0 });
    // 2.5 Pro cannot turn thinking off: its minimum budget is 128.
    expect(
      buildGeminiGenerationConfig('gemini-2.5-pro', { responseSchema: schema, effort: 'low' })
        .thinkingConfig
    ).toEqual({ thinkingBudget: 128 });
  });

  it('leaves 2.5 thinking to the model for medium effort', () => {
    expect(
      buildGeminiGenerationConfig('gemini-2.5-flash', { effort: 'medium' }).thinkingConfig
    ).toBeUndefined();
  });

  it('sets at most one thinking field for every known family', () => {
    for (const model of ALL_MODELS) {
      for (const effort of ['minimal', 'low', 'medium', 'high'] as const) {
        const thinking = buildGeminiGenerationConfig(model, { effort }).thinkingConfig as
          Record<string, unknown> | undefined;
        if (thinking !== undefined) {
          expect(Object.keys(thinking)).toHaveLength(1);
        }
      }
    }
  });

  it('sets exactly one thinking field for low and medium effort on every known family where it applies', () => {
    for (const model of ALL_MODELS) {
      const low = buildGeminiGenerationConfig(model, { effort: 'low' }).thinkingConfig as Record<
        string,
        unknown
      >;
      expect(Object.keys(low)).toHaveLength(1);
    }

    const levelModels = ALL_MODELS.filter(
      (m) => GEMINI_MODEL_CAPABILITIES[geminiModelFamily(m)].kind === 'level'
    );
    for (const model of levelModels) {
      const medium = buildGeminiGenerationConfig(model, { effort: 'medium' })
        .thinkingConfig as Record<string, unknown>;
      expect(Object.keys(medium)).toHaveLength(1);
    }
  });

  it('leaves thinking to the model for high effort, even on a level family', () => {
    expect(
      buildGeminiGenerationConfig('gemini-4-argon', { effort: 'high' }).thinkingConfig
    ).toBeUndefined();
    expect(
      buildGeminiGenerationConfig('gemini-2.5-flash', { effort: 'high' }).thinkingConfig
    ).toBeUndefined();
  });

  it('sends no thinking field to a model it does not know', () => {
    expect(
      buildGeminiGenerationConfig('gemini-9-ultra', { effort: 'low' }).thinkingConfig
    ).toBeUndefined();
    expect(GEMINI_MODEL_CAPABILITIES.other.kind).toBe('none');
  });

  it('requests JSON with the schema', () => {
    expect(
      buildGeminiGenerationConfig('gemini-2.5-flash', { responseSchema: schema, effort: 'minimal' })
    ).toMatchObject({
      responseMimeType: 'application/json',
      responseSchema: schema,
    });
  });
});
