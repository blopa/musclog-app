import fs from 'fs';
import path from 'path';

import { localeScopeOf } from '../localeRoutes';

/**
 * Every internal link to a website page goes through `useWebsiteHref()`, which puts the language
 * prefix on it. A hand-written `href="/tools"` would land on the old-address forwarding page. This
 * reads the source and fails on a literal website path used as an `href` that is not wrapped.
 */

const ROOT = path.resolve(__dirname, '../../..');

function walk(directory: string, accept: (file: string) => boolean): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return entry.name === '__tests__' ? [] : walk(full, accept);
    }

    return accept(full) ? [full] : [];
  });
}

const files = [
  ...walk(path.join(ROOT, 'components/website'), (file) => /\.tsx?$/.test(file)),
  ...walk(path.join(ROOT, 'app/(website)/[locale]'), (file) => file.endsWith('.web.tsx')),
];

/**
 * Logical-path registries converted by `href(...)` where they are rendered. A path here is kept as
 * data, never as a rendered anchor.
 */
const LOGICAL_PATH_DATA: Record<string, string> = {
  'components/website/WebsiteWrapper.web.tsx':
    'menuLinks and footerLinks hold logical paths; the anchors render them through href(link.href)',
  'app/(website)/[locale]/tools/workout-log-template.web.tsx':
    '`articles` are logical blog paths; ToolLayout renders them through href(article.href)',
  'app/(website)/[locale]/tools/deload-calculator.web.tsx':
    '`articles` are logical blog paths; ToolLayout renders them through href(article.href)',
  'app/(website)/[locale]/tools/progressive-overload-calculator.web.tsx':
    '`articles` are logical blog paths; ToolLayout renders them through href(article.href)',
};

const PATTERNS = [/href=(?:"|\{`|\{')(\/[^"'`}]*)/g, /\bhref:\s*(?:'|"|`)(\/[^'"`]*)/g];

describe('website links carry the language prefix', () => {
  it('scans some files', () => {
    expect(files.length).toBeGreaterThan(20);
  });

  it.each(files.map((file) => [path.relative(ROOT, file), file]))('%s', (relative, file) => {
    const source = fs.readFileSync(file, 'utf8');
    const offenders: string[] = [];

    for (const pattern of PATTERNS) {
      for (const match of source.matchAll(pattern)) {
        const target = match[1].replace(/\$\{.*$/, '');
        const scope = localeScopeOf(target);
        if (scope !== 'all' && scope !== 'en') {
          continue;
        }

        const isAnchorLiteral = match[0].startsWith('href=');
        if (!isAnchorLiteral && LOGICAL_PATH_DATA[relative]) {
          continue;
        }

        offenders.push(match[0]);
      }
    }

    expect(offenders).toEqual([]);
  });
});
