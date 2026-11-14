import { readFileSync } from 'fs';
import { join } from 'path';

import websiteRoutes from '../../websiteRoutes.json';
import { COMPETITORS } from '../competitors';

const root = join(__dirname, '..', '..', '..', '..');
const LOCALES = ['en-us', 'es-es', 'nl-nl', 'pt-br', 'ru-ru'];
const copyFor = (locale: string) =>
  JSON.parse(
    readFileSync(join(root, `lang/locales/${locale}/websiteAlternativesPages.json`), 'utf8')
  ).websiteAlternativesPages;

describe.each(COMPETITORS)('competitor page $id', (competitor) => {
  it('is a registered /alternatives route with a web page and a native redirect', () => {
    const route = websiteRoutes[competitor.routeKey as keyof typeof websiteRoutes];
    expect(route.path).toMatch(/^\/alternatives\/[a-z]+$/);
    const file = `app/(website)${route.path}`;
    expect(readFileSync(join(root, `${file}.web.tsx`), 'utf8')).toContain(`id="${competitor.id}"`);
    expect(readFileSync(join(root, `${file}.tsx`), 'utf8')).toContain('<Redirect href="/app" />');
  });

  it('dates its facts and links every fact row to its source', () => {
    expect(competitor.checkedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    for (const source of competitor.sources) {
      expect(source).toMatch(/^https:\/\//);
    }
  });

  it.each(LOCALES)('has one fact row per source in %s', (locale) => {
    const app = copyFor(locale).apps[competitor.id];
    expect(app.facts).toHaveLength(competitor.sources.length);
    for (const fact of app.facts) {
      expect(fact.topic && fact.them && fact.musclog).toBeTruthy();
    }

    if (competitor.hasImport) {
      expect(app.import.length).toBeGreaterThan(0);
    }
  });
});
