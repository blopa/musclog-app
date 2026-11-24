/**
 * Can this phone run the downloadable model at all? Pure and conservative: it only says no when a
 * reading proves it. An unreadable figure fails open (the camera gate does the same), because the
 * worst outcome is a download offer on a phone that then declines to load, while a false "no"
 * hides a working feature.
 */
import { LOCAL_MODEL_MIN_RAM_BYTES } from '@/constants/localModels';

export type DeviceGateInput = {
  platform: 'ios' | 'android' | 'web' | string;
  /** `Device.totalMemory`, bytes as the kernel reports them. */
  totalMemoryBytes: number | null | undefined;
  /** `Device.supportedCpuArchitectures`. */
  cpuArchitectures: readonly string[] | null | undefined;
  minRamBytes?: number;
};

export type DeviceGateResult = { ok: true } | { ok: false; reason: 'platform' | 'cpu' | 'ram' };

export function evaluateLocalModelDevice(input: DeviceGateInput): DeviceGateResult {
  if (input.platform !== 'ios' && input.platform !== 'android') {
    return { ok: false, reason: 'platform' };
  }

  const architectures = input.cpuArchitectures ?? [];
  if (architectures.length > 0 && !architectures.some((name) => name.startsWith('arm64'))) {
    return { ok: false, reason: 'cpu' };
  }

  const min = input.minRamBytes ?? LOCAL_MODEL_MIN_RAM_BYTES;
  if (
    typeof input.totalMemoryBytes === 'number' &&
    input.totalMemoryBytes > 0 &&
    input.totalMemoryBytes < min
  ) {
    return { ok: false, reason: 'ram' };
  }

  return { ok: true };
}
