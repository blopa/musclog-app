import { parseWhatsNewRelease } from '@/utils/whatsNew/schema';
import { compareVersions } from '@/utils/whatsNew/version';

import v2_15_2 from './2.15.2.json';
import v2_16_0 from './2.16.0.json';
import v2_17_5 from './2.17.5.json';
import v2_18_0 from './2.18.0.json';

// Metro needs explicit imports. The registry test checks these against the directory.
export const WHATS_NEW_RELEASE_FILES = {
  '2.15.2.json': v2_15_2,
  '2.16.0.json': v2_16_0,
  '2.17.5.json': v2_17_5,
  '2.18.0.json': v2_18_0,
};
export const whatsNewReleases = Object.entries(WHATS_NEW_RELEASE_FILES)
  .flatMap(([fileName, raw]) => {
    const { release, issues } = parseWhatsNewRelease(raw, fileName);
    if (__DEV__ && issues.length) {
      console.warn('[WhatsNew]', issues.join('\n'));
    }

    return release ? [release] : [];
  })
  .sort((a, b) => compareVersions(a.version, b.version));
