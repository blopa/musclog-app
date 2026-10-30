import {
  pageHeadlineDetailKeys,
  pageHeadlineKey,
  selectReplayFlow,
  selectWhatsNewFlow,
} from '../whatsNew/flow';
import type { WhatsNewBlock, WhatsNewRelease } from '../whatsNew/schema';

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
      releases: [release('2.13.0', 13), newest, release('3.0.0')],
      currentVersion: '2.15.0',
    })
  ).toMatchObject({ releaseVersions: ['2.13.0'], truncated: true });
  expect(selectReplayFlow({ releases, currentVersion: '1.0.0' }).pages).toEqual([]);
  expect(selectReplayFlow({ releases, currentVersion: 'bad' }).pages).toEqual([]);
});

describe('first production release with the tour (2.15.2)', () => {
  // The real registry, not a fixture: this is the promise made to every user who updates.
  const { whatsNewReleases } = jest.requireActual('@/data/whatsNew/releases') as {
    whatsNewReleases: WhatsNewRelease[];
  };

  test.each([
    ['no record at all (every release before the tour existed)', null],
    ['a garbage record', 'not-a-version'],
    ['a 2.13.0 test build that already marked itself seen', '2.13.0'],
    ['the last release before the tour, 2.12.3', '2.12.3'],
  ])('shows the tour to a user updating with %s', (_label, seenThrough) => {
    const flow = selectWhatsNewFlow({
      releases: whatsNewReleases,
      seenThrough,
      currentVersion: '2.15.2',
    });
    expect(flow.releaseVersions).toEqual(['2.15.2']);
    expect(flow.pages.length).toBeGreaterThan(0);
  });

  test('does not show it again once the user is on 2.15.2 or later', () => {
    for (const seenThrough of ['2.15.2', '2.16.0']) {
      expect(
        selectWhatsNewFlow({ releases: whatsNewReleases, seenThrough, currentVersion: '2.15.2' })
          .pages
      ).toEqual([]);
    }
  });
});

describe('pageHeadlineKey', () => {
  const page = (blocks: any[]) => ({ key: 'p', version: '2.13.1', blocks });

  it('names a page by its first heading', () => {
    expect(
      pageHeadlineKey(
        page([
          { id: 'a', type: 'info', titleKey: 'whatsNew.first' },
          { id: 'b', type: 'info', titleKey: 'whatsNew.second' },
        ])
      )
    ).toBe('whatsNew.first');
  });

  it('uses an action label when the page has no heading, and skips an untitled list', () => {
    expect(
      pageHeadlineKey(
        page([
          { id: 'list', type: 'featureList', items: [] },
          { id: 'go', type: 'action', action: 'openWorkoutSettings', labelKey: 'whatsNew.go' },
        ])
      )
    ).toBe('whatsNew.go');
  });

  it('returns null for a page with nothing to name it', () => {
    expect(pageHeadlineKey(page([{ id: 'list', type: 'featureList', items: [] }]))).toBeNull();
  });
});

describe('pageHeadlineDetailKeys', () => {
  const page = (blocks: WhatsNewBlock[]) => ({ key: 'p', version: '2.13.1', blocks });

  it('lists the item labels under a feature list headline', () => {
    expect(
      pageHeadlineDetailKeys(
        page([
          {
            id: 'list',
            type: 'featureList',
            titleKey: 'whatsNew.also',
            items: [
              { id: 'a', icon: 'heart', labelKey: 'whatsNew.a', descriptionKey: 'whatsNew.ad' },
              { id: 'b', icon: 'heart', labelKey: 'whatsNew.b', descriptionKey: 'whatsNew.bd' },
            ],
          },
        ])
      )
    ).toEqual(['whatsNew.a', 'whatsNew.b']);
  });

  it.each<WhatsNewBlock>([
    { id: 'info', type: 'info', titleKey: 'whatsNew.first', descriptionKey: 'whatsNew.detail' },
    {
      id: 'choice',
      type: 'choice',
      setting: 'workoutView',
      titleKey: 'whatsNew.first',
      descriptionKey: 'whatsNew.detail',
    },
    {
      id: 'action',
      type: 'action',
      action: 'openWorkoutSettings',
      labelKey: 'whatsNew.first',
      descriptionKey: 'whatsNew.detail',
    },
  ])('uses the description of a $type headline', (block) => {
    expect(pageHeadlineDetailKeys(page([block]))).toEqual(['whatsNew.detail']);
  });

  it('does not borrow another block’s description when the headline has none', () => {
    expect(
      pageHeadlineDetailKeys(
        page([
          { id: 'a', type: 'info', titleKey: 'whatsNew.first' },
          { id: 'b', type: 'info', titleKey: 'whatsNew.second', descriptionKey: 'whatsNew.detail' },
        ])
      )
    ).toEqual([]);
  });

  it('skips untitled blocks and returns no detail for a page without a headline', () => {
    const untitled: WhatsNewBlock = { id: 'list', type: 'featureList', items: [] };
    expect(pageHeadlineDetailKeys(page([untitled]))).toEqual([]);
    expect(
      pageHeadlineDetailKeys(
        page([
          untitled,
          { id: 'a', type: 'info', titleKey: 'whatsNew.first', descriptionKey: 'whatsNew.detail' },
        ])
      )
    ).toEqual(['whatsNew.detail']);
  });

  it('explains every page of the published tour, including the Also new features', () => {
    const { whatsNewReleases } = jest.requireActual('@/data/whatsNew/releases') as {
      whatsNewReleases: WhatsNewRelease[];
    };
    const flow = selectReplayFlow({
      releases: whatsNewReleases,
      currentVersion: '2.15.2',
      context: { cycleTracking: true },
    });
    const details = flow.pages.map(pageHeadlineDetailKeys);
    expect(details).toHaveLength(12);
    expect(details.every((keys) => keys.length > 0)).toBe(true);
    expect(details[5]).toEqual([
      'whatsNew.releases.v2_15_2.also.plans.label',
      'whatsNew.releases.v2_15_2.also.cardio.label',
      'whatsNew.releases.v2_15_2.also.swaps.label',
      'whatsNew.releases.v2_15_2.also.restrictions.label',
      'whatsNew.releases.v2_15_2.also.warmups.label',
    ]);
  });
});

describe('conditional pages', () => {
  const gated: WhatsNewRelease = {
    version: '2.14.0',
    pages: [
      { id: 'all', blocks: [{ id: 'info', type: 'info', titleKey: 'whatsNew.title' }] },
      {
        id: 'cycle',
        requires: 'cycleTracking',
        blocks: [{ id: 'info', type: 'info', titleKey: 'whatsNew.title' }],
      },
    ],
  };
  const keys = (context?: { cycleTracking: boolean }) =>
    selectWhatsNewFlow({
      releases: [gated],
      seenThrough: null,
      currentVersion: '2.14.0',
      context,
    }).pages.map((p) => p.key);

  test('hides a gated page unless its condition holds', () => {
    expect(keys()).toEqual(['2.14.0:all']);
    expect(keys({ cycleTracking: false })).toEqual(['2.14.0:all']);
    expect(keys({ cycleTracking: true })).toEqual(['2.14.0:all', '2.14.0:cycle']);
  });

  test('replay applies the same gate', () => {
    const replay = (context?: { cycleTracking: boolean }) =>
      selectReplayFlow({ releases: [gated], currentVersion: '2.14.0', context }).pages.length;
    expect(replay()).toBe(1);
    expect(replay({ cycleTracking: true })).toBe(2);
  });

  test('a release whose only page is gated yields no flow without the condition', () => {
    const only = { ...gated, pages: [gated.pages[1]] };
    expect(
      selectWhatsNewFlow({ releases: [only], seenThrough: null, currentVersion: '2.14.0' }).pages
    ).toEqual([]);
  });
});
