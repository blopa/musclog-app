import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '..', '..');

const { copyrightFromText, licenseOf, stripCopyrightLines } =
  require('../generate-open-source-notices') as {
    copyrightFromText: (text: string) => string;
    licenseOf: (pkg: Record<string, unknown>) => string;
    stripCopyrightLines: (text: string) => string;
  };

type Notices = {
  packages: {
    name: string;
    version: string;
    license: string;
    copyright: string;
    notice?: string;
  }[];
  texts: Record<string, string>;
};

const readNotices = (): Notices =>
  JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'openSourceNotices.json'), 'utf8'));

describe('generate-open-source-notices', () => {
  const notices = readNotices();
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')) as {
    dependencies: Record<string, string>;
  };

  it('lists every production dependency by name', () => {
    const names = new Set(notices.packages.map((entry) => entry.name));
    const missing = Object.keys(pkg.dependencies).filter((name) => !names.has(name));
    expect(missing).toEqual([]);
  });

  it('ships the MIT and Apache-2.0 licence texts', () => {
    expect(notices.texts.MIT).toContain('Permission');
    expect(notices.texts['Apache-2.0']).toContain('Apache License');
  });

  it('sorts packages by name then version, with a trailing newline', () => {
    const raw = fs.readFileSync(path.join(ROOT, 'data', 'openSourceNotices.json'), 'utf8');
    expect(raw.endsWith('\n')).toBe(true);
    const keys = notices.packages.map((entry) => `${entry.name}\u0000${entry.version}`);
    expect([...keys].sort()).toEqual(keys);
  });

  it('reads the licence from a string, an object or defaults it', () => {
    expect(licenseOf({ license: 'MIT' })).toBe('MIT');
    expect(licenseOf({ license: { type: 'ISC' } })).toBe('ISC');
    expect(licenseOf({})).toBe('see package');
  });

  it('takes the copyright line from a licence file, not the header', () => {
    expect(copyrightFromText('MIT License\n\nCopyright (c) 2020 Jane Doe\n')).toBe(
      'Copyright (c) 2020 Jane Doe'
    );
    expect(copyrightFromText('Permission is granted')).toBe('');
  });

  it('removes copyright lines from shared licence texts', () => {
    const stripped = stripCopyrightLines('Copyright (c) 2020 X\n\nPermission is hereby granted');
    expect(stripped).not.toMatch(/^Copyright/m);
    expect(stripped).toContain('Permission');
  });
});
