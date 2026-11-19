import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const { localizeWebExports } = require('../localize-web-exports') as {
  localizeWebExports: (distDir: string) => { stamped: number; removed: number };
};

let dist: string;
const page = '<!doctype html><html lang="en" class="x"><head></head></html>';

async function put(rel: string, content = page) {
  const file = path.join(dist, rel);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, content);
}

const exists = (rel: string) =>
  stat(path.join(dist, rel)).then(
    () => true,
    () => false
  );

beforeEach(async () => {
  dist = await mkdtemp(path.join(tmpdir(), 'localize-'));
});

afterEach(async () => {
  await rm(dist, { recursive: true, force: true });
});

describe('localizeWebExports', () => {
  it('stamps each locale hreflang, including flat roots', async () => {
    await put('en/index.html');
    await put('pt-br/tools/index.html');
    await put('pt-br.html');
    await put('es/download.html');

    localizeWebExports(dist);

    expect(await readFile(path.join(dist, 'en/index.html'), 'utf8')).toContain('<html lang="en"');
    expect(await readFile(path.join(dist, 'pt-br/tools/index.html'), 'utf8')).toContain(
      '<html lang="pt-BR" class="x"'
    );
    expect(await readFile(path.join(dist, 'pt-br.html'), 'utf8')).toContain('lang="pt-BR"');
    expect(await readFile(path.join(dist, 'es/download.html'), 'utf8')).toContain('lang="es"');
  });

  it('removes untranslated blog pages from non-English locales only', async () => {
    await put('es/blog.html');
    await put('es/blog/index.html');
    await put('ru/blog/2026/08/x.html');
    await put('es/tools/index.html');
    await put('en/blog.html');
    await put('en/blog/2026/08/x.html');

    const result = localizeWebExports(dist);

    expect(result.removed).toBe(3);
    expect(await exists('es/blog.html')).toBe(false);
    expect(await exists('es/blog')).toBe(false);
    expect(await exists('ru/blog')).toBe(false);
    expect(await exists('es/tools/index.html')).toBe(true);
    expect(await exists('en/blog.html')).toBe(true);
    expect(await exists('en/blog/2026/08/x.html')).toBe(true);
  });

  it('is idempotent and tolerates a missing dist', async () => {
    await put('nl/index.html');
    expect(localizeWebExports(dist).stamped).toBe(1);
    expect(localizeWebExports(dist)).toEqual({ stamped: 0, removed: 0 });
    expect(localizeWebExports(path.join(dist, 'nope'))).toEqual({ stamped: 0, removed: 0 });
  });
});
