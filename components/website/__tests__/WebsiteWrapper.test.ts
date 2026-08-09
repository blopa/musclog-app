import { readFileSync } from 'fs';
import { join } from 'path';

describe('website header navigation', () => {
  it('places the blog link immediately after features', () => {
    const source = readFileSync(join(__dirname, '..', 'WebsiteWrapper.web.tsx'), 'utf8');
    const headerNavigation = source.slice(
      source.indexOf('<nav className="hidden items-center gap-6 md:flex">'),
      source.indexOf(
        '</nav>',
        source.indexOf('<nav className="hidden items-center gap-6 md:flex">')
      )
    );
    const links = [...headerNavigation.matchAll(/href="([^"]+)"/g)].map((match) => match[1]);

    expect(links.slice(0, 3)).toEqual(['/home#features', '/blog', '/calculator']);
  });
});
