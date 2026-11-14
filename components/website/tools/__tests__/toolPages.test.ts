import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

import { TOOLS, toolPath } from '../toolsRegistry';

const root = join(__dirname, '..', '..', '..', '..');
const LOCALES = ['en-us', 'es-es', 'nl-nl', 'pt-br', 'ru-ru'];
const read = (path: string) => readFileSync(join(root, path), 'utf8');
const strip = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const pascal = (key: string) => key.charAt(0).toUpperCase() + key.slice(1);

/**
 * Every tool page calls the SAME pure function the app calls, through its model file. The page must
 * import its model, and the model must import each listed identifier from the app's own `utils/`
 * (never re-implement a formula in a page). `slug` is the last path segment of the route.
 */
const SHARED_FUNCTIONS: Record<(typeof TOOLS)[number]['key'], string[]> = {
  oneRepMax: ['calculateAverage1RM', 'calculateRepsForTargetRIR', 'MAX_E1RM_REPS'],
  plateCalculator: ['platesPerSide', 'nearestLoadableKg'],
  strengthLevel: ['gradeStrength', 'MAX_E1RM_REPS', 'calculateAverage1RM'],
  warmUpCalculator: ['buildWarmupSets', 'platesPerSide'],
  rpeChart: ['repsInReserveFromRpe', 'calculateWeightForTargetRIR', 'calculateAverage1RM'],
  proteinCalculator: ['bodyweightProtein', 'PROTEIN_G_PER_KG_BODYWEIGHT'],
  calorieDeficit: ['calculateTDEE', 'getMinCalories'],
  netCarbs: ['digestibleCarbs', 'totalCarbsFromSource'],
};

describe.each(TOOLS)('tool $key', ({ key, routeKey }) => {
  const slug = toolPath(key).split('/').pop()!;
  const pagePath = `app/(website)/tools/${slug}`;
  const modelName = `${key}Model`;

  it('is a /tools route with a web page and a native redirect', () => {
    expect(toolPath(key)).toBe(`/tools/${slug}`);
    expect(existsSync(join(root, `${pagePath}.web.tsx`))).toBe(true);
    expect(read(`${pagePath}.tsx`)).toContain('<Redirect href="/app" />');
  });

  it('exports metadata for its route key and renders the shared layout', () => {
    const page = strip(read(`${pagePath}.web.tsx`));
    expect(page).toContain(`fixedPageMetadata('${routeKey}')`);
    expect(page).toContain(`routeKey="${routeKey}"`);
    expect(page).toContain('<ToolLayout');
  });

  it('calls the shared functions through its model', () => {
    const page = strip(read(`${pagePath}.web.tsx`));
    expect(page).toContain(`@/components/website/tools/${modelName}`);
    const model = strip(read(`components/website/tools/${modelName}.ts`));
    for (const identifier of SHARED_FUNCTIONS[key]) {
      expect(model).toMatch(new RegExp(`import[^;]*\\b${identifier}\\b[^;]*from '@/utils/`));
    }
  });

  it('has its copy in every locale, with the same keys', () => {
    const rootKey = `websiteTool${pascal(key)}`;
    const shape = (value: unknown): unknown =>
      Array.isArray(value)
        ? value.map(shape)
        : value && typeof value === 'object'
          ? Object.fromEntries(
              Object.entries(value as Record<string, unknown>)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([k, v]) => [k, shape(v)])
            )
          : 'text';
    const copies = LOCALES.map((locale) =>
      JSON.parse(read(`lang/locales/${locale}/${rootKey}.json`))
    );
    for (const copy of copies) {
      expect(Object.keys(copy)).toEqual([rootKey]);
    }

    expect(copies.map((copy) => shape(copy))).toEqual(copies.map(() => shape(copies[0])));
  });

  it('has an SEO title and description in every locale', () => {
    for (const locale of LOCALES) {
      const seo = JSON.parse(read(`lang/locales/${locale}/website.json`)).website.seo.routes[
        routeKey
      ];
      expect(seo.title).toBeTruthy();
      expect(seo.description).toBeTruthy();
    }
  });
});
