import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '..', '..');
const SCRIPTS = path.join(ROOT, 'scripts');

const tmpDirs: string[] = [];
function tmp(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'appstore-test-'));
  tmpDirs.push(dir);
  return dir;
}
afterAll(() => {
  for (const dir of tmpDirs) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function run(cmd: string, args: string[], env: Record<string, string> = {}) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', env: { ...process.env, ...env } });
  return { code: r.status, out: `${r.stdout}${r.stderr}` };
}

describe('shell scripts', () => {
  it.each([
    'setup-asc.sh',
    'release-ios.sh',
    'appstore.sh',
    'appstore-guard.sh',
    'lib/asc-common.sh',
  ])('%s parses', (file) => {
    expect(run('bash', ['-n', path.join(SCRIPTS, file)]).code).toBe(0);
  });

  it('asc-common reads the app id from eas.json and the version from app.json', () => {
    const eas = JSON.parse(fs.readFileSync(path.join(ROOT, 'eas.json'), 'utf8'));
    const app = JSON.parse(fs.readFileSync(path.join(ROOT, 'app.json'), 'utf8')).expo;
    const r = run('bash', [
      '-c',
      `source ${SCRIPTS}/lib/asc-common.sh; echo "$(asc_app_id) $(app_version) $(app_build_number) $(app_bundle_id)"`,
    ]);

    expect(r.out.trim()).toBe(
      `${eas.submit.production.ios.ascAppId} ${app.version} ${app.ios.buildNumber} ${app.ios.bundleIdentifier}`
    );
  });

  it('pins asc 6.3.0 and refuses an unknown profile name from the shell', () => {
    const r = run(
      'bash',
      [
        '-c',
        `source ${SCRIPTS}/lib/asc-common.sh; echo "$ASC_VERSION_PINNED $ASC_PROFILE_NAME $ASC_TELEMETRY_DISABLED $DO_NOT_TRACK"`,
      ],
      { ASC_PROFILE: 'someone-elses' }
    );

    expect(r.out.trim()).toBe('6.3.0 musclog 1 1');
  });
});

describe('appstore-guard-known.json', () => {
  const known = JSON.parse(fs.readFileSync(path.join(SCRIPTS, 'appstore-guard-known.json'), 'utf8'))
    .known as { id: string; file?: string; checked: string; reason: string }[];

  it('gives every entry an id, a dated check and a reason', () => {
    expect(known.length).toBeGreaterThan(0);
    for (const k of known) {
      expect(k.id).toMatch(/^[A-Z0-9.-]+$/);
      expect(k.checked).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(k.reason.length).toBeGreaterThan(40);
    }
  });

  it('never lists a Google, Android or web finding (the gate does not count them for iOS)', () => {
    for (const k of known) {
      expect(k.id).not.toMatch(/^(GOOGLE|ANDROID|WEB)-/);
    }
  });
});

describe('appstore_guard_gate.py', () => {
  const REPORT = (lines: string[], counts = 'critical=0 high=2 medium=0') =>
    [
      '== App Store Compliance Guard ==',
      ...lines,
      '',
      `Summary. ${counts}`,
      'Coverage. complete ios=1',
      '',
      'BLOCKED. test',
    ].join('\n');
  const finding = (sev: string, id: string, file: string) =>
    `  [${sev}]${' '.repeat(11 - sev.length)}${id}  A title\n      file. ${file}\n      fix. Do the thing.`;

  function gate(report: string, known: object[], args: string[] = []) {
    const dir = tmp();
    const guard = path.join(dir, 'guard.sh');
    fs.writeFileSync(guard, `#!/usr/bin/env bash\ncat <<'EOF'\n${report}\nEOF\nexit 2\n`);
    const knownFile = path.join(dir, 'known.json');
    fs.writeFileSync(knownFile, JSON.stringify({ known }));
    const project = path.join(dir, 'project');
    fs.mkdirSync(project);

    return run(
      'python3',
      ['-I', path.join(SCRIPTS, 'appstore_guard_gate.py'), '--tree', '--project', project, ...args],
      { APPSTORE_GUARD_SCRIPT: guard, APPSTORE_GUARD_KNOWN: knownFile }
    );
  }
  const entry = (id: string, file?: string) => ({
    id,
    ...(file ? { file } : {}),
    checked: '2026-11-18',
    reason: 'checked against the code',
  });

  it('fails on a high finding that is not known', () => {
    const r = gate(
      REPORT([finding('HIGH', 'APPLE-X', 'a.ts:1'), finding('HIGH', 'APPLE-Y', 'b.ts:2')]),
      [entry('APPLE-X')]
    );

    expect(r.code).toBe(1);
    expect(r.out).toContain('APPLE-Y');
    expect(r.out).toContain('<- BLOCKS');
    expect(r.out).toContain('<- known');
  });

  it('passes when every high finding is known, and still prints them', () => {
    const r = gate(
      REPORT([finding('HIGH', 'APPLE-X', 'a.ts:1'), finding('HIGH', 'APPLE-Y', 'b.ts:2')]),
      [entry('APPLE-X'), entry('APPLE-Y')]
    );

    expect(r.code).toBe(0);
    expect(r.out).toContain('APPLE-X');
    expect(r.out).toContain('known: checked against the code');
  });

  it('matches a known entry only inside its file prefix', () => {
    const report = REPORT(
      [finding('HIGH', 'APPLE-X', 'other/a.ts:1')],
      'critical=0 high=1 medium=0'
    );

    expect(gate(report, [entry('APPLE-X', 'utils/')]).code).toBe(1);
    expect(gate(report, [entry('APPLE-X', 'other/')]).code).toBe(0);
  });

  it('does not let a medium finding fail the default gate, but --fail-on medium does', () => {
    const report = REPORT([finding('MEDIUM', 'APPLE-M', 'a.ts:1')], 'critical=0 high=0 medium=1');

    expect(gate(report, []).code).toBe(0);
    expect(gate(report, [], ['--fail-on', 'medium']).code).toBe(1);
  });

  it('counts critical findings first', () => {
    const report = REPORT([finding('CRITICAL', 'APPLE-C', 'a.ts:1')], 'critical=1 high=0 medium=0');

    expect(gate(report, []).code).toBe(1);
    expect(gate(report, [], ['--fail-on', 'critical']).code).toBe(1);
  });

  it('prints Google, Android and web findings but gates on them only with --all-platforms', () => {
    const report = REPORT(
      [
        finding('HIGH', 'GOOGLE-ORG', 'a.tsx:1'),
        finding('HIGH', 'WEB-STORAGE', 'b.ts:1'),
        finding('HIGH', 'BOTH-UNSAFE-DEEPLINK', 'android/app/src/main/AndroidManifest.xml:51'),
      ],
      'critical=0 high=3 medium=0'
    );

    const ios = gate(report, []);
    expect(ios.code).toBe(0);
    expect(ios.out).toContain('GOOGLE-ORG');
    expect(ios.out).toContain('<- other store');
    expect(gate(report, [], ['--all-platforms']).code).toBe(1);
  });

  it('clears nothing when the guard did not scan', () => {
    expect(gate('NOT CHECKED. no buffer', []).code).toBe(2);
  });

  it('clears nothing when the report format no longer matches its own counts', () => {
    const r = gate(
      REPORT([finding('HIGH', 'APPLE-X', 'a.ts:1')], 'critical=0 high=3 medium=0'),
      []
    );

    expect(r.code).toBe(2);
    expect(r.out).toContain('report format changed');
  });

  it('rejects a known entry with no reason', () => {
    const r = gate(REPORT([], 'critical=0 high=0 medium=0'), [
      { id: 'APPLE-X', checked: '2026-11-18' },
    ]);

    expect(r.code).not.toBe(0);
    expect(r.out).toContain("no 'reason'");
  });
});

describe('appstore-listing-metadata.py', () => {
  function listing(files: Record<string, Record<string, string>>) {
    const dir = tmp();
    const play = path.join(dir, 'play');
    for (const [locale, texts] of Object.entries(files)) {
      fs.mkdirSync(path.join(play, locale), { recursive: true });
      for (const [name, text] of Object.entries(texts)) {
        fs.writeFileSync(path.join(play, locale, name), text);
      }
    }
    return { dir, play, out: path.join(dir, 'out') };
  }
  const good = {
    'title.txt': 'Musclog: Workout Log',
    'short_description.txt': 'Workout log & calorie counter.',
    'full_description.txt': '<b>Musclog</b>\n\n• Health Connect sync for weight.',
  };
  const convert = (l: { play: string; out: string }, extra: string[] = []) =>
    run('python3', [
      '-I',
      path.join(SCRIPTS, 'appstore-listing-metadata.py'),
      '--version',
      '9.9.9',
      '--listing',
      l.play,
      ...extra,
      l.out,
    ]);

  it('maps locales, strips Play markup and keeps limits', () => {
    const l = listing({ 'en-US': good, 'ru-RU': good, 'it-IT': good });
    const r = convert(l);

    expect(r.code).toBe(0);
    const en = JSON.parse(fs.readFileSync(path.join(l.out, 'version/9.9.9/en-US.json'), 'utf8'));
    expect(en.description).toBe('Musclog\n\n• Apple Health sync for weight.');
    expect(en.promotionalText).toBe('Workout log & calorie counter.');
    expect(en.supportUrl).toMatch(/^https:\/\/.+\/contact$/);
    const info = JSON.parse(fs.readFileSync(path.join(l.out, 'app-info/en-US.json'), 'utf8'));
    expect(info.name).toBe('Musclog: Workout Log');
    expect(info.privacyPolicyUrl).toMatch(/^https:\/\/.+\/privacy$/);
    // Apple writes Russian and Italian without a region.
    expect(fs.existsSync(path.join(l.out, 'version/9.9.9/ru.json'))).toBe(true);
    expect(fs.existsSync(path.join(l.out, 'app-info/it.json'))).toBe(true);
  });

  it('takes subtitle and keywords from listing-extra.json and trims keyword spaces', () => {
    const l = listing({ 'en-US': good });
    const extra = path.join(l.dir, 'extra.json');
    fs.writeFileSync(
      extra,
      JSON.stringify({
        'en-US': { subtitle: 'Lift, log, repeat', keywords: 'gym, workout ,macros' },
      })
    );
    const r = convert(l, ['--extra', extra]);

    expect(r.code).toBe(0);
    expect(
      JSON.parse(fs.readFileSync(path.join(l.out, 'app-info/en-US.json'), 'utf8')).subtitle
    ).toBe('Lift, log, repeat');
    expect(
      JSON.parse(fs.readFileSync(path.join(l.out, 'version/9.9.9/en-US.json'), 'utf8')).keywords
    ).toBe('gym,workout,macros');
  });

  it('writes whatsNew from listing-extra.json and enforces its limit', () => {
    const l = listing({ 'en-US': good });
    const extra = path.join(l.dir, 'extra.json');
    fs.writeFileSync(extra, JSON.stringify({ 'en-US': { whatsNew: 'Fixes and polish.' } }));

    expect(convert(l, ['--extra', extra]).code).toBe(0);
    expect(
      JSON.parse(fs.readFileSync(path.join(l.out, 'version/9.9.9/en-US.json'), 'utf8')).whatsNew
    ).toBe('Fixes and polish.');

    fs.writeFileSync(extra, JSON.stringify({ 'en-US': { whatsNew: 'x'.repeat(4001) } }));
    const l2 = listing({ 'en-US': good });

    expect(convert(l2, ['--extra', extra]).code).not.toBe(0);
  });

  it.each([
    ['names Android', { ...good, 'full_description.txt': 'Also on Android.' }, 'Android'],
    ['names Google Play', { ...good, 'short_description.txt': 'On Google Play.' }, 'Google Play'],
    ['has a 31 character title', { ...good, 'title.txt': 'x'.repeat(31) }, 'allows 30'],
  ])('refuses text that %s and writes nothing', (_name, files, message) => {
    const l = listing({ 'en-US': files });
    const r = convert(l);

    expect(r.code).not.toBe(0);
    expect(r.out).toContain(message);
    expect(fs.existsSync(l.out)).toBe(false);
  });

  it('refuses a Play locale it has no App Store locale for', () => {
    const l = listing({ 'xx-XX': good });
    const r = convert(l);

    expect(r.code).not.toBe(0);
    expect(r.out).toContain('xx-XX');
  });

  it('keeps fields it does not manage when it rewrites a file', () => {
    const l = listing({ 'en-US': good });
    fs.mkdirSync(path.join(l.out, 'version/9.9.9'), { recursive: true });
    fs.writeFileSync(
      path.join(l.out, 'version/9.9.9/en-US.json'),
      JSON.stringify({ whatsNew: 'Fixes', description: 'old' })
    );
    convert(l);

    const en = JSON.parse(fs.readFileSync(path.join(l.out, 'version/9.9.9/en-US.json'), 'utf8'));
    expect(en.whatsNew).toBe('Fixes');
    expect(en.description).not.toBe('old');
  });
});

describe('appstore.sh screenshots from-captures', () => {
  it('copies only the numbered captures into the locale folder', () => {
    const dir = tmp();
    const from = path.join(dir, 'captures');
    fs.mkdirSync(from);
    for (const f of ['01-home.png', '02-food.png', 'modal-01-open-x.png', 'notes.txt']) {
      fs.writeFileSync(path.join(from, f), 'x');
    }
    const shots = path.join(dir, 'shots');
    const r = run(
      'bash',
      [
        path.join(SCRIPTS, 'appstore.sh'),
        'screenshots',
        'from-captures',
        '--from',
        from,
        '--locale',
        'de-DE',
      ],
      { MUSCLOG_APPSTORE_SHOTS: shots }
    );

    expect(r.code).toBe(0);
    expect(fs.readdirSync(path.join(shots, 'de-DE', 'iphone')).sort()).toEqual([
      '01-home.png',
      '02-food.png',
    ]);
  });

  it('refuses a source folder with no numbered captures', () => {
    const dir = tmp();
    const r = run(
      'bash',
      [path.join(SCRIPTS, 'appstore.sh'), 'screenshots', 'from-captures', '--from', dir],
      { MUSCLOG_APPSTORE_SHOTS: path.join(dir, 'shots') }
    );

    expect(r.code).not.toBe(0);
    expect(r.out).toContain('no NN-name.png captures');
  });
});
