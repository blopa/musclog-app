import {
  compareVersions,
  nextSeenThrough,
  parseAppVersion,
  parseVersion,
} from '../whatsNew/version';

test.each([
  '1.2',
  'v1.2.3',
  '1.2.3-beta',
  '1.2.3+build',
  '01.2.3',
  '-1.0.0',
  '',
  '9007199254740992.0.0',
  null,
])('rejects invalid strict version %s', (value) => {
  expect(parseVersion(value)).toBeNull();
});
test('parses numeric releases and app suffixes', () => {
  expect(parseVersion('2.13.0')).toEqual([2, 13, 0]);
  expect(parseAppVersion('2.13.1-beta.2')).toEqual([2, 13, 1]);
  expect(parseAppVersion('invalid')).toBeNull();
  expect(compareVersions('2.9.0', '2.13.0')).toBe(-1);
  expect(compareVersions('3.0.0', '2.99.99')).toBe(1);
  expect(compareVersions('2.13.0', '2.13.0-beta')).toBe(0);
  expect(() => compareVersions('bad', '1.0.0')).toThrow();
});
test('normalizes seen records without ever moving backwards', () => {
  expect(nextSeenThrough('3.0.0', '2.13.1')).toBe('3.0.0');
  expect(nextSeenThrough(null, '2.13.1-dev')).toBe('2.13.1');
  expect(nextSeenThrough('bad', '2.13.1')).toBe('2.13.1');
  expect(() => nextSeenThrough(null, 'bad')).toThrow();
});
