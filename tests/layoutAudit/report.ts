import fs from 'fs';
import path from 'path';

import { compareSeverity, worstSeverity } from './analyze';
import type { Finding, Severity, Viewport } from './types';

/** Where a run writes its shards, screenshots and the merged report. Gitignored. */
export const REPORT_DIR = path.resolve(process.cwd(), 'layout-audit-report');
export const SHARD_DIR = path.join(REPORT_DIR, 'shards');
export const SCREENSHOT_DIR = path.join(REPORT_DIR, 'screens');
/** Findings the team has looked at and accepted, so a strict run only fails on new ones. */
export const BASELINE_PATH = path.resolve(process.cwd(), 'tests', 'layoutAudit', 'baseline.json');

export type Surface = 'screen' | 'modal';
/** Where `report.html` files an entry: the three tests of the audit. */
export type ReportGroup = 'screens' | 'onboarding' | 'modals';
export type EntryStatus = 'audited' | 'redirected' | 'skipped' | 'failed';

/** One audited page or modal under one profile and locale. */
export interface ShardEntry {
  platform: 'web' | 'android';
  profile: string;
  locale: string;
  fontScale: number;
  viewport: Viewport;
  surface: Surface;
  group: ReportGroup;
  name: string;
  url: string;
  status: EntryStatus;
  /** Why it was not audited (a redirect target, a missing prerequisite, an error). */
  note?: string;
  /** `top` is the first screenful, `end` after scrolling the main scroller to its end. */
  pass: 'top' | 'end';
  findings: Finding[];
  /** Path relative to the report directory. */
  screenshot?: string;
}

export interface Baseline {
  version: 1;
  /** Fingerprint → why it is accepted. */
  accepted: Record<string, string>;
}

export interface Occurrence {
  profile: string;
  locale: string;
  pass: 'top' | 'end';
}

export interface GroupedFinding {
  fingerprint: string;
  kind: Finding['kind'];
  severity: Severity;
  surface: Surface;
  name: string;
  labels: string[];
  messages: string[];
  occurrences: Occurrence[];
  screenshot?: string;
  accepted: boolean;
}

export interface ScreenSummary {
  surface: Surface;
  name: string;
  errors: number;
  warnings: number;
  infos: number;
  /** Profiles that produced at least one error or warning for this screen. */
  profilesAffected: string[];
  /** Audit attempts for the screen, by status. */
  statuses: Record<EntryStatus, number>;
  notes: string[];
}

export interface Report {
  generatedAt: string;
  entries: number;
  profiles: string[];
  locales: string[];
  groups: GroupedFinding[];
  screens: ScreenSummary[];
}

const MAX_LABEL = 40;

/**
 * Stable across viewports so one defect seen on five profiles is one finding: the kind, the
 * screen and the labels involved, never a coordinate or a profile.
 */
export function fingerprint(finding: Finding, surface: Surface, name: string): string {
  const labels = finding.labels
    .map((label) => label.toLowerCase().replace(/\s+/g, ' ').trim().slice(0, MAX_LABEL))
    .sort();
  return [finding.kind, surface, name, ...labels].join('|');
}

export function emptyBaseline(): Baseline {
  return { version: 1, accepted: {} };
}

export function readBaseline(baselinePath = BASELINE_PATH): Baseline {
  try {
    const parsed = JSON.parse(fs.readFileSync(baselinePath, 'utf8')) as Partial<Baseline>;
    if (parsed.version === 1 && parsed.accepted && typeof parsed.accepted === 'object') {
      return { version: 1, accepted: parsed.accepted };
    }
  } catch {
    // A missing or unreadable baseline accepts nothing.
  }

  return emptyBaseline();
}

export function readShards(shardDir = SHARD_DIR): ShardEntry[] {
  if (!fs.existsSync(shardDir)) {
    return [];
  }

  return fs
    .readdirSync(shardDir)
    .filter((file) => file.endsWith('.json'))
    .flatMap(
      (file) => JSON.parse(fs.readFileSync(path.join(shardDir, file), 'utf8')) as ShardEntry[]
    );
}

export function aggregate(
  entries: ShardEntry[],
  baseline: Baseline = emptyBaseline(),
  now = new Date()
): Report {
  const groups = new Map<string, GroupedFinding>();
  const screens = new Map<string, ScreenSummary>();
  for (const entry of entries) {
    const screenKey = `${entry.surface}:${entry.name}`;
    const summary = screens.get(screenKey) ?? {
      surface: entry.surface,
      name: entry.name,
      errors: 0,
      warnings: 0,
      infos: 0,
      profilesAffected: [],
      statuses: { audited: 0, redirected: 0, skipped: 0, failed: 0 },
      notes: [],
    };
    screens.set(screenKey, summary);
    summary.statuses[entry.status] += 1;
    if (entry.note && !summary.notes.includes(entry.note)) {
      summary.notes.push(entry.note);
    }

    for (const finding of entry.findings) {
      const key = fingerprint(finding, entry.surface, entry.name);
      const group = groups.get(key) ?? {
        fingerprint: key,
        kind: finding.kind,
        severity: finding.severity,
        surface: entry.surface,
        name: entry.name,
        labels: finding.labels,
        messages: [],
        occurrences: [],
        screenshot: undefined,
        accepted: key in baseline.accepted,
      };
      groups.set(key, group);
      group.severity = worstSeverity([group.severity, finding.severity]);
      if (group.messages.length < 3 && !group.messages.includes(finding.message)) {
        group.messages.push(finding.message);
      }

      if (
        !group.occurrences.some(
          (seen) =>
            seen.profile === entry.profile &&
            seen.locale === entry.locale &&
            seen.pass === entry.pass
        )
      ) {
        group.occurrences.push({ profile: entry.profile, locale: entry.locale, pass: entry.pass });
      }

      group.screenshot ??= entry.screenshot;
    }
  }

  const sorted = [...groups.values()].sort(
    (a, b) =>
      compareSeverity(a.severity, b.severity) ||
      b.occurrences.length - a.occurrences.length ||
      a.fingerprint.localeCompare(b.fingerprint)
  );
  for (const group of sorted) {
    const summary = screens.get(`${group.surface}:${group.name}`);
    if (!summary || group.accepted) {
      continue;
    }

    if (group.severity === 'error') {
      summary.errors += 1;
    } else if (group.severity === 'warn') {
      summary.warnings += 1;
    } else {
      summary.infos += 1;
    }

    if (group.severity !== 'info') {
      for (const occurrence of group.occurrences) {
        if (!summary.profilesAffected.includes(occurrence.profile)) {
          summary.profilesAffected.push(occurrence.profile);
        }
      }
    }
  }

  const unique = (values: string[]) => [...new Set(values)].sort();
  return {
    generatedAt: now.toISOString(),
    entries: entries.length,
    profiles: unique(entries.map((entry) => entry.profile)),
    locales: unique(entries.map((entry) => entry.locale)),
    groups: sorted,
    screens: [...screens.values()].sort(
      (a, b) =>
        b.errors - a.errors ||
        b.warnings - a.warnings ||
        b.profilesAffected.length - a.profilesAffected.length ||
        a.name.localeCompare(b.name)
    ),
  };
}

/** Error-level findings the baseline has not accepted: what a strict run fails on. */
export function newErrors(report: Report): GroupedFinding[] {
  return report.groups.filter((group) => group.severity === 'error' && !group.accepted);
}

/** A baseline accepting every current error and warning (`MUSCLOG_LAYOUT_UPDATE_BASELINE=1`). */
export function baselineFrom(report: Report, previous: Baseline = emptyBaseline()): Baseline {
  const accepted: Record<string, string> = {};
  for (const group of report.groups) {
    if (group.severity !== 'info') {
      accepted[group.fingerprint] = previous.accepted[group.fingerprint] ?? '';
    }
  }

  return { version: 1, accepted };
}

function cell(text: string): string {
  return text.replace(/\|/g, '\\|').replace(/\s+/g, ' ');
}

function groupLine(group: GroupedFinding): string {
  const where = group.occurrences
    .map(
      (occurrence) =>
        `${occurrence.profile}/${occurrence.locale}${occurrence.pass === 'end' ? '↓' : ''}`
    )
    .join(', ');
  const shot = group.screenshot ? ` — [screenshot](${group.screenshot})` : '';
  return `- **${group.kind}** ${group.messages[0] ?? ''}${shot}\n  seen on: ${where}`;
}

export function renderMarkdown(report: Report): string {
  const open = report.groups.filter((group) => !group.accepted);
  const count = (severity: Severity) => open.filter((group) => group.severity === severity).length;
  const lines: string[] = [
    '# Layout audit',
    '',
    `Generated ${report.generatedAt}. ${report.entries} audited pages across ${report.profiles.length} profile(s) and ${report.locales.length} locale(s).`,
    '',
    'Open `report.html` to browse every screen as a screenshot, by language and phone size, with the findings outlined.',
    '',
    `**${count('error')} errors, ${count('warn')} warnings, ${count('info')} notes** (${report.groups.length - open.length} accepted in the baseline).`,
    '',
    'Profiles: ' + report.profiles.map((profile) => `\`${profile}\``).join(', '),
    '',
    'Locales: ' + report.locales.map((locale) => `\`${locale}\``).join(', '),
    '',
    '## Screens by risk',
    '',
    '| Screen | Errors | Warnings | Notes | Profiles affected |',
    '|---|---:|---:|---:|---|',
  ];
  for (const screen of report.screens) {
    if (screen.errors + screen.warnings + screen.infos === 0) {
      continue;
    }

    lines.push(
      `| ${cell(`${screen.surface}: ${screen.name}`)} | ${screen.errors} | ${screen.warnings} | ${screen.infos} | ${cell(screen.profilesAffected.join(', ') || '—')} |`
    );
  }

  lines.push('', '## Findings', '');
  for (const severity of ['error', 'warn'] as const) {
    const ofSeverity = open.filter((group) => group.severity === severity);
    if (ofSeverity.length === 0) {
      continue;
    }

    lines.push(`### ${severity === 'error' ? 'Errors' : 'Warnings'}`, '');
    const bySurface = new Map<string, GroupedFinding[]>();
    for (const group of ofSeverity) {
      const key = `${group.surface}: ${group.name}`;
      bySurface.set(key, [...(bySurface.get(key) ?? []), group]);
    }

    for (const [heading, groups] of bySurface) {
      lines.push(`#### ${heading}`, '', ...groups.map(groupLine), '');
    }
  }

  const notes = open.filter((group) => group.severity === 'info');
  if (notes.length > 0) {
    lines.push(
      '<details><summary>Notes (' + notes.length + ')</summary>',
      '',
      ...notes.map(groupLine),
      '',
      '</details>',
      ''
    );
  }

  const notAudited = report.screens.filter(
    (screen) => screen.statuses.audited === 0 && screen.notes.length > 0
  );
  lines.push('## Coverage gaps', '');
  if (notAudited.length === 0) {
    lines.push('Every listed screen was audited at least once.', '');
  } else {
    lines.push('Not audited (no successful pass), and why:', '');
    for (const screen of notAudited) {
      lines.push(`- ${screen.surface}: **${screen.name}** — ${screen.notes.join('; ')}`);
    }

    lines.push('');
  }

  return lines.join('\n');
}

export function writeReport(report: Report, reportDir = REPORT_DIR): void {
  fs.mkdirSync(reportDir, { recursive: true });
  fs.writeFileSync(path.join(reportDir, 'report.json'), JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(reportDir, 'report.md'), renderMarkdown(report));
}
