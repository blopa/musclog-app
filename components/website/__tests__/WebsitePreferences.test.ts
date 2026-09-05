/** @jest-environment jsdom */
import { fireEvent, render, screen } from '@testing-library/react';
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
jest.mock('lucide-react-native', () => ({ SlidersHorizontal: () => null, X: () => null }));
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
  it('opens both labeled selectors from one button and normalizes regional locale casing', () => {
    const trigger = openPreferences();
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    const language = screen.getByRole('combobox', {
      name: 'website.navigation.language',
    }) as HTMLSelectElement;
    expect(language.value).toBe('en-us');
    expect(document.activeElement).toBe(language);
    const theme = screen.getByRole('combobox', {
      name: 'website.navigation.theme',
    }) as HTMLSelectElement;
    expect(Array.from(theme.options, (option) => option.value)).toEqual(['system', ...THEME_IDS]);
  });

  it('applies language and theme changes while keeping both settings available', () => {
    openPreferences();
    fireEvent.change(screen.getByRole('combobox', { name: 'website.navigation.language' }), {
      target: { value: 'nl-nl' },
    });
    expect(mockChangeLanguage).toHaveBeenCalledWith('nl-nl');
    fireEvent.change(screen.getByRole('combobox', { name: 'website.navigation.theme' }), {
      target: { value: THEME_IDS[0] },
    });
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
