import { isAiCreditsError } from '../coachAI';

jest.mock('../onDeviceAi', () => ({
  sendOnDeviceMessage: jest.fn(),
  sendOnDeviceStructured: jest.fn(),
  streamOnDeviceMessage: jest.fn(),
}));

describe('isAiCreditsError', () => {
  it('matches 429 and insufficient quota', () => {
    expect(isAiCreditsError({ status: 429 })).toBe(true);
    expect(isAiCreditsError({ code: 'insufficient_quota' })).toBe(true);
  });

  it('matches HTTP 402', () => {
    expect(isAiCreditsError({ status: 402 })).toBe(true);
  });

  it('matches an OpenRouter guardrail budget 403', () => {
    expect(
      isAiCreditsError({
        status: 403,
        error: { metadata: { limit_source: 'openrouter_guardrail_budget' } },
      })
    ).toBe(true);
  });

  it('keeps a plain 403 and other errors false', () => {
    expect(isAiCreditsError({ status: 403 })).toBe(false);
    expect(isAiCreditsError({ status: 403, error: { metadata: { limit_source: 'other' } } })).toBe(
      false
    );
    expect(isAiCreditsError({ status: 500, message: 'boom' })).toBe(false);
  });
});
