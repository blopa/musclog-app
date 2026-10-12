import { selectReplayFlow, selectWhatsNewFlow } from '../whatsNew/flow';
import type { WhatsNewRelease } from '../whatsNew/schema';

function release(version: string, count = 2): WhatsNewRelease {
  return {
    version,
    pages: Array.from({ length: count }, (_, index) => ({
      id: `p${index}`,
      blocks: [{ id: 'info', type: 'info', titleKey: 'whatsNew.title' }],
    })),
  };
}
const releases = [release('2.13.0'), release('2.14.0'), release('2.15.0')];
test('merges skipped releases oldest-first and excludes seen and future releases', () => {
  const flow = selectWhatsNewFlow({ releases, seenThrough: '2.13.0', currentVersion: '2.14.0' });
  expect(flow.releaseVersions).toEqual(['2.14.0']);
  expect(flow.pages.map((p) => p.key)).toEqual(['2.14.0:p0', '2.14.0:p1']);
  expect(
    selectWhatsNewFlow({ releases, seenThrough: null, currentVersion: '2.15.0' }).releaseVersions
  ).toEqual(['2.13.0', '2.14.0', '2.15.0']);
});
test('fills the cap from newest releases while keeping page order within releases', () => {
  const flow = selectWhatsNewFlow({
    releases: [...releases].reverse(),
    seenThrough: null,
    currentVersion: '2.15.0',
    maxPages: 3,
  });
  expect(flow.pages.map((p) => p.key)).toEqual(['2.14.0:p0', '2.15.0:p0', '2.15.0:p1']);
  expect(flow.truncated).toBe(true);
});
test('superseded content frees capacity and empty pages/releases disappear', () => {
  const old = release('2.13.0', 3);
  old.pages[0].supersededIn = '2.14.0';
  old.pages[1].blocks[0].supersededIn = '2.14.0';
  expect(
    selectWhatsNewFlow({ releases: [old], currentVersion: '2.13.1', seenThrough: null }).pages
  ).toHaveLength(3);
  expect(
    selectWhatsNewFlow({ releases: [old], currentVersion: '2.14.0', seenThrough: null }).pages.map(
      (p) => p.key
    )
  ).toEqual(['2.13.0:p2']);
});
test('handles patches, downgrades, invalid app versions and zero capacity', () => {
  const patch = release('2.13.1');
  expect(
    selectWhatsNewFlow({ releases: [patch], seenThrough: '2.13.0', currentVersion: '2.13.1-beta' })
      .pages
  ).toHaveLength(2);
  expect(
    selectWhatsNewFlow({ releases, seenThrough: '3.0.0', currentVersion: '2.15.0' }).pages
  ).toEqual([]);
  expect(selectWhatsNewFlow({ releases, seenThrough: null, currentVersion: 'bad' }).pages).toEqual(
    []
  );
  expect(
    selectWhatsNewFlow({ releases, seenThrough: null, currentVersion: '2.15.0', maxPages: 0 }).pages
  ).toEqual([]);
});
test('replays the newest live release, regardless of history, capped', () => {
  const newest = release('2.14.0', 1);
  newest.pages[0].supersededIn = '2.15.0';
  expect(
    selectReplayFlow({
      releases: [release('2.13.0', 7), newest, release('3.0.0')],
      currentVersion: '2.15.0',
    })
  ).toMatchObject({ releaseVersions: ['2.13.0'], truncated: true });
  expect(selectReplayFlow({ releases, currentVersion: '1.0.0' }).pages).toEqual([]);
  expect(selectReplayFlow({ releases, currentVersion: 'bad' }).pages).toEqual([]);
});
