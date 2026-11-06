import fs from 'fs';
import path from 'path';

import {
  AUDIT_ONLY_MODAL_BUTTONS,
  MAIN_ROUTES,
  MODAL_AUDIT_BUTTONS,
  ONBOARDING_ROUTES,
  UNAUDITED_ROUTES,
} from '../routes';
import { MODAL_BUTTON_TEXTS } from '../../helpers/modalFixture';

const ROOT = path.resolve(__dirname, '..', '..', '..');
const APP_DIR = path.join(ROOT, 'app', 'app');

function routeFiles(directory: string, prefix = ''): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory()) {
      // `test/` holds developer fixtures, not screens a person can reach.
      return entry.name === 'test'
        ? []
        : routeFiles(path.join(directory, entry.name), `${prefix}${entry.name}/`);
    }

    return entry.name.endsWith('.tsx')
      ? [`${prefix}${entry.name.replace(/(\.web)?\.tsx$/, '')}`]
      : [];
  });
}

describe('screen coverage', () => {
  const known = new Set([
    ...MAIN_ROUTES.map((route) => route.file),
    ...ONBOARDING_ROUTES.map((route) => route.file),
    ...UNAUDITED_ROUTES.map((route) => route.file),
  ]);

  it('lists every route file under app/app, or says why it is not audited', () => {
    const missing = routeFiles(APP_DIR).filter((file) => !known.has(file));
    expect(missing).toEqual([]);
  });

  it('points every entry at a route file that exists', () => {
    const files = new Set(routeFiles(APP_DIR));
    const stale = [...known].filter((file) => !files.has(file));
    expect(stale).toEqual([]);
  });

  it('gives every unaudited route a reason', () => {
    expect(UNAUDITED_ROUTES.every((route) => route.reason.length > 10)).toBe(true);
  });

  it('keeps route names unique, since they key the report', () => {
    const names = [...MAIN_ROUTES, ...ONBOARDING_ROUTES].map((route) => route.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('starts every path with a slash, or is the home route', () => {
    const paths = [...MAIN_ROUTES, ...ONBOARDING_ROUTES].map((route) => route.path);
    expect(paths.every((route) => route === '' || route.startsWith('/'))).toBe(true);
  });
});

describe('modal fixture coverage', () => {
  const source = fs.readFileSync(path.join(APP_DIR, 'test', 'modals.tsx'), 'utf8');
  const fixtureLabels = [...source.matchAll(/label=\{?"([^"]+)"\}?/g)].map((match) => match[1]);

  it('audits every button the fixture has', () => {
    expect(fixtureLabels.filter((label) => !MODAL_AUDIT_BUTTONS.includes(label))).toEqual([]);
  });

  it('lists no button the fixture no longer has', () => {
    expect(MODAL_AUDIT_BUTTONS.filter((label) => !fixtureLabels.includes(label))).toEqual([]);
  });

  it('adds only extras the app-store capture does not click', () => {
    expect(AUDIT_ONLY_MODAL_BUTTONS.filter((label) => MODAL_BUTTON_TEXTS.includes(label))).toEqual(
      []
    );
    expect(new Set(MODAL_AUDIT_BUTTONS).size).toBe(MODAL_AUDIT_BUTTONS.length);
  });
});
