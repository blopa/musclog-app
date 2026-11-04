import { readFileSync } from 'fs';
import { join } from 'path';

import { darkColors } from '@/theme.tokens';

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

  it('matches the native splash: same icon, same size, same background', () => {
    // The native splash (expo-splash-screen) hands over to this screen, so any
    // difference in artwork, size or background shows as a visible jump.
    const appJson = JSON.parse(readFileSync(join(root, 'app.json'), 'utf8'));
    const plugin = appJson.expo.plugins.find(
      (entry: unknown) => Array.isArray(entry) && entry[0] === 'expo-splash-screen'
    );
    const native = plugin[1];
    const logoSize = Number(/const LOGO_SIZE = (\d+);/.exec(source)?.[1]);
    const logoPath = /require\('@\/(assets\/[^']+)'\)/.exec(source)?.[1];

    expect(native.image).toBe(`./${logoPath}`);
    expect(native.imageWidth).toBe(logoSize);
    expect(native.backgroundColor.toLowerCase()).toBe(darkColors.surfaceBase.toLowerCase());
  });
});
