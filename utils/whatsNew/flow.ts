import { WHATS_NEW_MAX_PAGES } from '@/constants/whatsNew';

import type { WhatsNewBlock, WhatsNewKey, WhatsNewRelease } from './schema';
import { compareVersions, parseAppVersion, parseVersion } from './version';

export type WhatsNewFlow = {
  pages: { key: string; version: string; blocks: WhatsNewBlock[] }[];
  releaseVersions: string[];
  truncated: boolean;
};
type FlowInput = {
  releases: readonly WhatsNewRelease[];
  currentVersion: string;
  maxPages?: number;
};

function livePages(release: WhatsNewRelease, current: string): WhatsNewFlow['pages'] {
  const live = (item: { supersededIn?: string }) =>
    !item.supersededIn || compareVersions(current, item.supersededIn) < 0;
  return release.pages
    .filter(live)
    .map((page) => ({
      key: `${release.version}:${page.id}`,
      version: release.version,
      blocks: page.blocks.filter(live),
    }))
    .filter((page) => page.blocks.length > 0);
}

export function selectWhatsNewFlow({
  releases,
  seenThrough,
  currentVersion,
  maxPages = WHATS_NEW_MAX_PAGES,
}: FlowInput & { seenThrough: string | null }): WhatsNewFlow {
  const empty: WhatsNewFlow = { pages: [], releaseVersions: [], truncated: false };
  if (!parseAppVersion(currentVersion)) {
    return empty;
  }

  const seen = parseVersion(seenThrough) ? seenThrough! : '0.0.0';
  const eligible = releases
    .filter(
      (release) =>
        compareVersions(release.version, seen) > 0 &&
        compareVersions(release.version, currentVersion) <= 0
    )
    .sort((a, b) => compareVersions(b.version, a.version));
  const cap = Number.isFinite(maxPages) ? Math.max(0, Math.floor(maxPages)) : WHATS_NEW_MAX_PAGES;
  let remaining = cap;
  let total = 0;
  const groups = eligible.map((release) => {
    const pages = livePages(release, currentVersion);
    total += pages.length;
    const selected = pages.slice(0, remaining);
    remaining -= selected.length;
    return selected;
  });
  const pages = groups.reverse().flat();
  return {
    pages,
    releaseVersions: [...new Set(pages.map((page) => page.version))],
    truncated: total > pages.length,
  };
}

export function selectReplayFlow(input: FlowInput): WhatsNewFlow {
  if (parseAppVersion(input.currentVersion)) {
    const newest = [...input.releases]
      .sort((a, b) => compareVersions(b.version, a.version))
      .find(
        (release) =>
          compareVersions(release.version, input.currentVersion) <= 0 &&
          livePages(release, input.currentVersion).length > 0
      );
    if (newest) {
      return selectWhatsNewFlow({ ...input, releases: [newest], seenThrough: null });
    }
  }

  return { pages: [], releaseVersions: [], truncated: false };
}

/**
 * The line that names a page in the intro's "what's in this tour" list: the first block that has a
 * heading of its own (an action block's label stands in for one). `null` when a page has none, in
 * which case the page simply is not listed.
 */
export function pageHeadlineKey(page: WhatsNewFlow['pages'][number]): WhatsNewKey | null {
  for (const block of page.blocks) {
    const key = block.type === 'action' ? block.labelKey : block.titleKey;
    if (key) {
      return key;
    }
  }

  return null;
}
