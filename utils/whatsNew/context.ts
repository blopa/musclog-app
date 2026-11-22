import { CycleRepository } from '@/database/repositories/CycleRepository';
import { isPremiumUiEnabled } from '@/utils/premium/premiumUiFlag';

import type { WhatsNewContext } from './catalog';

/** Reads, outside React, the facts that gate conditional What's new pages. */
export async function loadWhatsNewContext(): Promise<WhatsNewContext> {
  try {
    const cycles = await CycleRepository.cycles().fetch();
    return {
      cycleTracking: cycles.some((cycle) => cycle.isActive),
      premium: isPremiumUiEnabled(),
    };
  } catch {
    return { cycleTracking: false, premium: isPremiumUiEnabled() };
  }
}
