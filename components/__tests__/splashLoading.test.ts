import { readFileSync } from 'fs';
import { join } from 'path';

const root = join(__dirname, '..', '..');

/** Source without comments, so the explanatory comment naming `className` cannot match. */
function code(...segments: string[]): string {
  return readFileSync(join(root, ...segments), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

describe('SplashLoading', () => {
  const source = code('components', 'SplashLoading.tsx');

  it('uses no NativeWind classes, because global.css is not loaded yet on the root route', () => {
    // `app/index.tsx` renders the splash before `app/app/_layout.tsx` imports
    // `global.css`; a className there resolves to nothing and the logo drew at
    // its intrinsic 1024px size.
    expect(code('app', '_layout.tsx')).not.toContain('global.css');
    expect(source).not.toMatch(/className=/);
  });

  it('sizes the logo explicitly', () => {
    expect(source).toMatch(
      /<Image[\s\S]*?style=\{\{\s*width:\s*LOGO_SIZE,\s*height:\s*LOGO_SIZE\s*\}\}/
    );
  });
});
