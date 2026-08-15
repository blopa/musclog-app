import { readFileSync } from 'fs';
import { join } from 'path';

describe('website header navigation', () => {
  const source = readFileSync(join(__dirname, '..', 'WebsiteWrapper.web.tsx'), 'utf8');

  it('uses the full navigation only when its contents have enough room', () => {
    expect(source).toContain('<nav className="hidden items-center gap-6 lg:flex">');
    expect(source).toContain('<div className="flex items-center gap-2 lg:hidden">');
  });

  it('keeps the brand and desktop download action from wrapping', () => {
    expect(source).toContain('className="flex shrink-0 items-center gap-2"');
    expect(source).toContain(
      'className="shrink-0 whitespace-nowrap px-5 py-2.5 text-sm font-bold transition-transform hover:scale-[1.01]"'
    );
  });

  it('keeps the primary links in the intended order', () => {
    const headerNavigation = source.slice(
      source.indexOf('<nav className="hidden items-center gap-6 lg:flex">'),
      source.indexOf(
        '</nav>',
        source.indexOf('<nav className="hidden items-center gap-6 lg:flex">')
      )
    );
    const links = [...headerNavigation.matchAll(/href="([^"]+)"/g)].map((match) => match[1]);

    expect(links).toEqual(['/blog', '/calculator', '/exercises', '/progress']);
  });
});
