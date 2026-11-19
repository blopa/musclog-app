import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const { legacyPages, writeLegacyRedirects } = require('../write-legacy-redirects') as {
  legacyPages: () => { file: string; html: string }[];
  writeLegacyRedirects: (distDir: string) => string[];
};
const websiteRoutes = require('../../components/website/websiteRoutes.json') as Record<
  string,
  { path: string; robots?: string; locales?: string }
>;
const { PROGRAM_SLUGS } = require('../../components/website/programRoutes') as {
  PROGRAM_SLUGS: string[];
};

const pages = legacyPages();
const byFile = new Map(pages.map((p) => [p.file, p.html]));

describe('legacyPages', () => {
  it('forwards every stub to the exact /en url of the same path', () => {
    for (const { file, html } of pages) {
      const logical = file === 'home.html' ? '' : `/${file.replace(/\.html$/, '')}`;
      const target = `/en${logical}`;
      expect(html).toContain(`<link rel="canonical" href="https://musclog.app${target}">`);
      expect(html).toContain(`<meta http-equiv="refresh" content="0; url=${target}">`);
      expect(html).toContain(
        `location.replace(${JSON.stringify(target)} + location.search + location.hash)`
      );
      expect(html).toContain(`<a href="${target}">https://musclog.app${target}</a>`);
      expect(html).toContain('<html lang="en">');
      expect(html).toContain('<meta name="robots" content="index, follow">');
    }
  });

  it('covers every indexable fixed route except home, plus programs and /home', () => {
    for (const route of Object.values(websiteRoutes)) {
      if (route.path === '/' || route.robots?.includes('noindex') || route.locales === 'none') {
        continue;
      }

      expect(byFile.has(`${route.path.slice(1)}.html`)).toBe(true);
    }

    for (const slug of PROGRAM_SLUGS) {
      expect(byFile.has(`programs/${slug}.html`)).toBe(true);
    }

    expect(byFile.get('home.html')).toContain('url=/en"');
    expect(byFile.has('index.html')).toBe(false);
    expect(byFile.has('blog.html')).toBe(true);
  });

  it('never stubs /open, /test or /app', () => {
    for (const file of byFile.keys()) {
      expect(file).not.toMatch(/^(open|test|app)(\/|\.html)/);
    }
  });
});

describe('writeLegacyRedirects', () => {
  let dist: string;

  beforeEach(async () => {
    dist = await mkdtemp(path.join(tmpdir(), 'legacy-'));
  });

  afterEach(async () => {
    await rm(dist, { recursive: true, force: true });
  });

  it('writes flat files next to directories and reports a collision', async () => {
    const written = writeLegacyRedirects(dist);
    expect(written).toContain('tools.html');
    expect(await readFile(path.join(dist, 'tools/one-rep-max.html'), 'utf8')).toContain(
      '/en/tools/one-rep-max'
    );
    await expect(readFile(path.join(dist, 'tools/index.html'), 'utf8')).rejects.toThrow();

    expect(() => writeLegacyRedirects(dist)).toThrow('refusing to overwrite');
  });

  it('never overwrites an existing page', async () => {
    await mkdir(path.join(dist, 'tools'), { recursive: true });
    await writeFile(path.join(dist, 'tools.html'), 'real');
    expect(() => writeLegacyRedirects(dist)).toThrow('tools.html');
    expect(await readFile(path.join(dist, 'tools.html'), 'utf8')).toBe('real');
  });
});
