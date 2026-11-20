import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import vm from 'node:vm';

const {
  STORED_LANGUAGE_KEY,
  SCRIPT_ID,
  forwardScript,
  languageTargets,
  unprefixedHtml,
  unprefixedTargets,
  writeUnprefixedPages,
} = require('../write-unprefixed-pages') as {
  STORED_LANGUAGE_KEY: string;
  SCRIPT_ID: string;
  forwardScript: (logicalPath: string) => string;
  languageTargets: (logicalPath: string) => Record<string, string>;
  unprefixedHtml: (sourceHtml: string, logicalPath: string) => string;
  unprefixedTargets: () => { file: string; logicalPath: string }[];
  writeUnprefixedPages: (distDir: string) => string[];
};
const websiteRoutes = require('../../components/website/websiteRoutes.json') as Record<
  string,
  { path: string; robots?: string; locales?: string }
>;
const { PROGRAM_SLUGS } = require('../../components/website/programRoutes') as {
  PROGRAM_SLUGS: string[];
};

function englishFixture(canonicalPath: string): string {
  return `<!DOCTYPE html><html lang="en"><head><meta charSet="utf-8"/><title>t</title><link rel="canonical" href="https://musclog.app/en${canonicalPath}"/></head><body>x</body></html>`;
}

describe('unprefixedTargets', () => {
  const files = unprefixedTargets().map((target) => target.file);

  it('includes the home page twice and every indexable fixed route', () => {
    expect(files).toContain('index.html');
    expect(files).toContain('home.html');
    expect(unprefixedTargets().filter((target) => target.logicalPath === '/')).toHaveLength(2);

    for (const route of Object.values(websiteRoutes)) {
      if (route.path === '/' || route.robots?.includes('noindex') || route.locales === 'none') {
        continue;
      }

      expect(files).toContain(`${route.path.slice(1)}.html`);
    }

    for (const slug of PROGRAM_SLUGS) {
      expect(files).toContain(`programs/${slug}.html`);
    }

    expect(files).toContain('blog.html');
  });

  it('never targets /open, /test or /app', () => {
    for (const file of files) {
      expect(file).not.toMatch(/^(open|test|app)(\/|\.html)/);
    }
  });
});

describe('languageTargets', () => {
  it('maps each non-English locale to its own prefixed page', () => {
    const targets = languageTargets('/tools/one-rep-max');

    expect(Object.keys(targets).sort()).toEqual(
      ['de-de', 'es-es', 'fr-fr', 'it-it', 'nl-nl', 'pl-pl', 'pt-br', 'ru-ru', 'tr-tr'].sort()
    );
    expect(targets['es-es']).toBe('/es/tools/one-rep-max');
    expect(targets['nl-nl']).toBe('/nl/tools/one-rep-max');
    expect(targets['pt-br']).toBe('/pt-br/tools/one-rep-max');
    expect(targets).not.toHaveProperty('en-us');
  });

  it('is empty for the English-only blog', () => {
    expect(languageTargets('/blog')).toEqual({});
  });
});

describe('unprefixedHtml', () => {
  it('inserts the script right after the charset meta and keeps the canonical', () => {
    const html = unprefixedHtml(englishFixture('/tools/x'), '/tools/x');
    const scriptAt = html.indexOf(`<script id="${SCRIPT_ID}">`);

    expect(scriptAt).toBeGreaterThan(-1);
    expect(scriptAt).toBeLessThan(html.indexOf('<title>'));
    expect(html).toContain('<link rel="canonical" href="https://musclog.app/en/tools/x"/>');
    expect(html.split(`id="${SCRIPT_ID}"`)).toHaveLength(2);
  });

  it('places the script right after <head> when there is no charset meta', () => {
    const source =
      '<!DOCTYPE html><html lang="en"><head><title>t</title></head><body>x</body></html>';
    const html = unprefixedHtml(source, '/tools/x');

    expect(html.indexOf(`<script id="${SCRIPT_ID}">`)).toBe(
      html.indexOf('<head>') + '<head>'.length
    );
  });

  it('throws when the English page has no <head>', () => {
    expect(() => unprefixedHtml('<html><body>x</body></html>', '/tools/x')).toThrow('no <head>');
  });
});

type ForwardOptions = {
  search?: string;
  hash?: string;
  stored?: string | null;
  getItem?: jest.Mock;
  replaceState?: jest.Mock;
};

function runForward(logicalPath: string, options: ForwardOptions = {}) {
  const replace = jest.fn();
  const replaceState = options.replaceState ?? jest.fn();
  const getItem = options.getItem ?? jest.fn(() => options.stored ?? null);

  vm.runInNewContext(forwardScript(logicalPath), {
    location: { search: options.search ?? '', hash: options.hash ?? '', replace },
    history: { replaceState },
    localStorage: { getItem },
  });

  return { replace, replaceState, getItem };
}

describe('inline forward script', () => {
  it('reads the stored language under the picker key', () => {
    expect(STORED_LANGUAGE_KEY).toBe('musclog_lang');
  });

  const path_ = '/tools/one-rep-max';
  const query = { search: '?a=1', hash: '#h' };

  it('settles on the English address in place when nothing is stored', () => {
    const { replace, replaceState } = runForward(path_, { ...query, stored: null });

    expect(replaceState).toHaveBeenCalledWith(null, '', '/en/tools/one-rep-max?a=1#h');
    expect(replace).not.toHaveBeenCalled();
  });

  it('stays in place for a stored English language', () => {
    const { replace, replaceState } = runForward(path_, { ...query, stored: 'en-US' });

    expect(replaceState).toHaveBeenCalledWith(null, '', '/en/tools/one-rep-max?a=1#h');
    expect(replace).not.toHaveBeenCalled();
  });

  it('replaces to the stored language page', () => {
    const { replace, replaceState } = runForward(path_, { ...query, stored: 'es-ES' });

    expect(replace).toHaveBeenCalledWith('/es/tools/one-rep-max?a=1#h');
    expect(replaceState).not.toHaveBeenCalled();
  });

  it('matches the stored language case-insensitively', () => {
    const { replace } = runForward(path_, { ...query, stored: 'PT-BR' });

    expect(replace).toHaveBeenCalledWith('/pt-br/tools/one-rep-max?a=1#h');
  });

  it.each(['__proto__', 'constructor', 'xx-XX', ''])(
    'treats the stored value %p as English in place',
    (stored) => {
      const { replace, replaceState } = runForward(path_, { ...query, stored });

      expect(replaceState).toHaveBeenCalledWith(null, '', '/en/tools/one-rep-max?a=1#h');
      expect(replace).not.toHaveBeenCalled();
    }
  );

  it('falls back to English in place when storage throws', () => {
    const getItem = jest.fn(() => {
      throw new Error('blocked');
    });
    const { replace, replaceState } = runForward(path_, { ...query, getItem });

    expect(replaceState).toHaveBeenCalledWith(null, '', '/en/tools/one-rep-max?a=1#h');
    expect(replace).not.toHaveBeenCalled();
  });

  it('falls back to replace when replaceState throws', () => {
    const replaceState = jest.fn(() => {
      throw new Error('nope');
    });
    const { replace } = runForward(path_, { ...query, stored: null, replaceState });

    expect(replace).toHaveBeenCalledWith('/en/tools/one-rep-max?a=1#h');
  });

  it('keeps a bare address bare', () => {
    const { replaceState } = runForward(path_, { stored: null });

    expect(replaceState).toHaveBeenCalledWith(null, '', '/en/tools/one-rep-max');
  });

  it('sends a blog post to its English page even with a stored language', () => {
    const { replace, replaceState } = runForward('/blog/2026/01/x', {
      stored: 'es-ES',
    });

    expect(replaceState).toHaveBeenCalledWith(null, '', '/en/blog/2026/01/x');
    expect(replace).not.toHaveBeenCalled();
  });

  it('sends the home page to its localized page for a stored language', () => {
    const { replace } = runForward('/', { stored: 'de-DE' });

    expect(replace).toHaveBeenCalledWith('/de');
  });

  it('keeps the home page in place at /en with nothing stored', () => {
    const { replaceState } = runForward('/', { stored: null });

    expect(replaceState).toHaveBeenCalledWith(null, '', '/en');
  });
});

describe('writeUnprefixedPages', () => {
  let dist: string;

  beforeEach(async () => {
    dist = await mkdtemp(path.join(tmpdir(), 'unprefixed-'));
  });

  afterEach(async () => {
    await rm(dist, { recursive: true, force: true });
  });

  /** One English source per logical path, rotating between the two layouts the module reads. */
  async function buildEnglishPages() {
    const layouts = new Map<string, number>();

    for (const { logicalPath } of unprefixedTargets()) {
      if (layouts.has(logicalPath)) {
        continue;
      }

      const layout = layouts.size % 2;
      layouts.set(logicalPath, layout);

      const isHome = logicalPath === '/';
      const relative =
        layout === 0
          ? isHome
            ? 'en/index.html'
            : path.join('en', logicalPath, 'index.html')
          : isHome
            ? 'en.html'
            : path.join('en', `${logicalPath}.html`);
      const target = path.join(dist, relative);

      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, englishFixture(logicalPath));
    }
  }

  it('writes every unprefixed page from its English source', async () => {
    await buildEnglishPages();

    const written = writeUnprefixedPages(dist);

    expect(written).toEqual(
      expect.arrayContaining([
        'index.html',
        'home.html',
        'tools.html',
        'tools/one-rep-max.html',
        'blog.html',
      ])
    );
    expect(written).not.toContain('tools/index.html');
    await expect(readFile(path.join(dist, 'tools/index.html'), 'utf8')).rejects.toThrow();

    const page = await readFile(path.join(dist, 'tools/one-rep-max.html'), 'utf8');
    expect(page).toContain(`id="${SCRIPT_ID}"`);
    expect(page).toContain(
      '<link rel="canonical" href="https://musclog.app/en/tools/one-rep-max"/>'
    );
  });

  it('replaces the pre-existing bare index.html', async () => {
    await buildEnglishPages();
    await writeFile(path.join(dist, 'index.html'), 'old');

    writeUnprefixedPages(dist);

    expect(await readFile(path.join(dist, 'index.html'), 'utf8')).toContain(`id="${SCRIPT_ID}"`);
  });

  it('refuses to write over its own output on a second call', async () => {
    await buildEnglishPages();
    writeUnprefixedPages(dist);

    expect(() => writeUnprefixedPages(dist)).toThrow('refusing to overwrite');
    expect(() => writeUnprefixedPages(dist)).toThrow('tools.html');
  });

  it('never overwrites an existing page and writes nothing', async () => {
    await buildEnglishPages();
    await writeFile(path.join(dist, 'tools.html'), 'real');

    expect(() => writeUnprefixedPages(dist)).toThrow('tools.html');
    expect(await readFile(path.join(dist, 'tools.html'), 'utf8')).toBe('real');
  });

  it('throws when an English source is missing', async () => {
    await buildEnglishPages();
    await rm(path.join(dist, 'en/tools/one-rep-max'), { recursive: true, force: true });
    await rm(path.join(dist, 'en/tools/one-rep-max.html'), { force: true });

    expect(() => writeUnprefixedPages(dist)).toThrow('no English page for /tools/one-rep-max');
  });
});
