import { parseWhatsNewRelease } from '../whatsNew/schema';

const info = { id: 'intro', type: 'info', titleKey: 'whatsNew.title' };
function parse(blocks: unknown[]) {
  return parseWhatsNewRelease({ version: '2.13.0', pages: [{ id: 'page', blocks }] }, '2.13.0.json');
}
const options = [{ value: 'guided', labelKey: 'whatsNew.guided' }, { value: 'inline', labelKey: 'whatsNew.inline' }];
test.each([
  null, { ...info, type: 'unknown' }, { ...info, icon: 'unknown' }, { ...info, titleKey: 'other.title' },
  { ...info, descriptionKey: 'whatsNew.' }, { ...info, id: '' }, { ...info, supersededIn: 'bad' },
  { ...info, supersededIn: '2.12.0' }, { ...info, supersededIn: '2.13.0' },
  { id: 'action', type: 'action', action: 'deleteData', labelKey: 'whatsNew.title' },
  { ...info, type: 'choice', setting: 'secretSetting' },
  { ...info, type: 'choice', setting: 'workoutView' },
  { ...info, type: 'choice', setting: 'workoutView', options: [options[0]] },
  { ...info, type: 'choice', setting: 'workoutView', options: [options[0], options[0]] },
  { ...info, type: 'choice', setting: 'workoutView', options: [options[0], { ...options[1], value: 'bad' }] },
  { ...info, type: 'choice', setting: 'workoutView', options: [options[0], null] },
  { ...info, type: 'choice', setting: 'workoutView', options: [options[0], { ...options[1], labelKey: 'other.key' }] },
  { ...info, type: 'choice', setting: 'workoutView', options: [options[0], { ...options[1], icon: 'bad' }] },
  { ...info, type: 'choice', setting: 'autoStartRestTimer', options },
  { ...info, type: 'choice', setting: 'reviewWeekday', options: [] },
  { ...info, type: 'featureList', items: [] }, { ...info, type: 'featureList' },
])('drops malformed blocks and keeps valid siblings: %j', (block) => {
  const result = parse([block, { ...info, id: 'valid' }]);
  expect(result.issues.length).toBeGreaterThan(0);
  expect(result.release?.pages[0].blocks.map((b) => b.id)).toEqual(['valid']);
});
test('keeps supported block types, settings and optional fields', () => {
  const result = parse([
    { ...info, icon: 'sparkles', descriptionKey: 'whatsNew.copy', supersededIn: '2.14.0' },
    { id: 'choice', type: 'choice', titleKey: 'whatsNew.title', setting: 'workoutView', options },
    { id: 'boolean', type: 'choice', titleKey: 'whatsNew.title', setting: 'restTimerHaptics' },
    { id: 'weekday', type: 'choice', titleKey: 'whatsNew.title', setting: 'reviewWeekday' },
    { id: 'action', type: 'action', labelKey: 'whatsNew.title', action: 'openWorkoutSettings' },
  ]);
  expect(result.issues).toEqual([]);
  expect(result.release?.pages[0].blocks).toHaveLength(5);
});
test('drops duplicate page, block and feature ids, invalid items and empty pages', () => {
  const feature = { id: 'row', icon: 'heart', labelKey: 'whatsNew.title' };
  const result = parse([info, info, { id: 'features', type: 'featureList', items: [feature, feature, { ...feature, id: 'bad', action: 'deleteData' }, { ...feature, id: 'noIcon', icon: undefined }, null] }]);
  expect(result.release?.pages[0].blocks).toHaveLength(2);
  expect(result.release?.pages[0].blocks[1]).toMatchObject({ items: [feature] });
  expect(result.issues.length).toBe(5);
  const pages = [{ id: 'p', blocks: [info] }, { id: 'p', blocks: [info] }, { id: 'empty', blocks: [] }, { id: 'invalid', blocks: null }, null];
  const parsed = parseWhatsNewRelease({ version: '2.13.0', pages }, '2.13.0.json');
  expect(parsed.release?.pages).toHaveLength(1);
  expect(parsed.issues).toHaveLength(4);
});
test('reports unknown properties without discarding valid content', () => {
  const result = parse([{ ...info, titelKey: 'whatsNew.typo' }]);
  expect(result.issues).toEqual([expect.stringContaining('unknown property titelKey')]);
  expect(result.release?.pages).toHaveLength(1);
});
test('rejects wrong filenames and invalid release versions', () => {
  expect(parseWhatsNewRelease({ version: '2.13.0', pages: [] }, '2.14.0.json').release).toBeNull();
  expect(parseWhatsNewRelease({ version: 'invalid' }, 'invalid.json').release).toBeNull();
  expect(parseWhatsNewRelease(null, '2.13.0.json').release).toBeNull();
  expect(parseWhatsNewRelease({ version: '2.13.0', pages: [] }, '2.13.0.json').issues).not.toEqual([]);
});
