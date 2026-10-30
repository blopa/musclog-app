import { CycleRepository } from '@/database/repositories/CycleRepository';

import type { WhatsNewContext } from './catalog';

/** Reads, outside React, the facts that gate conditional What's new pages. */
export async function loadWhatsNewContext(): Promise<WhatsNewContext> {
  try {
    const cycles = await CycleRepository.cycles().fetch();
    return { cycleTracking: cycles.some((cycle) => cycle.isActive) };
  } catch {
    return { cycleTracking: false };
  }
}
