import { CycleRepository } from '@/database/repositories/CycleRepository';
import { refreshOnDeviceStatus } from '@/services/localModels/onDeviceStatusStore';
import { hasLocalAiOption } from '@/utils/onDeviceStatus';
import { isPremiumUiEnabled } from '@/utils/premium/premiumUiFlag';

import type { WhatsNewContext } from './catalog';

/** Reads, outside React, the facts that gate conditional What's new pages. */
export async function loadWhatsNewContext(): Promise<WhatsNewContext> {
  const onDeviceAiPossible = await refreshOnDeviceStatus().then(
    (status) => hasLocalAiOption(status),
    () => false
  );
  try {
    const cycles = await CycleRepository.cycles().fetch();
    return {
      cycleTracking: cycles.some((cycle) => cycle.isActive),
      premium: isPremiumUiEnabled(),
      onDeviceAiPossible,
    };
  } catch {
    return { cycleTracking: false, premium: isPremiumUiEnabled(), onDeviceAiPossible };
  }
}
