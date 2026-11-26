import type { AiProviderKind } from '@/constants/ai';
import type { OnDeviceStatus } from '@/utils/onDeviceStatus';

export type AiReadiness = 'ready' | 'notConfigured' | 'localNotReady';

/**
 * Whether an AI feature can run right now. `localNotReady`: on-device AI is the provider that would
 * answer but cannot yet, so the person is told why instead of meeting a failing request.
 */
export function aiReadiness({
  isAiConfigured,
  aiProvider,
  onDeviceState,
}: {
  isAiConfigured: boolean;
  aiProvider: AiProviderKind | null;
  onDeviceState: OnDeviceStatus['state'];
}): AiReadiness {
  if (!isAiConfigured) {
    return 'notConfigured';
  }

  return aiProvider === 'on-device' && onDeviceState !== 'ready' ? 'localNotReady' : 'ready';
}
