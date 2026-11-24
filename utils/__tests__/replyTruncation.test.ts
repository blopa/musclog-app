import { isTruncatedStop } from '../replyTruncation';

describe('isTruncatedStop', () => {
  it.each([
    ['openai', 'length'],
    ['claude', 'max_tokens'],
    ['gemini', 'MAX_TOKENS'],
  ] as const)('treats the %s token-limit signal as truncated', (source, reason) => {
    expect(isTruncatedStop({ source, reason })).toBe(true);
  });

  it.each([
    ['openai', 'stop'],
    ['openai', 'tool_calls'],
    ['claude', 'end_turn'],
    ['claude', 'stop_sequence'],
    ['gemini', 'STOP'],
    ['gemini', 'SAFETY'],
  ] as const)('does not treat %s reason %s as truncated', (source, reason) => {
    expect(isTruncatedStop({ source, reason })).toBe(false);
  });

  it.each(['openai', 'claude', 'gemini'] as const)(
    'is false for %s with a missing or null reason',
    (source) => {
      expect(isTruncatedStop({ source })).toBe(false);
      expect(isTruncatedStop({ source, reason: null })).toBe(false);
      expect(isTruncatedStop({ source, reason: undefined })).toBe(false);
    }
  );

  it('is false when there is no signal at all', () => {
    expect(isTruncatedStop(undefined)).toBe(false);
  });

  it('does not accept another provider vocabulary', () => {
    expect(isTruncatedStop({ source: 'openai', reason: 'max_tokens' })).toBe(false);
    expect(isTruncatedStop({ source: 'claude', reason: 'length' })).toBe(false);
    expect(isTruncatedStop({ source: 'gemini', reason: 'length' })).toBe(false);
    expect(isTruncatedStop({ source: 'openai', reason: 'MAX_TOKENS' })).toBe(false);
  });
});
