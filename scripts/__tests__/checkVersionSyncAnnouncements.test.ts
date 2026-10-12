/* eslint-disable @typescript-eslint/no-require-imports */
let mockFiles = ['2.13.0.json'];
let mockVersion = '2.12.5';
jest.mock('fs', () => ({ existsSync: () => true, readdirSync: () => mockFiles }));
jest.mock('../bump', () => ({ assertReleaseVersionsMatch: () => ({ appVersion: mockVersion, appBuild: 123 }) }));

test('warns for future announcements without failing version sync', () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
  mockFiles = ['2.9.0.json', '2.13.0.json', 'releases.ts'];
  mockVersion = '2.12.5';
  jest.isolateModules(() => { expect(() => require('../check-version-sync')).not.toThrow(); });
  expect(warn).toHaveBeenCalledWith(expect.stringContaining("2.13.0 is newer than 2.12.5: this announcement won't show in this release"));
  warn.mockClear();
  mockVersion = '2.13.0';
  jest.isolateModules(() => require('../check-version-sync'));
  expect(warn).not.toHaveBeenCalled();
  warn.mockRestore(); log.mockRestore();
});
