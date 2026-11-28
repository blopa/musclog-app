import { aiReadiness } from '@/utils/aiReadiness';

describe('aiReadiness', () => {
  it('is notConfigured whenever no provider is set up', () => {
    expect(aiReadiness({ isAiConfigured: false, aiProvider: null, onDeviceState: 'ready' })).toBe(
      'notConfigured'
    );
    expect(
      aiReadiness({
        isAiConfigured: false,
        aiProvider: 'on-device',
        onDeviceState: 'needsDownload',
      })
    ).toBe('notConfigured');
  });

  it('is localNotReady when on-device AI is the provider and its state is not ready', () => {
    expect(
      aiReadiness({ isAiConfigured: true, aiProvider: 'on-device', onDeviceState: 'needsDownload' })
    ).toBe('localNotReady');
  });

  it('is ready when on-device AI is the provider and ready', () => {
    expect(
      aiReadiness({ isAiConfigured: true, aiProvider: 'on-device', onDeviceState: 'ready' })
    ).toBe('ready');
  });

  it('is ready for any other provider whatever the on-device state', () => {
    for (const aiProvider of [
      'gemini',
      'openai',
      'claude',
      'hosted',
      'gateway',
      'local',
    ] as const) {
      expect(
        aiReadiness({ isAiConfigured: true, aiProvider, onDeviceState: 'needsDownload' })
      ).toBe('ready');
    }
  });
});
