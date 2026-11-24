import { evaluateLocalModelDevice } from '../deviceGate';

const base = { platform: 'android', totalMemoryBytes: 7.5e9, cpuArchitectures: ['arm64-v8a'] };

describe('evaluateLocalModelDevice', () => {
  it('accepts a 6 GB+ arm64 phone', () => {
    expect(evaluateLocalModelDevice(base)).toEqual({ ok: true });
    expect(evaluateLocalModelDevice({ ...base, platform: 'ios', totalMemoryBytes: 5.6e9 })).toEqual(
      { ok: true }
    );
  });

  it('rejects web', () => {
    expect(evaluateLocalModelDevice({ ...base, platform: 'web' })).toEqual({
      ok: false,
      reason: 'platform',
    });
  });

  it('rejects a 4 GB phone and a 32-bit-only phone', () => {
    expect(evaluateLocalModelDevice({ ...base, totalMemoryBytes: 3.7e9 })).toEqual({
      ok: false,
      reason: 'ram',
    });
    expect(evaluateLocalModelDevice({ ...base, cpuArchitectures: ['armeabi-v7a'] })).toEqual({
      ok: false,
      reason: 'cpu',
    });
  });

  it('fails open when readings are missing', () => {
    expect(
      evaluateLocalModelDevice({ platform: 'ios', totalMemoryBytes: null, cpuArchitectures: null })
    ).toEqual({
      ok: true,
    });
    expect(evaluateLocalModelDevice({ ...base, cpuArchitectures: [] })).toEqual({ ok: true });
  });
});
