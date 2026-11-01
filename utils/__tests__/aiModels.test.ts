import {
  CLAUDE_MODELS,
  DEFAULT_CLAUDE_MODEL,
  DEFAULT_GEMINI_MODEL,
  DEFAULT_OPENAI_MODEL,
  GEMINI_MODELS,
  OPENAI_MODELS,
} from '@/constants/ai';

import { resolveClaudeModel, resolveGeminiModel, resolveOpenAiModel } from '../aiModels';

describe('resolveGeminiModel', () => {
  it('keeps every listed model', () => {
    for (const { value } of Object.values(GEMINI_MODELS)) {
      expect(resolveGeminiModel(value)).toBe(value);
    }
  });

  it('replaces an empty, unknown or retired model with the default', () => {
    for (const stored of [undefined, null, '', '   ', 'gemini-3-pro-preview', 'gemini-2.5-flash']) {
      expect(resolveGeminiModel(stored)).toBe(DEFAULT_GEMINI_MODEL);
    }
  });

  it('defaults to a listed model', () => {
    expect(Object.values(GEMINI_MODELS).map((m) => m.value)).toContain(DEFAULT_GEMINI_MODEL);
  });
});

describe('resolveOpenAiModel', () => {
  it('keeps every listed model', () => {
    for (const { value } of Object.values(OPENAI_MODELS)) {
      expect(resolveOpenAiModel(value)).toBe(value);
    }
  });

  it('replaces an empty, unknown or retired model with the default', () => {
    for (const stored of [undefined, null, '', 'o1', 'o1-pro', 'gpt-4o', 'gpt-5.1']) {
      expect(resolveOpenAiModel(stored)).toBe(DEFAULT_OPENAI_MODEL);
    }
  });

  it('defaults to a listed model', () => {
    expect(Object.values(OPENAI_MODELS).map((m) => m.value)).toContain(DEFAULT_OPENAI_MODEL);
  });
});

describe('resolveClaudeModel', () => {
  it('keeps every listed model', () => {
    for (const { value } of Object.values(CLAUDE_MODELS)) {
      expect(resolveClaudeModel(value)).toBe(value);
    }
  });

  it('replaces an empty, unknown or retired model with the default', () => {
    for (const stored of [
      undefined,
      null,
      '',
      '  ',
      'claude-3-5-sonnet',
      'claude-opus-5-5-20260401',
    ]) {
      expect(resolveClaudeModel(stored)).toBe(DEFAULT_CLAUDE_MODEL);
    }
  });

  it('defaults to a listed model', () => {
    expect(Object.values(CLAUDE_MODELS).map((m) => m.value)).toContain(DEFAULT_CLAUDE_MODEL);
  });
});
