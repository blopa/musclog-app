import { aiTelemetryTags, reportAiEvent } from '../aiTelemetry';
import { captureMessage } from '../sentry';

jest.mock('../sentry', () => ({ captureMessage: jest.fn().mockResolvedValue(undefined) }));

describe('aiTelemetryTags', () => {
  it('stringifies values and leaves out the unset ones', () => {
    expect(
      aiTelemetryTags({ provider: 'local', attempts: 2, repaired: true, engine: undefined })
    ).toEqual({
      provider: 'local',
      attempts: '2',
      repaired: 'true',
    });
  });
});

describe('reportAiEvent', () => {
  beforeEach(() => {
    jest.mocked(captureMessage).mockClear();
  });

  it('sends one grouped message per event, provider and operation, with tags only', () => {
    reportAiEvent('ai-structured-reply-unusable', {
      provider: 'on-device',
      operation: 'estimateNutritionFromPhoto',
      engine: 'gguf',
    });

    expect(captureMessage).toHaveBeenCalledWith('ai-structured-reply-unusable', {
      level: 'warning',
      tags: { provider: 'on-device', operation: 'estimateNutritionFromPhoto', engine: 'gguf' },
      fingerprint: ['ai-structured-reply-unusable', 'on-device', 'estimateNutritionFromPhoto'],
    });
  });

  it('reports a checksum mismatch as an error', () => {
    reportAiEvent('local-model-checksum-mismatch', { model: 'gemma', revision: 'r1' });

    expect(jest.mocked(captureMessage).mock.calls[0][1]).toMatchObject({ level: 'error' });
  });

  it('never throws, even when Sentry does', () => {
    jest.mocked(captureMessage).mockImplementationOnce(() => {
      throw new Error('boom');
    });

    expect(() => reportAiEvent('ai-structured-reply-repaired')).not.toThrow();
  });

  it('never throws when the report is rejected', async () => {
    jest.mocked(captureMessage).mockRejectedValueOnce(new Error('offline'));

    expect(() => reportAiEvent('ai-structured-reply-repaired')).not.toThrow();
    await Promise.resolve();
  });
});
