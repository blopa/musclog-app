import fs from 'node:fs';
import path from 'node:path';

const PROJECT_ROOT = path.resolve(__dirname, '../..');

type BuildProfile = { extends?: string; node?: string };

function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, file), 'utf8')) as T;
}

function resolveNode(profiles: Record<string, BuildProfile>, name: string): string | undefined {
  const profile = profiles[name];
  return profile.node ?? (profile.extends ? resolveNode(profiles, profile.extends) : undefined);
}

function major(version: string): string {
  return version.replace(/^v/, '').split('.')[0];
}

// EAS reads neither `.nvmrc` nor `engines`: a profile without `node` builds on the
// image default (Node 22 / npm 10), whose npm resolves optional peers differently
// from the npm 11 that writes our lockfile, and `npm ci` rejects it as out of sync.
describe('Node version pin', () => {
  const engineMajor = major(readJson<{ engines: { node: string } }>('package.json').engines.node);

  it('pins an exact Node version for every EAS build profile, matching engines', () => {
    const { build } = readJson<{ build: Record<string, BuildProfile> }>('eas.json');

    for (const name of Object.keys(build)) {
      const node = resolveNode(build, name);
      expect({ name, node }).toEqual({ name, node: expect.stringMatching(/^\d+\.\d+\.\d+$/) });
      expect({ name, major: major(node!) }).toEqual({ name, major: engineMajor });
    }
  });

  it('uses the same Node major in .nvmrc and GitHub workflows', () => {
    expect(major(fs.readFileSync(path.join(PROJECT_ROOT, '.nvmrc'), 'utf8').trim())).toBe(
      engineMajor
    );

    const workflowsDir = path.join(PROJECT_ROOT, '.github/workflows');
    for (const file of fs.readdirSync(workflowsDir)) {
      const source = fs.readFileSync(path.join(workflowsDir, file), 'utf8');
      for (const [, version] of source.matchAll(/node-version:\s*['"]?([\w.]+)/g)) {
        expect({ file, major: major(version) }).toEqual({ file, major: engineMajor });
      }
    }
  });
});
