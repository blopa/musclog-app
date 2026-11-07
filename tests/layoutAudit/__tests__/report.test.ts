import fs from 'fs';
import os from 'os';
import path from 'path';

import {
  aggregate,
  markSharedChrome,
  CHROME_SCOPE_NAME,
  BASELINE_PATH,
  baselineFrom,
  emptyBaseline,
  fingerprint,
  newErrors,
  readBaseline,
  readShards,
  renderMarkdown,
  writeReport,
  type ShardEntry,
} from '../report';
import { buildViewerData } from '../reportHtml';
import type { Finding } from '../types';

function finding(overrides: Partial<Finding> = {}): Finding {
  return {
    kind: 'overlap',
    severity: 'error',
    message: 'text "/180g" overlaps text "99"',
    labels: ['/180g', '99'],
    paths: ['div', 'div'],
    rects: [],
    ...overrides,
  };
}

function entry(overrides: Partial<ShardEntry> = {}): ShardEntry {
  return {
    platform: 'web',
    profile: '344x882-fs1.3',
    locale: 'en-US',
    fontScale: 1.3,
    viewport: { width: 264, height: 678 },
    surface: 'screen',
    group: 'screens',
    name: 'food',
    url: 'http://localhost:8081/app/nutrition/food',
    status: 'audited',
    pass: 'top',
    findings: [finding()],
    ...overrides,
  };
}

describe('fingerprint', () => {
  it('is independent of order, case, spacing and everything about the profile', () => {
    const a = fingerprint(finding({ labels: ['/180g', '99'] }), 'screen', 'food');
    const b = fingerprint(finding({ labels: ['99', ' /180G '] }), 'screen', 'food');
    expect(a).toBe(b);
    expect(a).toBe('overlap|screen|food|/180g|99');
  });

  it('separates different screens and different kinds', () => {
    const base = fingerprint(finding(), 'screen', 'food');
    expect(fingerprint(finding(), 'screen', 'home')).not.toBe(base);
    expect(fingerprint(finding({ kind: 'occluded' }), 'screen', 'food')).not.toBe(base);
    expect(fingerprint(finding(), 'modal', 'food')).not.toBe(base);
  });
});

describe('aggregate', () => {
  it('merges one defect seen on several profiles and locales into one finding', () => {
    const report = aggregate([
      entry({ profile: '344x882-fs1.3', locale: 'en-US' }),
      entry({ profile: '360x772-fs1.3', locale: 'en-US' }),
      entry({ profile: '344x882-fs1.3', locale: 'ru-RU' }),
      entry({ profile: '344x882-fs1.3', locale: 'ru-RU' }), // the same pass twice
    ]);
    expect(report.groups).toHaveLength(1);
    expect(report.groups[0].occurrences).toHaveLength(3);
    expect(report.profiles).toEqual(['344x882-fs1.3', '360x772-fs1.3']);
    expect(report.locales).toEqual(['en-US', 'ru-RU']);
  });

  it('keeps the worst severity and orders errors before warnings, then by reach', () => {
    const warn = finding({
      kind: 'clipped',
      severity: 'warn',
      labels: ['x'],
      message: 'x clipped',
    });
    const report = aggregate([
      entry({ findings: [warn] }),
      entry({
        profile: 'b',
        findings: [warn, finding({ kind: 'clipped', severity: 'error', labels: ['x'] })],
      }),
      entry({
        name: 'home',
        findings: [finding({ kind: 'tight-gap', severity: 'warn', labels: ['a'] })],
      }),
    ]);
    expect(report.groups[0]).toMatchObject({ kind: 'clipped', severity: 'error' });
    expect(report.groups.at(-1)?.severity).toBe('warn');
  });

  it('ranks screens by errors, then warnings, and lists the profiles that hurt', () => {
    const report = aggregate([
      entry({ name: 'food', findings: [finding(), finding({ kind: 'occluded', labels: ['z'] })] }),
      entry({
        name: 'home',
        findings: [finding({ kind: 'clipped', severity: 'warn', labels: ['y'] })],
      }),
    ]);
    expect(report.screens.map((screen) => screen.name)).toEqual(['food', 'home']);
    expect(report.screens[0]).toMatchObject({ errors: 2, warnings: 0 });
    expect(report.screens[0].profilesAffected).toEqual(['344x882-fs1.3']);
  });

  it('counts a note against a screen without calling the profile affected', () => {
    const report = aggregate([
      entry({ findings: [finding({ kind: 'truncated', severity: 'info', labels: ['n'] })] }),
    ]);
    expect(report.screens[0]).toMatchObject({ errors: 0, warnings: 0, infos: 1 });
    expect(report.screens[0].profilesAffected).toEqual([]);
  });

  it('records redirects and skips as coverage notes', () => {
    const report = aggregate([
      entry({
        name: 'ai-chat',
        status: 'redirected',
        note: 'redirected to /app/onboarding/landing',
        findings: [],
      }),
    ]);
    expect(report.screens[0].statuses.redirected).toBe(1);
    expect(report.screens[0].notes).toEqual(['redirected to /app/onboarding/landing']);
    expect(renderMarkdown(report)).toContain('**ai-chat** — redirected to /app/onboarding/landing');
  });
});

describe('baseline', () => {
  it('accepts a known finding, so a strict run only fails on new errors', () => {
    const key = fingerprint(finding(), 'screen', 'food');
    const accepted = aggregate([entry()], { version: 1, accepted: { [key]: 'known, tracked' } });
    expect(accepted.groups[0].accepted).toBe(true);
    expect(newErrors(accepted)).toEqual([]);
    expect(accepted.screens[0].errors).toBe(0);

    const fresh = aggregate([entry()], emptyBaseline());
    expect(newErrors(fresh)).toHaveLength(1);
  });

  it('builds a baseline of errors and warnings, keeping existing reasons and skipping notes', () => {
    const key = fingerprint(finding(), 'screen', 'food');
    const report = aggregate([
      entry({
        findings: [finding(), finding({ kind: 'truncated', severity: 'info', labels: ['n'] })],
      }),
    ]);
    const baseline = baselineFrom(report, { version: 1, accepted: { [key]: 'because' } });
    expect(baseline.accepted).toEqual({ [key]: 'because' });
  });

  it('reads a missing or malformed baseline as accepting nothing', () => {
    expect(readBaseline('/nonexistent/baseline.json')).toEqual(emptyBaseline());
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'la-baseline-')), 'b.json');
    fs.writeFileSync(file, '{ "version": 2 }');
    expect(readBaseline(file)).toEqual(emptyBaseline());
  });
});

describe('shards and markdown', () => {
  it('reads every shard in a directory and writes the report beside it', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'la-shards-'));
    fs.writeFileSync(path.join(dir, 'a.json'), JSON.stringify([entry()]));
    fs.writeFileSync(path.join(dir, 'b.json'), JSON.stringify([entry({ name: 'home' })]));
    fs.writeFileSync(path.join(dir, 'ignored.txt'), 'x');
    const entries = readShards(dir);
    expect(entries.map((e) => e.name).sort()).toEqual(['food', 'home']);

    const report = aggregate(entries, emptyBaseline(), new Date('2026-11-06T12:00:00Z'));
    writeReport(report, dir);
    expect(fs.readFileSync(path.join(dir, 'report.md'), 'utf8')).toContain('# Layout audit');
    expect(JSON.parse(fs.readFileSync(path.join(dir, 'report.json'), 'utf8')).generatedAt).toBe(
      '2026-11-06T12:00:00.000Z'
    );
  });

  it('renders the summary, the risk table and the findings by screen', () => {
    const markdown = renderMarkdown(
      aggregate(
        [entry({ screenshot: 'screens/x.png' })],
        emptyBaseline(),
        new Date('2026-11-06T12:00:00Z')
      )
    );
    expect(markdown).toContain('**1 errors, 0 warnings, 0 notes**');
    expect(markdown).toContain('| screen: food | 1 | 0 | 0 | 344x882-fs1.3 |');
    expect(markdown).toContain('#### screen: food');
    expect(markdown).toContain('[screenshot](screens/x.png)');
    expect(markdown).toContain('Every listed screen was audited at least once.');
  });
});

describe('app chrome', () => {
  const chromeFinding = (labels: string[] = ['Entrenamientos', 'Abrir cámara']) =>
    finding({ chrome: true, labels, message: 'Entrenamientos overlaps Abrir cámara' });

  it('files one defect in the shared bar once, however many screens show it', () => {
    const report = aggregate([
      entry({ name: 'food', findings: [chromeFinding()] }),
      entry({ name: 'home', findings: [chromeFinding()] }),
      entry({ name: 'notes', profile: 'b', findings: [chromeFinding()] }),
    ]);
    expect(report.groups).toHaveLength(1);
    expect(report.groups[0]).toMatchObject({ surface: 'screen', name: CHROME_SCOPE_NAME });
    expect(report.screens.find((screen) => screen.name === CHROME_SCOPE_NAME)?.errors).toBe(1);
    // The screens it was seen on keep no error of their own.
    expect(report.screens.find((screen) => screen.name === 'food')?.errors).toBe(0);
  });

  it('keeps chrome findings of a modal with the modal: a modal is a fixed layer itself', () => {
    const modal = entry({
      surface: 'modal',
      group: 'modals',
      name: 'Open Add Food Modal',
      findings: [chromeFinding()],
    });
    expect(aggregate([modal]).groups[0]).toMatchObject({
      surface: 'modal',
      name: 'Open Add Food Modal',
    });
  });

  it('fingerprints by scope, so one baseline entry accepts it on every screen', () => {
    const a = fingerprint(chromeFinding(), 'screen', 'food');
    expect(fingerprint(chromeFinding(), 'screen', 'home')).toBe(a);
    expect(
      fingerprint(finding({ labels: ['Entrenamientos', 'Abrir cámara'] }), 'screen', 'home')
    ).not.toBe(a);
  });
});

describe('markSharedChrome', () => {
  const onScreens = (names: string[], overrides: Partial<Finding> = {}) =>
    names.map((name) => entry({ name, findings: [finding(overrides)] }));

  it('treats a finding on three or more screens as one shared component', () => {
    const marked = markSharedChrome(onScreens(['food', 'home', 'progress']));
    expect(marked.every((item) => item.findings[0].chrome === true)).toBe(true);
    expect(aggregate(onScreens(['food', 'home', 'progress'])).groups).toHaveLength(1);
  });

  it('leaves a finding on one or two screens with those screens', () => {
    const marked = markSharedChrome(onScreens(['food', 'home']));
    expect(marked.every((item) => item.findings[0].chrome !== true)).toBe(true);
    expect(aggregate(onScreens(['food', 'home'])).groups).toHaveLength(2);
  });

  it('counts screens, not profiles or languages', () => {
    const many = ['en-US', 'ru-RU', 'nl-NL'].map((locale) => entry({ locale }));
    expect(markSharedChrome(many).every((item) => item.findings[0].chrome !== true)).toBe(true);
  });

  it('keeps what the page itself reported as fixed, whatever the count', () => {
    const [only] = markSharedChrome([entry({ findings: [finding({ chrome: true })] })]);
    expect(only.findings[0].chrome).toBe(true);
  });

  it('never touches a modal', () => {
    const modals = ['A', 'B', 'C', 'D'].map((name) =>
      entry({ surface: 'modal', group: 'modals', name })
    );
    expect(markSharedChrome(modals).every((item) => item.findings[0].chrome !== true)).toBe(true);
  });

  it('does not change the entries it was given', () => {
    const input = onScreens(['food', 'home', 'progress']);
    markSharedChrome(input);
    expect(input[0].findings[0].chrome).toBeUndefined();
  });

  it('puts it in the viewer data too, so the page and the report agree', () => {
    const data = buildViewerData(onScreens(['food', 'home', 'progress']));
    expect(data.entries.every((item) => item.findings[0].c)).toBe(true);
  });
});

describe('the committed baseline', () => {
  const baseline = readBaseline(BASELINE_PATH);

  it('is read as a version-1 baseline, not discarded as malformed', () => {
    expect(baseline.version).toBe(1);
    expect(Object.keys(baseline.accepted).length).toBeGreaterThan(0);
  });

  it('gives every accepted finding a reason: an unexplained entry is a finding hidden, not accepted', () => {
    const unexplained = Object.entries(baseline.accepted)
      .filter(([, reason]) => reason.trim().length < 30)
      .map(([key]) => key);
    expect(unexplained).toEqual([]);
  });

  it('accepts only errors by fingerprint shape (kind|surface|screen|labels)', () => {
    const malformed = Object.keys(baseline.accepted).filter(
      (key) => key.split('|').length < 4 || !/^[a-z-]+\|(screen|modal)\|/.test(key)
    );
    expect(malformed).toEqual([]);
  });
});
