import { PROVIDER_NAME_KEYS } from '@/components/aiOnboarding/providerNames';
import type { AiProviderKind } from '@/constants/ai';

/**
 * `online`: the provider answering is reachable (green). `offline`: it needs the network and there
 * is none (red). `onDevice`: the model runs on the phone, so the connection does not matter (orange).
 */
export type CoachStatusTone = 'online' | 'offline' | 'onDevice';

export interface CoachStatusBadge {
  tone: CoachStatusTone;
  /** Whole translation key, so `npm run check-translations` sees every label. */
  labelKey: string;
}

/**
 * What the coach header's status badge says. Every provider but the on-device model needs a
 * connection (a local server too: it is reached over the network), so without one it reads
 * "Offline"; with one it names the provider in use. The on-device model works either way.
 */
export function coachStatusBadge(
  provider: AiProviderKind | null,
  isConnected: boolean
): CoachStatusBadge {
  if (provider === 'on-device') {
    return { tone: 'onDevice', labelKey: 'coach.statusOnDevice' };
  }

  if (!isConnected) {
    return { tone: 'offline', labelKey: 'coach.statusOffline' };
  }

  return { tone: 'online', labelKey: provider ? PROVIDER_NAME_KEYS[provider] : 'coach.status' };
}
