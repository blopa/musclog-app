import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const { flattenDirectoryIndexes } = require('../flatten-web-indexes') as {
  flattenDirectoryIndexes: (distDir: string) => string[];
};

let dist: string;

async function put(rel: string, content: string) {
  const file = path.join(dist, rel);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, content);
}

async function exists(rel: string) {
  return stat(path.join(dist, rel)).then(
    () => true,
    () => false
  );
}

beforeEach(async () => {
  dist = await mkdtemp(path.join(tmpdir(), 'flatten-'));
});

afterEach(async () => {
  await rm(dist, { recursive: true, force: true });
});

describe('flattenDirectoryIndexes', () => {
  it('copies nested index.html files to flat siblings and returns exactly those', async () => {
    await put('index.html', 'root');
    await put('blog/index.html', 'blog');
    await put('blog/2026/post/index.html', 'post');

    const written = flattenDirectoryIndexes(dist);

    expect(written.sort()).toEqual(
      ['blog.html', 'blog/2026.html'.replace('2026.html', '2026/post.html')].sort()
    );
    expect(await readFile(path.join(dist, 'blog.html'), 'utf8')).toBe('blog');
    expect(await readFile(path.join(dist, 'blog/2026/post.html'), 'utf8')).toBe('post');
    expect(await exists('blog/2026.html')).toBe(false);
  });

  it('leaves the root index.html alone', async () => {
    await put('index.html', 'root');

    expect(flattenDirectoryIndexes(dist)).toEqual([]);
    expect(await exists('.html')).toBe(false);
  });

  it('never overwrites an existing flat page', async () => {
    await put('alternatives.html', 'real');
    await put('alternatives/index.html', 'index');

    expect(flattenDirectoryIndexes(dist)).toEqual([]);
    expect(await readFile(path.join(dist, 'alternatives.html'), 'utf8')).toBe('real');
  });

  it('skips route groups, underscore and asset directories', async () => {
    await put('(website)/x/index.html', 'a');
    await put('_expo/y/index.html', 'b');
    await put('assets/z/index.html', 'c');
    await put('images/w/index.html', 'd');
    await put('musclog-app/v/index.html', 'e');

    expect(flattenDirectoryIndexes(dist)).toEqual([]);
    expect(await exists('(website)/x.html')).toBe(false);
    expect(await exists('assets/z.html')).toBe(false);
  });

  it('flattens locale directories', async () => {
    await put('es/index.html', 'es');
    await put('pt-br/index.html', 'br');
    await put('pt-br/tools/index.html', 'tools');

    expect(flattenDirectoryIndexes(dist).sort()).toEqual(
      ['es.html', 'pt-br.html', 'pt-br/tools.html'].sort()
    );
    expect(await readFile(path.join(dist, 'es.html'), 'utf8')).toBe('es');
    expect(await readFile(path.join(dist, 'pt-br/tools.html'), 'utf8')).toBe('tools');
  });
});
