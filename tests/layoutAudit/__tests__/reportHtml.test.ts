/**
 * @jest-environment jsdom
 */
import fs from 'fs';
import os from 'os';
import path from 'path';

import { emptyBaseline, fingerprint, type ShardEntry } from '../report';
import {
  buildViewerData,
  compareLocales,
  compareProfiles,
  embedJson,
  readViewerAssets,
  renderHtml,
  writeHtmlReport,
  type ViewerData,
} from '../reportHtml';
import type { Finding } from '../types';

function finding(overrides: Partial<Finding> = {}): Finding {
  return {
    kind: 'overlap',
    severity: 'error',
    message: 'text "/180g" overlaps text "99"',
    labels: ['/180g', '99'],
    paths: ['div', 'div'],
    rects: [{ x: 66, y: 132, w: 33, h: 66 }],
    ...overrides,
  };
}

function entry(overrides: Partial<ShardEntry> = {}): ShardEntry {
  return {
    platform: 'web',
    profile: '344x882-fs1.3',
    locale: 'en-US',
    fontScale: 1.3,
    viewport: { width: 264, height: 660 },
    surface: 'screen',
    group: 'screens',
    name: 'food',
    url: 'http://localhost:8081/app/nutrition/food',
    status: 'audited',
    pass: 'top',
    findings: [finding()],
    screenshot: 'screens/344x882-fs1.3/en-us/screen-food-top.jpg',
    ...overrides,
  };
}

const ENTRIES: ShardEntry[] = [
  entry(),
  entry({ locale: 'ru-RU', screenshot: 'screens/344x882-fs1.3/ru-ru/screen-food-top.jpg' }),
  entry({
    profile: '360x772-fs1',
    findings: [finding({ kind: 'clipped', severity: 'warn', labels: ['x'], message: 'x clipped' })],
  }),
  entry({ name: 'home', findings: [] }),
  entry({
    group: 'modals',
    surface: 'modal',
    name: 'Open Add Food Modal',
    findings: [finding({ kind: 'truncated', severity: 'info', labels: ['n'], message: 'n cut' })],
  }),
  entry({
    group: 'onboarding',
    name: 'ai-chat',
    status: 'redirected',
    note: 'redirected to /app/onboarding/landing',
    findings: [],
    screenshot: undefined,
  }),
];

describe('ordering', () => {
  it('puts the narrowest phone first and normal text before large text', () => {
    expect(
      ['411x914-fs1.3', '344x882-fs1.3', '344x882-fs1', 'android-x'].sort(compareProfiles)
    ).toEqual(['344x882-fs1', '344x882-fs1.3', '411x914-fs1.3', 'android-x']);
  });

  it('puts English first, the stretched pass last, the rest alphabetical', () => {
    expect(['ru-RU', 'pseudo', 'es-ES', 'en-US', 'nl-NL'].sort(compareLocales)).toEqual([
      'en-US',
      'es-ES',
      'nl-NL',
      'ru-RU',
      'pseudo',
    ]);
  });
});

describe('buildViewerData', () => {
  const data = buildViewerData(ENTRIES, emptyBaseline(), new Date('2026-11-07T10:00:00Z'));

  it('lists the locales and profiles that were audited, in display order', () => {
    expect(data.locales).toEqual(['en-US', 'ru-RU']);
    expect(data.profiles).toEqual(['344x882-fs1.3', '360x772-fs1'].sort(compareProfiles));
  });

  it('keeps rects in the page own pixels, with the viewport they belong to', () => {
    const first = data.entries[0];
    expect(first.viewport).toEqual({ w: 264, h: 660 });
    expect(first.findings[0]).toMatchObject({ k: 'overlap', s: 'error', r: [[66, 132, 33, 66]] });
    expect(first.shot).toBe('screens/344x882-fs1.3/en-us/screen-food-top.jpg');
  });

  it('marks accepted findings by the same fingerprint the report groups by', () => {
    const key = fingerprint(finding(), 'screen', 'food');
    const accepted = buildViewerData(ENTRIES, { version: 1, accepted: { [key]: 'known' } });
    expect(accepted.entries[0].findings[0]).toMatchObject({ f: key, a: true });
    expect(data.entries[0].findings[0].a).toBe(false);
    // Every occurrence of one defect shares one fingerprint.
    expect(data.entries[0].findings[0].f).toBe(data.entries[1].findings[0].f);
  });

  it('caps the outline rects of one finding', () => {
    const many = entry({
      findings: [finding({ rects: Array.from({ length: 20 }, () => ({ x: 0, y: 0, w: 1, h: 1 })) })],
    });
    expect(buildViewerData([many]).entries[0].findings[0].r).toHaveLength(6);
  });
});

describe('the HTML shell', () => {
  const data = buildViewerData(ENTRIES);
  const html = renderHtml(data);

  it('is one document with the styles, data and script inline', () => {
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('<style>');
    expect(html).toContain('id="layout-data"');
    expect(html).toContain('id="viewer"');
    expect(html).not.toMatch(/<link[^>]+stylesheet/);
    expect(html).not.toMatch(/<script[^>]+src=/);
  });

  it('cannot be broken out of its script element by what is in the data', () => {
    const hostile = buildViewerData([
      entry({
        name: '</script><script>alert(1)</script>',
        findings: [finding({ message: '<!-- \u2028 \u2029 -->' })],
      }),
    ]);
    const page = renderHtml(hostile);
    const parsed = new DOMParser().parseFromString(page, 'text/html');
    expect(parsed.querySelectorAll('script')).toHaveLength(2);
    const roundTrip = JSON.parse(parsed.getElementById('layout-data')?.textContent ?? '{}');
    expect(roundTrip.entries[0].name).toBe('</script><script>alert(1)</script>');
    expect(roundTrip.entries[0].findings[0].m).toBe('<!-- \u2028 \u2029 -->');
  });

  it('ships a viewer script that cannot end its own element', () => {
    expect(readViewerAssets().js).not.toMatch(/<\/script/i);
    expect(embedJson({ a: '</script>' })).not.toContain('</script>');
  });

  it('writes report.html beside the screenshots', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'la-html-'));
    const file = writeHtmlReport(ENTRIES, emptyBaseline(), dir);
    expect(file).toBe(path.join(dir, 'report.html'));
    expect(fs.readFileSync(file, 'utf8')).toContain('Layout audit');
  });
});

/** Loads the real page into the test document and runs its own script, as a browser would. */
function openReport(data: ViewerData) {
  const parsed = new DOMParser().parseFromString(renderHtml(data), 'text/html');
  document.body.innerHTML = '<div id="app"></div>';
  const holder = document.createElement('script');
  holder.type = 'application/json';
  holder.id = 'layout-data';
  holder.textContent = parsed.getElementById('layout-data')?.textContent ?? '';
  document.body.appendChild(holder);
  (window as unknown as Record<string, unknown>).__LAYOUT_REPORT_NO_AUTOINIT__ = true;
  delete (window as unknown as Record<string, unknown>).LayoutReport;
  window.eval(parsed.getElementById('viewer')?.textContent ?? '');
  type Api = {
    init: (d: ViewerData, root: HTMLElement) => { state: Record<string, unknown>; render: () => void };
    filterEntries: (d: ViewerData, s: Record<string, unknown>) => unknown[];
    defaultState: (d: ViewerData) => Record<string, unknown>;
    groupSections: (
      items: unknown[],
      d: ViewerData,
      s: Record<string, unknown>
    ) => Array<{ name: string; group: string; errors: number; warnings: number }>;
  };
  const api = (window as unknown as { LayoutReport: Api }).LayoutReport;
  const app = document.getElementById('app') as HTMLElement;
  return { api, app, view: api.init(data, app) };
}

const text = (node: Element | null) => node?.textContent ?? '';

describe('the viewer', () => {
  const data = buildViewerData(ENTRIES);

  it('files screens, onboarding and modals under their own headings, most issues first', () => {
    const { app } = openReport(data);
    expect([...app.querySelectorAll('.group-title')].map(text)).toEqual([
      'Screens',
      'Onboarding',
      'Modals',
    ]);
    // `food` has errors, `home` none: risk order puts food first.
    expect([...app.querySelectorAll('.section h3')].map(text)).toEqual([
      'food',
      'home',
      'ai-chat',
      'Open Add Food Modal',
    ]);
  });

  it('lays each screen out as a row per language with a card per phone size', () => {
    const { app } = openReport(data);
    const food = app.querySelector('#sec-0') as HTMLElement;
    expect([...food.querySelectorAll('.row-label')].map(text)).toEqual(['en-US', 'ru-RU']);
    expect(food.querySelectorAll('.card')).toHaveLength(3);
    expect(food.querySelector('.card img')?.getAttribute('src')).toBe(
      'screens/344x882-fs1.3/en-us/screen-food-top.jpg'
    );
    expect(food.querySelector('.card img')?.getAttribute('loading')).toBe('lazy');
  });

  it('colours a card by its worst finding and counts them', () => {
    const { app } = openReport(data);
    const cards = [...app.querySelectorAll('#sec-0 .card')];
    expect(cards.some((card) => card.classList.contains('has-error'))).toBe(true);
    expect(cards.some((card) => card.classList.contains('has-warn'))).toBe(true);
    expect(text(app.querySelector('#sec-0 .card .pill.error'))).toBe('1');
  });

  it('outlines a finding in percent of the page it was measured on', () => {
    const { app } = openReport(data);
    const box = app.querySelector('#sec-0 .card .box.error') as HTMLElement;
    expect(box.style.left).toBe('25%');
    expect(box.style.top).toBe('20%');
    expect(box.style.width).toBe('12.5%');
    expect(box.style.height).toBe('10%');
  });

  it('shows a note instead of a picture for a page without a screenshot', () => {
    const { app } = openReport(data);
    const redirected = [...app.querySelectorAll('.section')].find(
      (section) => text(section.querySelector('h3')) === 'ai-chat'
    ) as HTMLElement;
    expect(redirected.querySelector('img')).toBeNull();
    expect(text(redirected.querySelector('.missing'))).toContain('redirected to /app/onboarding/landing');
  });

  it('hides notes by default and everything else follows the severity filter', () => {
    const { api } = openReport(data);
    const state = api.defaultState(data);
    const count = () => api.filterEntries(data, state).length;
    expect(state.severity).toBe('warn');
    state.onlyIssues = true;
    expect(count()).toBe(3);
    state.severity = 'error';
    expect(count()).toBe(2);
    state.severity = 'info';
    expect(count()).toBe(4);
  });

  it('filters by language, phone size, group and name', () => {
    const { api } = openReport(data);
    const state = api.defaultState(data);
    state.locales = new Set(['ru-RU']);
    expect(api.filterEntries(data, state)).toHaveLength(1);
    state.locales = new Set(data.locales);
    state.profiles = new Set(['360x772-fs1']);
    expect(api.filterEntries(data, state)).toHaveLength(1);
    state.profiles = new Set(data.profiles);
    state.group = 'modals';
    expect(api.filterEntries(data, state)).toHaveLength(1);
    state.group = 'all';
    state.query = '  HOM ';
    expect(api.filterEntries(data, state)).toHaveLength(1);
  });

  it('hides accepted findings unless asked to show them', () => {
    const key = fingerprint(finding(), 'screen', 'food');
    const accepted = buildViewerData(ENTRIES, { version: 1, accepted: { [key]: 'known' } });
    const { api } = openReport(accepted);
    const state = api.defaultState(accepted);
    state.onlyIssues = true;
    const withFindings = (hide: boolean) => {
      state.hideAccepted = hide;
      return api
        .filterEntries(accepted, state)
        .filter((item) => (item as { findings: Array<{ s: string }> }).findings.some((f) => f.s === 'error'))
        .length;
    };
    expect(withFindings(true)).toBe(0);
    expect(withFindings(false)).toBe(2);
  });

  it('counts a defect once however many pages show it', () => {
    const { api } = openReport(data);
    const state = api.defaultState(data);
    const sections = api.groupSections(api.filterEntries(data, state), data, state);
    const food = sections.find((section) => section.name === 'food');
    // Two pages share the overlap error; the clipped warning is its own defect.
    expect(food).toMatchObject({ errors: 1, warnings: 1 });
  });

  it('re-draws when a filter changes, and says so when nothing is left', () => {
    const { app, view } = openReport(data);
    (view.state.locales as Set<string>).clear();
    view.render();
    expect(text(app.querySelector('.empty'))).toContain('Nothing matches');
    expect(app.querySelectorAll('.section')).toHaveLength(0);
  });

  it('turns the outlines off', () => {
    const { app, view } = openReport(data);
    expect(app.querySelectorAll('.box').length).toBeGreaterThan(0);
    view.state.outlines = false;
    view.render();
    expect(app.querySelectorAll('.box')).toHaveLength(0);
  });

  it('opens a card in the lightbox with its findings, and steps through the visible pages', () => {
    const { app } = openReport(data);
    const lightbox = app.querySelector('.lightbox') as HTMLElement;
    expect(lightbox.hidden).toBe(true);

    (app.querySelector('#sec-0 .card') as HTMLElement).click();
    expect(lightbox.hidden).toBe(false);
    expect(text(lightbox.querySelector('h2'))).toBe('food');
    expect(lightbox.querySelectorAll('.finding').length).toBeGreaterThan(0);
    expect(text(lightbox.querySelector('.lb-meta'))).toContain('1/');

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    expect(text(lightbox.querySelector('.lb-meta'))).toContain('2/');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    expect(text(lightbox.querySelector('.lb-meta'))).toContain('1/');

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(lightbox.hidden).toBe(true);
  });

  it('highlights the outline of the finding under the pointer', () => {
    const { app } = openReport(data);
    (app.querySelector('#sec-0 .card') as HTMLElement).click();
    const lightbox = app.querySelector('.lightbox') as HTMLElement;
    const row = lightbox.querySelector('.finding') as HTMLElement;
    row.dispatchEvent(new MouseEvent('mouseenter'));
    expect(lightbox.querySelectorAll('.box.hot').length).toBeGreaterThan(0);
    row.dispatchEvent(new MouseEvent('mouseleave'));
    expect(lightbox.querySelectorAll('.box.hot')).toHaveLength(0);
  });
});
