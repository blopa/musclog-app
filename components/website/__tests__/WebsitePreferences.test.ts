/** @jest-environment jsdom */
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { createElement } from 'react';

import { ENGLISH_ONLY_NOTICE_MS } from '@/components/website/EnglishOnlyNotice';
import { WebsitePreferences } from '@/components/website/WebsitePreferences';
import { THEME_IDS } from '@/constants/settings';
import { SettingsService } from '@/database/services/SettingsService';
import { setMirroredThemePreference } from '@/utils/themeMirror';

const mockChangeLanguage = jest.fn().mockResolvedValue(undefined);
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { resolvedLanguage: 'en-US', changeLanguage: mockChangeLanguage },
  }),
}));
jest.mock('lucide-react-native', () => ({
  SlidersHorizontal: () => null,
  X: () => null,
  Check: () => null,
  Globe: () => null,
  Languages: () => null,
  Monitor: () => null,
  Palette: () => null,
}));
jest.mock('@/hooks/useTheme', () => ({ useThemePreference: () => 'system' }));
jest.mock('@/database/services/SettingsService', () => ({
  SettingsService: { setTheme: jest.fn().mockResolvedValue(undefined) },
}));
jest.mock('@/utils/themeMirror', () => ({ setMirroredThemePreference: jest.fn() }));

beforeEach(() => {
  jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: 44,
    bottom: 44,
    width: 44,
    height: 44,
    toJSON: () => ({}),
  });
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
  window.localStorage.clear();
  window.history.pushState({}, '', '/');
  mockChangeLanguage.mockClear();
});

const goTo = (url: string) => window.history.pushState({}, '', url);
// jsdom cannot navigate; record what the browser would have followed.
const swallowNavigation = () => {
  const clicked: string[] = [];
  const handler = (event: Event) => {
    const anchor = (event.target as HTMLElement).closest('a');
    if (anchor) {
      clicked.push(anchor.getAttribute('href') ?? '');
      event.preventDefault();
    }
  };
  document.addEventListener('click', handler);
  return { clicked, stop: () => document.removeEventListener('click', handler) };
};

const openPreferences = () => {
  render(createElement(WebsitePreferences));
  const trigger = screen.getByRole('button', { name: 'website.navigation.preferences' });
  fireEvent.click(trigger);
  return trigger;
};

describe('website preferences', () => {
  it('lists all five languages as links with the address locale selected', () => {
    goTo('/es/tools/protein-calculator?kg=80#result');
    const trigger = openPreferences();
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    const nav = screen.getByRole('navigation', { name: 'website.navigation.language' });
    const links = within(nav).getAllByRole('link');
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/en/tools/protein-calculator?kg=80#result',
      '/es/tools/protein-calculator?kg=80#result',
      '/nl/tools/protein-calculator?kg=80#result',
      '/pt-br/tools/protein-calculator?kg=80#result',
      '/ru/tools/protein-calculator?kg=80#result',
    ]);
    expect(links.map((link) => link.getAttribute('hreflang'))).toEqual([
      'en',
      'es',
      'nl',
      'pt-BR',
      'ru',
    ]);
    expect(screen.getByRole('link', { name: /Español/ }).getAttribute('aria-current')).toBe('true');
    expect(screen.getByRole('link', { name: /English/ }).getAttribute('aria-current')).toBeNull();
    ['EN', 'ES', 'NL', 'PT', 'RU'].forEach((badge) => expect(nav.textContent).toContain(badge));
    expect(document.activeElement).toBe(
      screen.getByRole('tab', { name: 'website.navigation.language' })
    );
  });

  it('offers the complete theme catalogue and supports keyboard tab navigation', () => {
    openPreferences();
    fireEvent.keyDown(screen.getByRole('tab', { name: 'website.navigation.language' }), {
      key: 'ArrowRight',
    });
    const themeTab = screen.getByRole('tab', { name: 'website.navigation.theme' });
    expect(document.activeElement).toBe(themeTab);
    expect(themeTab.getAttribute('aria-selected')).toBe('true');
    expect(screen.getAllByRole('radio').map((radio) => (radio as HTMLInputElement).value)).toEqual([
      'system',
      ...THEME_IDS,
    ]);
    expect(
      (
        screen.getByRole('radio', {
          name: 'settings.theme.options.system.label',
        }) as HTMLInputElement
      ).checked
    ).toBe(true);
    fireEvent.keyDown(themeTab, { key: 'Home' });
    expect(screen.getByRole('navigation', { name: 'website.navigation.language' })).toBeTruthy();
  });

  it('follows the link and remembers the language on a translated page', () => {
    goTo('/en/tools/protein-calculator');
    const nav = swallowNavigation();
    openPreferences();
    fireEvent.click(screen.getByRole('link', { name: /Nederlands/ }));
    nav.stop();
    expect(nav.clicked).toEqual(['/nl/tools/protein-calculator']);
    expect(window.localStorage.getItem('musclog_lang')).toBe('nl-NL');
    expect(mockChangeLanguage).not.toHaveBeenCalled();
  });

  it('changes the chrome in place on the English-only blog', () => {
    goTo('/en/blog/some-post');
    const nav = swallowNavigation();
    openPreferences();
    fireEvent.click(screen.getByRole('link', { name: /Русский/ }));
    nav.stop();
    expect(mockChangeLanguage).toHaveBeenCalledWith('ru-RU');
    expect(window.localStorage.getItem('musclog_lang')).toBe('ru-RU');
    expect(nav.clicked).toEqual(['/en/blog/some-post']);
  });

  describe('English-only notice', () => {
    const notice = () => screen.queryByRole('status');

    it('says the posts stay English when another language is chosen on the blog', () => {
      goTo('/en/blog/some-post');
      openPreferences();
      expect(notice()).toBeNull();
      fireEvent.click(screen.getByRole('link', { name: /Español/ }));
      expect(notice()?.textContent).toContain('website.blog.englishOnlyNotice');
      // The choice is made, so the panel gives way to the notice instead of covering it.
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('also covers the blog listings, categories and tags', () => {
      ['/en/blog', '/en/blog/category/news', '/en/blog/tag/open-source'].forEach((url) => {
        goTo(url);
        const { unmount } = render(createElement(WebsitePreferences));
        fireEvent.click(screen.getByRole('button', { name: 'website.navigation.preferences' }));
        fireEvent.click(screen.getByRole('link', { name: /Nederlands/ }));
        expect(notice()).not.toBeNull();
        unmount();
      });
    });

    it('stays away when English is chosen again, and takes an open notice down', () => {
      goTo('/en/blog/some-post');
      openPreferences();
      fireEvent.click(screen.getByRole('link', { name: /Español/ }));
      expect(notice()).not.toBeNull();
      fireEvent.click(screen.getByRole('button', { name: 'website.navigation.preferences' }));
      fireEvent.click(screen.getByRole('link', { name: /English/ }));
      expect(notice()).toBeNull();
    });

    it('is not shown where the page itself changes address', () => {
      goTo('/en/tools/protein-calculator');
      const nav = swallowNavigation();
      openPreferences();
      fireEvent.click(screen.getByRole('link', { name: /Español/ }));
      nav.stop();
      expect(notice()).toBeNull();
    });

    it('is not shown on an unprefixed page that has its own translations', () => {
      goTo('/open');
      openPreferences();
      fireEvent.click(screen.getByRole('link', { name: /Español/ }));
      expect(mockChangeLanguage).toHaveBeenCalledWith('es-ES');
      expect(notice()).toBeNull();
    });

    it('closes with its button and focuses the trigger the panel closed over', () => {
      goTo('/en/blog');
      const trigger = openPreferences();
      fireEvent.click(screen.getByRole('link', { name: /Русский/ }));
      expect(document.activeElement).toBe(trigger);
      fireEvent.click(screen.getByRole('button', { name: 'website.cta.close' }));
      expect(notice()).toBeNull();
    });

    it('goes away by itself, and starts over when another language is chosen', () => {
      jest.useFakeTimers();
      goTo('/en/blog');
      openPreferences();
      fireEvent.click(screen.getByRole('link', { name: /Español/ }));
      act(() => {
        jest.advanceTimersByTime(ENGLISH_ONLY_NOTICE_MS - 1000);
      });
      expect(notice()).not.toBeNull();

      fireEvent.click(screen.getByRole('button', { name: 'website.navigation.preferences' }));
      fireEvent.click(screen.getByRole('link', { name: /Nederlands/ }));
      act(() => {
        jest.advanceTimersByTime(ENGLISH_ONLY_NOTICE_MS - 1000);
      });
      expect(notice()).not.toBeNull();

      act(() => {
        jest.advanceTimersByTime(1000);
      });
      expect(notice()).toBeNull();
    });
  });

  it('applies theme choices without closing the preferences panel', () => {
    openPreferences();
    fireEvent.click(screen.getByRole('tab', { name: 'website.navigation.theme' }));
    fireEvent.click(
      screen.getByRole('radio', { name: `settings.theme.options.${THEME_IDS[0]}.label` })
    );
    expect(setMirroredThemePreference).toHaveBeenCalledWith(THEME_IDS[0]);
    expect(SettingsService.setTheme).toHaveBeenCalledWith(THEME_IDS[0]);
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('closes on Escape and returns focus to the trigger', () => {
    const trigger = openPreferences();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('closes on an outside press or the close button', () => {
    const trigger = openPreferences();
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole('button', { name: 'website.cta.close' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });
});
