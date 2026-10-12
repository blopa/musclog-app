import { extractGeminiText } from '../gemini';

jest.mock('../sentry', () => ({ captureMessage: jest.fn() }));

const response = (parts: any[], extra: Record<string, unknown> = {}) => ({
  candidates: [{ content: { parts }, finishReason: 'STOP' }],
  ...extra,
});

describe('extractGeminiText', () => {
  it('returns the answer, not the thought summary that came first', () => {
    const result = extractGeminiText(
      response([
        { text: 'Let me think about macros…', thought: true },
        { text: '{"kcal":' },
        { text: '420}' },
      ])
    );

    expect(result.text).toBe('{"kcal":420}');
    expect(result.thoughtOnly).toBe(false);
  });

  it('does NOT fall back to thought text when every part is a thought', () => {
    // The SDK getter returns undefined here; `?? parts[0].text` used to parse the thought as JSON.
    const result = extractGeminiText(
      response([{ text: 'Considering the label…', thought: true }], { text: undefined })
    );

    expect(result.text).toBe('');
    expect(result.thoughtOnly).toBe(true);
  });

  it('reports why an answer is empty', () => {
    const blocked = extractGeminiText({
      candidates: [],
      promptFeedback: { blockReason: 'SAFETY' },
    });
    expect(blocked).toMatchObject({ text: '', blockReason: 'SAFETY', thoughtOnly: false });

    const truncated = extractGeminiText({
      candidates: [{ content: { parts: [] }, finishReason: 'MAX_TOKENS' }],
    });
    expect(truncated).toMatchObject({ text: '', finishReason: 'MAX_TOKENS' });
  });

  it('falls back to response.text only when there are no parts (mocks, the gateway)', () => {
    expect(extractGeminiText({ text: 'flat answer' }).text).toBe('flat answer');
    expect(extractGeminiText({ text: 'flat', candidates: [{ content: { parts: [] } }] }).text).toBe(
      'flat'
    );
  });

  it('survives a missing or empty response', () => {
    expect(extractGeminiText(undefined).text).toBe('');
    expect(extractGeminiText({}).text).toBe('');
    expect(extractGeminiText({ candidates: [{}] }).text).toBe('');
  });

  it('ignores parts with no text, such as inline data', () => {
    expect(extractGeminiText(response([{ inlineData: { data: 'x' } }, { text: 'ok' }])).text).toBe(
      'ok'
    );
  });
});
