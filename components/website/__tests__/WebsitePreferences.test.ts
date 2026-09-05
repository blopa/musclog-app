/** @jest-environment jsdom */
import { fireEvent, render, screen, within } from '@testing-library/react';
import { createElement } from 'react';

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

afterEach(() => jest.restoreAllMocks());

const openPreferences = () => {
  render(createElement(WebsitePreferences));
  const trigger = screen.getByRole('button', { name: 'website.navigation.preferences' });
  fireEvent.click(trigger);
  return trigger;
};

describe('website preferences', () => {
  it('opens styled language choices with flags and the current locale selected', () => {
    const trigger = openPreferences();
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(screen.queryByRole('combobox')).toBeNull();
    const group = screen.getByRole('radiogroup', { name: 'website.navigation.language' });
    expect(within(group).getAllByRole('radio')).toHaveLength(4);
    expect((screen.getByRole('radio', { name: 'English' }) as HTMLInputElement).checked).toBe(true);
    expect(group.textContent).toContain('🇬🇧');
    expect(group.textContent).toContain('🇪🇸');
    expect(group.textContent).toContain('🇳🇱');
    expect(group.textContent).toContain('🇧🇷');
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
    expect(screen.getByRole('radiogroup', { name: 'website.navigation.language' })).toBeTruthy();
  });

  it('applies language and theme choices without closing the preferences panel', () => {
    openPreferences();
    fireEvent.click(screen.getByRole('radio', { name: 'Nederlands' }));
    expect(mockChangeLanguage).toHaveBeenCalledWith('nl-nl');
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
