import { NOT_INSTALLED, type LocalModelInstallState } from '../localModels/install';
import {
  onDeviceCapabilities,
  parseOnDeviceEngineChoice,
  resolveOnDeviceEngine,
} from '../onDeviceEngine';
import { deriveOnDeviceStatus, hasLocalAiOption, isOnDeviceReady } from '../onDeviceStatus';

const model = (
  state: LocalModelInstallState,
  extra: Partial<{ supported: boolean; projectorInstalled: boolean; updateAvailable: boolean }> = {}
) => ({
  supported: true,
  state,
  projectorInstalled: false,
  updateAvailable: false,
  ...extra,
});

describe('engine choice', () => {
  it('parses unknown values as auto', () => {
    expect(parseOnDeviceEngineChoice('apple')).toBe('apple');
    expect(parseOnDeviceEngineChoice('gguf')).toBe('gguf');
    expect(parseOnDeviceEngineChoice('')).toBe('auto');
    expect(parseOnDeviceEngineChoice('mnn')).toBe('auto');
  });

  it('auto means Apple on iOS and the downloaded model elsewhere', () => {
    expect(resolveOnDeviceEngine('auto', 'ios')).toBe('apple');
    expect(resolveOnDeviceEngine('auto', 'android')).toBe('gguf');
    expect(resolveOnDeviceEngine('auto', 'web')).toBe('gguf');
  });

  it('an explicit gguf wins on iOS, and apple never runs off iOS', () => {
    expect(resolveOnDeviceEngine('gguf', 'ios')).toBe('gguf');
    expect(resolveOnDeviceEngine('apple', 'android')).toBe('gguf');
    expect(resolveOnDeviceEngine('apple', 'ios')).toBe('apple');
  });
});

describe('capabilities', () => {
  it('only the downloaded model with its projector reads photos', () => {
    expect(onDeviceCapabilities('gguf', true).vision).toBe(true);
    expect(onDeviceCapabilities('gguf', false).vision).toBe(false);
    expect(onDeviceCapabilities('apple', true).vision).toBe(false);
  });

  it('gives each engine its own context budget', () => {
    expect(onDeviceCapabilities('apple', false).contextChars).toBe(4500);
    expect(onDeviceCapabilities('gguf', false).contextChars).toBe(8000);
  });
});

describe('deriveOnDeviceStatus: apple', () => {
  const base = { engine: 'apple' as const, model: model(NOT_INSTALLED), deviceOk: true };

  it.each([
    ['available', 'ready'],
    ['deviceNotEligible', 'appleNotEligible'],
    ['appleIntelligenceNotEnabled', 'appleOff'],
    ['modelNotReady', 'appleNotReady'],
    ['unsupportedOs', 'unsupported'],
    ['unknown', 'unsupported'],
  ] as const)('%s -> %s', (availability, expected) => {
    const status = deriveOnDeviceStatus({ ...base, appleAvailability: availability });
    expect(status.initialized).toBe(false);
    expect(status.state).toBe(expected);
    expect(status.appleState).toBe(expected);
    expect(status.progress).toBeNull();
    expect(isOnDeviceReady(status)).toBe(expected === 'ready');
  });

  it('preserves initialized flag and appleState even when gguf is active', () => {
    const status = deriveOnDeviceStatus({
      initialized: true,
      engine: 'gguf',
      appleAvailability: 'appleIntelligenceNotEnabled',
      model: model(NOT_INSTALLED),
      deviceOk: true,
    });
    expect(status.initialized).toBe(true);
    expect(status.state).toBe('needsDownload');
    expect(status.appleState).toBe('appleOff');
  });
});

describe('deriveOnDeviceStatus: downloaded model', () => {
  const base = {
    engine: 'gguf' as const,
    appleAvailability: 'unsupportedOs' as const,
    deviceOk: true,
  };

  it('is unsupported where nothing can be installed or the phone is too small', () => {
    expect(
      deriveOnDeviceStatus({ ...base, model: model(NOT_INSTALLED, { supported: false }) }).state
    ).toBe('unsupported');
    expect(
      deriveOnDeviceStatus({ ...base, deviceOk: false, model: model(NOT_INSTALLED) }).state
    ).toBe('unsupported');
  });

  it('needs a download until installed', () => {
    expect(deriveOnDeviceStatus({ ...base, model: model(NOT_INSTALLED) }).state).toBe(
      'needsDownload'
    );
  });

  it('reports progress while downloading, paused, verifying or installing', () => {
    const downloading = deriveOnDeviceStatus({
      ...base,
      model: model({ kind: 'downloading', receivedBytes: 50, totalBytes: 100 }),
    });
    expect(downloading.state).toBe('downloading');
    expect(downloading.progress).toBe(0.5);
    expect(
      deriveOnDeviceStatus({
        ...base,
        model: model({ kind: 'paused', receivedBytes: 25, totalBytes: 100 }),
      }).progress
    ).toBe(0.25);
    expect(deriveOnDeviceStatus({ ...base, model: model({ kind: 'verifying' }) }).progress).toBe(1);
  });

  it('is ready once installed, with photos only when the projector came along', () => {
    const text = deriveOnDeviceStatus({
      ...base,
      model: model({ kind: 'ready', revision: 'r', withProjector: false }),
    });
    expect(isOnDeviceReady(text)).toBe(true);
    expect(text.capabilities.vision).toBe(false);

    const photos = deriveOnDeviceStatus({
      ...base,
      model: model(
        { kind: 'ready', revision: 'r', withProjector: true },
        { projectorInstalled: true }
      ),
    });
    expect(photos.capabilities.vision).toBe(true);
  });

  it('keeps a failure visible', () => {
    expect(
      deriveOnDeviceStatus({ ...base, model: model({ kind: 'failed', reason: 'network' }) }).state
    ).toBe('downloadFailed');
  });

  it('carries the update flag for the downloaded model only', () => {
    expect(
      deriveOnDeviceStatus({ ...base, model: model(NOT_INSTALLED, { updateAvailable: true }) })
        .updateAvailable
    ).toBe(true);
    expect(
      deriveOnDeviceStatus({
        engine: 'apple',
        appleAvailability: 'available',
        deviceOk: true,
        model: model(NOT_INSTALLED, { updateAvailable: true }),
      }).updateAvailable
    ).toBe(false);
  });
});

describe('options', () => {
  const base = { engine: 'gguf' as const, model: model(NOT_INSTALLED), deviceOk: true };

  it('offers Apple only when the device is eligible, even with the feature off', () => {
    const options = (
      appleAvailability: Parameters<typeof deriveOnDeviceStatus>[0]['appleAvailability']
    ) => deriveOnDeviceStatus({ ...base, appleAvailability }).options.apple;
    expect(options('available')).toBe(true);
    expect(options('appleIntelligenceNotEnabled')).toBe(true);
    expect(options('modelNotReady')).toBe(true);
    expect(options('deviceNotEligible')).toBe(false);
    expect(options('unsupportedOs')).toBe(false);
  });

  it('offers the downloaded model only where the device gate and the platform allow it', () => {
    expect(
      deriveOnDeviceStatus({ ...base, appleAvailability: 'unsupportedOs' }).options.model
    ).toBe(true);
    expect(
      deriveOnDeviceStatus({ ...base, deviceOk: false, appleAvailability: 'unsupportedOs' }).options
        .model
    ).toBe(false);
    expect(
      deriveOnDeviceStatus({
        ...base,
        model: model(NOT_INSTALLED, { supported: false }),
        appleAvailability: 'unsupportedOs',
      }).options.model
    ).toBe(false);
  });

  it('asks the onboarding question only when some option exists', () => {
    expect(hasLocalAiOption({ options: { apple: false, model: false } })).toBe(false);
    expect(hasLocalAiOption({ options: { apple: true, model: false } })).toBe(true);
    expect(hasLocalAiOption({ options: { apple: false, model: true } })).toBe(true);
  });
});

describe('the text model capability', () => {
  it('is true only for the downloaded model with its text model installed', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { onDeviceCapabilities } = require('../onDeviceEngine');

    expect(onDeviceCapabilities('gguf', false, true).textModel).toBe(true);
    expect(onDeviceCapabilities('gguf', false).textModel).toBe(false);
    expect(onDeviceCapabilities('apple', false, true).textModel).toBe(false);
  });
});
