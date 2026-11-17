/**
 * @jest-environment jsdom
 */

import { DEFAULT_THEME_BY_MODE } from '@/theme.registry';
import { themeCssVariables } from '@/theme.tokens';
import { THEME_MIRROR_STORAGE_KEY, type ThemeMirror } from '@/utils/themeMirror';
import { themePrepainter } from '@/utils/themePrepaint';

const fallbacks = {
  dark: themeCssVariables[DEFAULT_THEME_BY_MODE.dark] as Record<string, string>,
  light: themeCssVariables[DEFAULT_THEME_BY_MODE.light] as Record<string, string>,
};
const fallbackIds = { dark: DEFAULT_THEME_BY_MODE.dark, light: DEFAULT_THEME_BY_MODE.light };

let prefersLight = false;

function prepaint() {
  themePrepainter(THEME_MIRROR_STORAGE_KEY, fallbacks, fallbackIds);
}

function painted() {
  return {
    background: document.documentElement.style.getPropertyValue('--c-bg-primary'),
    themeId: document.documentElement.getAttribute('data-theme-id'),
  };
}

function storeMirror(mirror: ThemeMirror) {
  localStorage.setItem(THEME_MIRROR_STORAGE_KEY, JSON.stringify(mirror));
}

describe('themePrepainter', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('style');
    document.documentElement.removeAttribute('data-theme-id');
    prefersLight = false;
    window.matchMedia = ((query: string) => ({
      matches: query === '(prefers-color-scheme: light)' && prefersLight,
    })) as unknown as typeof window.matchMedia;
  });

  it('paints the exact palette the visitor picked', () => {
    storeMirror({
      preference: 'kinetic-volt',
      themeId: 'kinetic-volt',
      variables: themeCssVariables['kinetic-volt'] as Record<string, string>,
    });

    prepaint();

    expect(painted()).toEqual({
      background: themeCssVariables['kinetic-volt']['--c-bg-primary'],
      themeId: 'kinetic-volt',
    });
  });

  it('follows the OS scheme for a first visit', () => {
    prefersLight = true;

    prepaint();

    expect(painted()).toEqual({
      background: fallbacks.light['--c-bg-primary'],
      themeId: DEFAULT_THEME_BY_MODE.light,
    });
  });

  it('follows the OS scheme for a system preference, not the palette recorded under it', () => {
    // Recorded while the phone was dark; it has since switched to light.
    storeMirror({
      preference: 'system',
      themeId: DEFAULT_THEME_BY_MODE.dark,
      variables: fallbacks.dark,
    });
    prefersLight = true;

    prepaint();

    expect(painted().themeId).toBe(DEFAULT_THEME_BY_MODE.light);
    expect(painted().background).toBe(fallbacks.light['--c-bg-primary']);
  });

  it('falls back to the OS scheme while a picked theme has no recorded palette yet', () => {
    // The website picker writes the preference first; the provider fills the palette in after.
    storeMirror({ preference: 'kinetic-blush' });

    prepaint();

    expect(painted().themeId).toBe(DEFAULT_THEME_BY_MODE.dark);
  });

  it('still paints a palette when storage cannot be read', () => {
    const getItem = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });

    try {
      prepaint();
    } finally {
      getItem.mockRestore();
    }

    expect(painted().background).toBe(fallbacks.dark['--c-bg-primary']);
  });

  it('survives being serialized into a script, as app/+html.tsx inlines it', () => {
    storeMirror({
      preference: 'kinetic-shock',
      themeId: 'kinetic-shock',
      variables: themeCssVariables['kinetic-shock'] as Record<string, string>,
    });

    // eslint-disable-next-line no-new-func
    new Function(
      `(${themePrepainter.toString()})(${JSON.stringify(THEME_MIRROR_STORAGE_KEY)}, ${JSON.stringify(
        fallbacks
      )}, ${JSON.stringify(fallbackIds)});`
    )();

    expect(painted().themeId).toBe('kinetic-shock');
  });
});
