/**
 * @jest-environment jsdom
 */

import { act, renderHook } from '@testing-library/react';
import { TextEncoder as NodeTextEncoder } from 'node:util';

import { dumpDatabase } from '@/database/exportDb';
import { useOpticalSender, type OpticalPayloadBuilder } from '@/hooks/useOpticalSender';
import { calibrateDevice } from '@/utils/optical/bench';
import {
  OPTICAL_EXPORT_VERSION_SHARE,
  OPTICAL_PAYLOAD_KIND_DATABASE,
  OPTICAL_PAYLOAD_KIND_SHARE,
} from '@/utils/optical/container';

if (typeof globalThis.TextEncoder === 'undefined') {
  globalThis.TextEncoder = NodeTextEncoder as unknown as typeof globalThis.TextEncoder;
}

jest.mock('@/database/exportDb', () => ({
  dumpDatabase: jest.fn(async () => '{"_exportVersion":24,"foods":[]}'),
}));

jest.mock('@/hooks/useKeepScreenAwake', () => ({ useKeepScreenAwake: () => {} }));

jest.mock('@/utils/optical/bench', () => ({
  ...jest.requireActual('@/utils/optical/bench'),
  calibrateDevice: jest.fn(async () => ({
    benchmarks: [],
    recommendedFps: 8,
    recommendedPresetId: 'tiny',
  })),
}));

const mockDumpDatabase = dumpDatabase as jest.Mock;
const mockCalibrateDevice = calibrateDevice as jest.Mock;

describe('useOpticalSender payload building', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('keeps the full-database path as the default', async () => {
    const { result } = renderHook(() => useOpticalSender({}));

    await act(async () => result.current.prepare());

    expect(mockDumpDatabase).toHaveBeenCalledTimes(1);
    expect(result.current.phase).toBe('ready');
    expect(result.current.summary?.meta.payloadKind).toBe(OPTICAL_PAYLOAD_KIND_DATABASE);
    expect(result.current.summary?.meta.exportVersion).toBe(24);
  });

  it('uses a custom payload without dumping and retains it across density changes', async () => {
    const buildPayload = jest.fn<ReturnType<OpticalPayloadBuilder>, []>(async () => ({
      exportVersion: OPTICAL_EXPORT_VERSION_SHARE,
      json: '{"_musclogShare":1,"kind":"meal"}',
      payloadKind: OPTICAL_PAYLOAD_KIND_SHARE,
    }));
    const { result } = renderHook(() => useOpticalSender({ buildPayload }));

    await act(async () => result.current.prepare());
    const firstBytes = result.current.summary?.containerBytes;
    act(() => result.current.setPreset('compact'));

    expect(mockDumpDatabase).not.toHaveBeenCalled();
    expect(buildPayload).toHaveBeenCalledTimes(1);
    expect(result.current.summary?.preset.id).toBe('compact');
    expect(result.current.summary?.containerBytes).toBe(firstBytes);
    expect(result.current.summary?.meta.payloadKind).toBe(OPTICAL_PAYLOAD_KIND_SHARE);
  });

  it('supports an explicit re-pack and caches calibration until reset', async () => {
    const buildPayload = jest.fn(async () => ({
      exportVersion: OPTICAL_EXPORT_VERSION_SHARE,
      json: '{"small":true}',
      payloadKind: OPTICAL_PAYLOAD_KIND_SHARE,
    }));
    const override = jest.fn(async () => ({
      exportVersion: OPTICAL_EXPORT_VERSION_SHARE,
      json: JSON.stringify({ larger: '0123456789abcdef'.repeat(80) }),
      payloadKind: OPTICAL_PAYLOAD_KIND_SHARE,
    }));
    const { result } = renderHook(() => useOpticalSender({ buildPayload }));

    await act(async () => result.current.prepare());
    const firstBytes = result.current.summary?.containerBytes ?? 0;
    await act(async () => result.current.prepare(override));

    expect(override).toHaveBeenCalledTimes(1);
    expect(result.current.summary?.containerBytes).not.toBe(firstBytes);
    expect(mockCalibrateDevice).toHaveBeenCalledTimes(1);

    act(() => result.current.reset());
    await act(async () => result.current.prepare());
    expect(mockCalibrateDevice).toHaveBeenCalledTimes(2);
  });
});
