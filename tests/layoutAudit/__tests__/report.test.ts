import fs from 'fs';
import os from 'os';
import path from 'path';

import {
  aggregate,
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
