import { readFileSync } from 'fs';
import { join } from 'path';

const source = readFileSync(join(__dirname, '..', 'WebsiteWrapper.web.tsx'), 'utf8');

function sliceBetween(startMarker: string, endMarker: string) {
  const start = source.indexOf(startMarker);

  expect(start).toBeGreaterThan(-1);

  const end = source.indexOf(endMarker, start);

  expect(end).toBeGreaterThan(start);

  return source.slice(start, end);
}

describe('website header navigation', () => {
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
    const headerNavigation = sliceBetween(
      '<nav className="hidden items-center gap-6 lg:flex">',
      '</nav>'
    );
    const links = [...headerNavigation.matchAll(/href="([^"]+)"/g)].map((match) => match[1]);

    expect(links).toEqual(['/blog', '/calculator', '/exercises', '/progress']);
  });

  it('offers the burger menu in the header cluster that replaces the desktop nav', () => {
    const mobileCluster = sliceBetween(
      '<div className="flex items-center gap-2 lg:hidden">',
      '</div>'
    );

    expect(mobileCluster).toContain('<MobileMenu />');
  });
});

describe('website mobile menu', () => {
  const mobileMenu = sliceBetween('export function MobileMenu()', 'export function Header()');

  it('carries every important destination, so they need not live in the footer', () => {
    const links = [...mobileMenu.matchAll(/href: '([^']+)'/g)].map((match) => match[1]);

    expect(links).toEqual([
      '/home#features',
      '/blog',
      '/calculator',
      '/exercises',
      '/progress',
      '/faq',
      '/gameboy',
      '/alternatives',
      'https://github.com/blopa/musclog-app',
    ]);
  });

  it('hides the trigger and the portalled panel above the desktop breakpoint', () => {
    // The panel is portalled out of the header, so it needs the breakpoint of
    // its own rather than inheriting the header cluster's.
    expect(mobileMenu).toContain(
      'className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition-colors hover:border-white/20 hover:bg-white/10 lg:hidden"'
    );
    expect(mobileMenu).toContain('<div className="fixed inset-0 top-16 z-[140] lg:hidden">');
  });

  it('announces its state and the panel it controls', () => {
    expect(mobileMenu).toContain('aria-expanded={isOpen}');
    expect(mobileMenu).toContain('aria-controls={MOBILE_MENU_ID}');
    expect(mobileMenu).toContain("aria-label={isOpen ? t('closeMenu') : t('openMenu')}");
  });

  it('restores the previous body overflow rather than clearing it outright', () => {
    expect(mobileMenu).toContain('const previousBodyOverflow = document.body.style.overflow;');
    expect(mobileMenu).toContain('document.body.style.overflow = previousBodyOverflow;');
  });

  it('closes on escape, on a backdrop press, and when a destination is chosen', () => {
    expect(mobileMenu).toContain("if (event.key === 'Escape')");
    expect(mobileMenu).toContain('onClick={() => setIsOpen(false)}');
    expect(mobileMenu).toContain('onPress={() => setIsOpen(false)}');
  });

  it('closes when the viewport grows past the desktop breakpoint', () => {
    expect(mobileMenu).toContain("window.matchMedia('(min-width: 1024px)')");
  });
});

describe('website footer', () => {
  const footer = sliceBetween('export function Footer()', 'export function WebsiteWrapper(');

  it('no longer duplicates the navigation as a mobile-only link cluster', () => {
    expect(footer).not.toContain('md:hidden');
  });

  it('still lists the secondary and legal links for every viewport', () => {
    const links = [...footer.matchAll(/href: '([^']+)'/g)].map((match) => match[1]);

    expect(links).toEqual([
      '/privacy',
      '/terms',
      '/contact',
      '/exercises',
      '/gameboy',
      '/faq',
      '/alternatives',
      '/blog',
      'https://github.com/blopa/musclog-app/blob/main/LICENSE',
      'https://github.com/blopa/musclog-app',
    ]);
  });
});
