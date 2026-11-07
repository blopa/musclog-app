import fs from 'fs';
import path from 'path';

import { declaredStep } from '../flowKit';
import { FLOW_RUNNERS } from '../flows/registry';
import {
  AUDIT_FLOWS,
  AUDIT_ONLY_MODAL_BUTTONS,
  MAIN_ROUTES,
  MODAL_COVERAGE,
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
    ...AUDIT_FLOWS.flatMap((flow) => flow.files),
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

describe('flows', () => {
  const routeNames = [...MAIN_ROUTES, ...ONBOARDING_ROUTES].map((route) => route.name);
  const steps = AUDIT_FLOWS.flatMap((flow) => flow.steps);

  it('has a runner for every declared flow and declares every runner', () => {
    expect(Object.keys(FLOW_RUNNERS).sort()).toEqual(AUDIT_FLOWS.map((flow) => flow.name).sort());
  });

  it('keeps step names unique and apart from route names, since they key the report', () => {
    expect(new Set(steps).size).toBe(steps.length);
    expect(steps.filter((step) => routeNames.includes(step))).toEqual([]);
  });

  it('lets no route file be both a flow file and unaudited', () => {
    const unaudited = new Set(UNAUDITED_ROUTES.map((route) => route.file));
    expect(AUDIT_FLOWS.flatMap((flow) => flow.files).filter((file) => unaudited.has(file))).toEqual(
      []
    );
  });
});

describe('intro sheets', () => {
  const withSheet = MAIN_ROUTES.filter((route) => route.introSheet);
  const localeDirs = fs
    .readdirSync(path.join(ROOT, 'lang', 'locales'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

  it('covers the Weekly Review welcome, which opens over the screen on first visit', () => {
    expect(withSheet.map((route) => route.name)).toContain('weekly-review');
  });

  it('names a test id that a component in the app still sets', () => {
    const sources = ['components', 'app']
      .map((dir) => fs.readdirSync(path.join(ROOT, dir), { recursive: true, encoding: 'utf8' }))
      .flatMap((files, index) =>
        files
          .filter((file) => file.endsWith('.tsx'))
          .map((file) =>
            fs.readFileSync(path.join(ROOT, ['components', 'app'][index], file), 'utf8')
          )
      )
      .join('\n');
    const missing = withSheet.filter(
      (route) => !sources.includes(`testID="${route.introSheet?.testId}"`)
    );
    expect(missing.map((route) => route.name)).toEqual([]);
  });

  it('has the dismiss button copy in every bundled locale, so no locale clicks a stale label', () => {
    const missing: string[] = [];
    for (const route of withSheet) {
      const { file, keyPath } = route.introSheet!.dismiss;
      for (const dir of localeDirs) {
        let value: unknown = JSON.parse(
          fs.readFileSync(path.join(ROOT, 'lang', 'locales', dir, `${file}.json`), 'utf8')
        );
        for (const key of keyPath) {
          value = (value as Record<string, unknown> | undefined)?.[key];
        }

        if (typeof value !== 'string' || value.length === 0) {
          missing.push(`${route.name}:${dir}`);
        }
      }
    }

    expect(missing).toEqual([]);
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

describe('modal coverage', () => {
  /** Every modal, sheet and menu component: the files a person can open over a screen. */
  function overlayFiles(directory: string, prefix: string): string[] {
    return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
      if (entry.isDirectory()) {
        return entry.name === '__tests__'
          ? []
          : overlayFiles(path.join(directory, entry.name), `${prefix}${entry.name}/`);
      }

      return /(Modal|Sheet|Menu)(\.web)?\.tsx$/.test(entry.name) ? [`${prefix}${entry.name}`] : [];
    });
  }

  const files = overlayFiles(path.join(ROOT, 'components'), 'components/');

  it('says how every modal, sheet and menu is audited, or why it is not', () => {
    expect(files.filter((file) => !(file in MODAL_COVERAGE))).toEqual([]);
  });

  it('lists no file that is gone', () => {
    expect(Object.keys(MODAL_COVERAGE).filter((file) => !files.includes(file))).toEqual([]);
  });

  it('points at fixture buttons and flow steps that exist, and gives every gap a reason', () => {
    const broken = Object.entries(MODAL_COVERAGE).filter(([, coverage]) => {
      if ('fixture' in coverage) {
        return !MODAL_AUDIT_BUTTONS.includes(coverage.fixture);
      }

      if ('flow' in coverage) {
        return !AUDIT_FLOWS.some((flow) => declaredStep(flow, coverage.flow));
      }

      return coverage.unaudited.length < 20;
    });
    expect(broken.map(([file]) => file)).toEqual([]);
  });
});
