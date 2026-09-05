import { readFileSync } from 'fs';
import { join } from 'path';

const componentPath = join(__dirname, '..', 'BlogPostShare.tsx');
const source = readFileSync(componentPath, 'utf8');
const postPage = readFileSync(
  join(__dirname, '..', '..', '..', 'app', '(website)', 'blog', '[...slug].web.tsx'),
  'utf8'
);
const globalCss = readFileSync(join(__dirname, '..', '..', '..', 'global.css'), 'utf8');

const NETWORKS = [
  'Bluesky',
  'Linkedin',
  'Pinterest',
  'Reddit',
  'Telegram',
  'VK',
  'Whatsapp',
  'X',
] as const;

describe('blog post share row', () => {
  it.each(NETWORKS)('offers %s, with its icon', (network) => {
    expect(source).toContain(`<${network}ShareButton`);
    expect(source).toContain(`<${network}Icon {...ICON_PROPS} />`);
  });

  it('renders every share button through the shared chrome', () => {
    // One `chrome(...)` spread per button: the aria-label, the hover color, and the reset opt-out
    // below all live there, so a button added without it would silently lose all three.
    expect([...source.matchAll(/\{\.\.\.chrome\(/g)]).toHaveLength(NETWORKS.length);
    expect([...source.matchAll(/ShareButton\b/g)]).toHaveLength(NETWORKS.length * 3);
  });

  it("opts out of react-share's inline style reset, which would beat the Tailwind chrome", () => {
    expect(source).toContain('resetButtonStyle: false');
  });

  it('draws the icons monochrome so the row inherits the button color', () => {
    expect(source).toContain("iconFillColor: 'currentColor'");
    expect(source).toContain("bgStyle: { fill: 'transparent' }");
  });

  it('gives X a color that is visible in every palette', () => {
    // react-share's own X brand color is #000000, which vanishes on the dark
    // palettes; plain white vanishes on the light ones. The page's ink is the
    // only value that clears both, so X is the one network without a literal.
    expect(source).toMatch(/x: ink\(1\)/);
  });

  it('hands each button its network color as the custom property the stylesheet reads', () => {
    expect(source).toContain("style: { '--share-color': SHARE_COLOR[network] } as CSSProperties");
    expect(globalCss).toContain('.blog-share-button');
    expect(globalCss).toMatch(/\.blog-share-button:hover[\s\S]*?color: var\(--share-color\)/);
  });

  it('builds the shared URL from the SEO origin rather than a second copy of it', () => {
    expect(source).toContain("import { absoluteUrl, SEO_IMAGE_URL } from './WebsiteSeo'");
    expect(source).toContain('const url = absoluteUrl(canonicalPath)');
    expect(source).not.toMatch(/https:\/\/musclog\.app/);
  });

  it('gives the image-first networks an absolute image, which they require', () => {
    expect(source).toMatch(/media=\{SEO_IMAGE_URL\}/);
    expect(source).toMatch(/image=\{SEO_IMAGE_URL\}/);
  });

  it('stacks the heading above the buttons on narrow screens, and beside them on wide ones', () => {
    expect(source).toContain('flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between');
  });

  it('lays the buttons out as an even grid on phones and one row from `sm` up', () => {
    // Eight 44px targets do not fit one phone-width row, and plain wrapping strands the last one.
    expect(source).toContain('grid grid-cols-4 place-items-center gap-2 sm:flex');
    expect(source).toContain('sm:justify-end');
  });

  it('gives every button a touch-sized target', () => {
    expect(source).toContain('h-11 w-11');
  });

  it('is mounted at the end of a post, above the back link', () => {
    const footer = postPage.slice(postPage.indexOf('<footer'));

    expect(footer.indexOf('<BlogPostShare')).toBeGreaterThan(-1);
    expect(footer.indexOf('<BlogPostShare')).toBeLessThan(footer.indexOf('<Link'));
  });
});
