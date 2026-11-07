import fs from 'fs';
import path from 'path';

import {
  type Baseline,
  emptyBaseline,
  fingerprint,
  markSharedChrome,
  REPORT_DIR,
  type ShardEntry,
} from './report';
import type { Finding, Severity } from './types';

/**
 * `report.html`: every audited page as a screenshot, grouped by screen and laid out by language
 * and phone size, with the findings outlined on top. One self-contained file (the data, the
 * styles and the script are inline); only the screenshots are separate, next to it.
 *
 * The page draws itself in the browser from the embedded data (`viewer.js`), so this module only
 * shapes that data and writes the shell.
 */

export interface ViewerFinding {
  /** Kind of finding. */
  k: Finding['kind'];
  /** Severity. */
  s: Severity;
  /** Message. */
  m: string;
  /** Fingerprint, shared by every occurrence of the same defect. */
  f: string;
  /** Accepted in the baseline. */
  a: boolean;
  /** Found in the fixed chrome every screen shares (reported once, not per screen). */
  c: boolean;
  /** Outline rects `[x, y, w, h]` in the page's own CSS pixels. */
  r: number[][];
}

export interface ViewerEntry {
  platform: ShardEntry['platform'];
  group: ShardEntry['group'];
  surface: ShardEntry['surface'];
  name: string;
  locale: string;
  profile: string;
  pass: ShardEntry['pass'];
  status: ShardEntry['status'];
  note?: string;
  /** Screenshot path relative to the report. */
  shot?: string;
  viewport: { w: number; h: number };
  findings: ViewerFinding[];
}

export interface ViewerData {
  generatedAt: string;
  locales: string[];
  profiles: string[];
  entries: ViewerEntry[];
}

const MAX_RECTS_PER_FINDING = 6;

function profileOrder(profile: string): [number, number, string] {
  const match = /^(\d+)x(\d+)-fs([\d.]+)$/.exec(profile);
  return match ? [Number(match[1]), Number(match[3]), profile] : [Infinity, 0, profile];
}

/** Narrowest phone first, then normal before large text. */
export function compareProfiles(a: string, b: string): number {
  const [aWidth, aScale, aName] = profileOrder(a);
  const [bWidth, bScale, bName] = profileOrder(b);
  return aWidth - bWidth || aScale - bScale || aName.localeCompare(bName);
}

/** English first, the stretched-English pass last, the rest alphabetical. */
export function compareLocales(a: string, b: string): number {
  const rank = (locale: string) => {
    if (locale === 'en-US') {
      return 0;
    }

    return locale === 'pseudo' ? 2 : 1;
  };

  return rank(a) - rank(b) || a.localeCompare(b);
}

function viewerFinding(finding: Finding, entry: ShardEntry, baseline: Baseline): ViewerFinding {
  const key = fingerprint(finding, entry.surface, entry.name);
  return {
    k: finding.kind,
    s: finding.severity,
    m: finding.message,
    f: key,
    a: key in baseline.accepted,
    c: finding.chrome === true && entry.surface === 'screen',
    r: finding.rects
      .slice(0, MAX_RECTS_PER_FINDING)
      .map((rect) => [rect.x, rect.y, rect.w, rect.h]),
  };
}

export function buildViewerData(
  entries: ShardEntry[],
  baseline: Baseline = emptyBaseline(),
  now = new Date()
): ViewerData {
  const unique = (values: string[]) => [...new Set(values)];
  return {
    generatedAt: now.toISOString(),
    locales: unique(entries.map((entry) => entry.locale)).sort(compareLocales),
    profiles: unique(entries.map((entry) => entry.profile)).sort(compareProfiles),
    entries: markSharedChrome(entries).map((entry) => ({
      platform: entry.platform,
      group: entry.group,
      surface: entry.surface,
      name: entry.name,
      locale: entry.locale,
      profile: entry.profile,
      pass: entry.pass,
      status: entry.status,
      note: entry.note,
      shot: entry.screenshot,
      viewport: { w: entry.viewport.width, h: entry.viewport.height },
      findings: entry.findings.map((finding) => viewerFinding(finding, entry, baseline)),
    })),
  };
}

/**
 * JSON that is safe inside a `<script>` element: no `</script`, no `<!--`, and no line
 * separators that older parsers read as a line break.
 */
export function embedJson(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

export function readViewerAssets(directory = __dirname): { css: string; js: string } {
  return {
    css: fs.readFileSync(path.join(directory, 'viewer.css'), 'utf8'),
    js: fs.readFileSync(path.join(directory, 'viewer.js'), 'utf8'),
  };
}

export function renderHtml(data: ViewerData, assets = readViewerAssets()): string {
  return [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<title>Layout audit</title>',
    `<style>${assets.css}</style>`,
    '</head>',
    '<body>',
    '<div id="app"><p style="padding:16px">Loading the audit…</p></div>',
    '<noscript><p style="padding:16px">This report draws itself with JavaScript.</p></noscript>',
    `<script type="application/json" id="layout-data">${embedJson(data)}</script>`,
    `<script id="viewer">${assets.js}</script>`,
    '</body>',
    '</html>',
    '',
  ].join('\n');
}

export function writeHtmlReport(
  entries: ShardEntry[],
  baseline: Baseline = emptyBaseline(),
  reportDir = REPORT_DIR
): string {
  fs.mkdirSync(reportDir, { recursive: true });
  const file = path.join(reportDir, 'report.html');
  fs.writeFileSync(file, renderHtml(buildViewerData(entries, baseline)));
  return file;
}
