import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

const root = join(__dirname, '..', '..');
const CC0_URL = 'https://creativecommons.org/publicdomain/zero/1.0/';

function read(path: string): string {
  return readFileSync(join(root, path), 'utf8');
}

function files(dir: string, extension: string): string[] {
  return readdirSync(join(root, dir), { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);

    if (entry.isDirectory()) {
      return files(path, extension);
    }

    return entry.name.endsWith(extension) ? [path] : [];
  });
}

describe('Loggy artwork license (CC0)', () => {
  const license = read('assets/avatars/LOGGY_LICENSE.txt');

  it('ships the CC0 1.0 legal code with the scope in front of it', () => {
    expect(license).toContain('SPDX-License-Identifier: CC0-1.0');
    expect(license).toContain('What this covers');
    expect(license).toContain('What this does not cover');
    // The scope names the folders it covers, so a renamed or new one has to be added here.
    for (const covered of [
      'assets/avatars/loggy-parts/',
      'assets/avatars/loggy-poses/',
      'assets/avatars/loggy-animated/',
      'public/images/loggy/',
      'components/loggy/animated/',
    ]) {
      expect(license).toContain(covered);
    }
    // The legal code itself, not a paraphrase of it.
    expect(license).toContain('Creative Commons Legal Code');
    expect(license).toContain('CC0 1.0 Universal');
    expect(license).toContain('No trademark or patent rights held by Affirmer are waived');
  });

  it('names what it does not cover: the brand, the persona pictures and the code', () => {
    expect(license).toMatch(/Musclog name, logos and app icon/);
    expect(license).toContain('dracula.png');
    expect(license).toContain('GPL-3.0-or-later');
  });

  it('is in every generated SVG, so the notice travels with a downloaded file', () => {
    const svgs = [
      ...files('assets/avatars/loggy-poses', '.svg'),
      ...files('assets/avatars/loggy-animated', '.svg'),
      ...files('public/images/loggy', '.svg'),
    ];

    expect(svgs.length).toBeGreaterThan(0);

    for (const svg of svgs) {
      expect({ file: svg, notice: read(svg).includes(CC0_URL) }).toEqual({
        file: svg,
        notice: true,
      });
    }
  });

  it('is named in the header of every generated animated component', () => {
    const components = files('components/loggy/animated', '.tsx');

    expect(components.length).toBeGreaterThan(0);

    for (const component of components) {
      expect({ file: component, notice: read(component).includes('LOGGY_LICENSE.txt') }).toEqual({
        file: component,
        notice: true,
      });
    }
  });

  it('is stated in the README and in AGENTS.md, where the next contributor looks', () => {
    expect(read('README.md')).toContain('LOGGY_LICENSE.txt');
    expect(read('AGENTS.md')).toContain('assets/avatars/LOGGY_LICENSE.txt');
  });
});
