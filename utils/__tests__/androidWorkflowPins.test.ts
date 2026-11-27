import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');

const AAB = '.github/workflows/build-android-aab.yml';
const APK = '.github/workflows/release-android-apk.yml';
const SETUP = '.github/actions/setup-android-build/action.yml';
const GPLAY_SHA256 = 'e951a13d8a35bdab43e8b4ba25ab22e45bb1487a7d27ae5b97faf2f9bb66c72e';

/** The value of every `uses:` line in a workflow or action file. */
function usesRefs(source: string): string[] {
  return source
    .split('\n')
    .map((line) => line.match(/^\s*(?:-\s+)?uses:\s*(\S+)/))
    .filter((match): match is RegExpMatchArray => match !== null)
    .map((match) => match[1]);
}

describe('Android workflow pins', () => {
  it.each([AAB, APK, SETUP])('pins every third-party action in %s by commit SHA', (file) => {
    const refs = usesRefs(read(file));

    expect(refs.length).toBeGreaterThan(0);
    for (const ref of refs) {
      const local = ref.startsWith('./.github/');
      const pinned = /@[0-9a-f]{40}$/.test(ref);
      expect({ file, ref, ok: local || pinned }).toEqual({ file, ref, ok: true });
    }
  });

  it('verifies the gplay download against its SHA-256 before installing it', () => {
    const source = read(AAB);
    const verify = source.indexOf('sha256sum -c -');
    const install = source.indexOf('install -m 755');

    expect(source).toContain(GPLAY_SHA256);
    expect(verify).toBeGreaterThan(-1);
    expect(install).toBeGreaterThan(verify);
    expect(source).toContain(
      'https://github.com/tamtom/play-console-cli/releases/download/v1.0.2/gplay-linux-amd64'
    );
    expect(source).not.toContain('install.sh');
  });

  it.each([AAB, APK])('runs the shared setup from %s after checkout', (file) => {
    const source = read(file);

    expect(source).toContain('uses: ./.github/actions/setup-android-build');
    expect(source.indexOf('actions/checkout@')).toBeLessThan(
      source.indexOf('uses: ./.github/actions/setup-android-build')
    );
  });
});
