/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react';
import { existsSync } from 'fs';
import { join } from 'path';
import { createElement } from 'react';

import { Hero } from '@/app/(website)/home.web';
import { THEME_IDS } from '@/constants/settings';
import { useThemeId } from '@/hooks/useTheme';
import { DEFAULT_THEME_BY_MODE } from '@/theme.registry';

jest.mock('@/hooks/useTheme', () => ({ useThemeId: jest.fn() }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('expo-router', () => ({ Link: 'a' }));
jest.mock('lucide-react-native', () => ({ Code2: () => null, ArrowRight: () => null }));
jest.mock('@/components/website/StoreButtons', () => ({ StoreButtons: () => null }));
jest.mock('@/components/website/WebsiteBackgrounds', () => ({ HeroBackground: () => null }));
jest.mock('@/components/website/WebsiteStructuredData', () => ({}));
jest.mock('@/components/website/WebsiteWrapper', () => ({}));

describe('website hero screenshot', () => {
  it('updates the rendered image for every active palette without remounting', () => {
    jest.mocked(useThemeId).mockReturnValue(THEME_IDS[0]);
    const { rerender } = render(createElement(Hero));

    for (const themeId of THEME_IDS) {
      jest.mocked(useThemeId).mockReturnValue(themeId);
      rerender(createElement(Hero));
      expect(screen.getByAltText('Musclog app screenshot').getAttribute('src')).toBe(
        `/images/themes/${themeId}.webp`
      );
      expect(existsSync(join(process.cwd(), 'public/images/themes', `${themeId}.webp`))).toBe(true);
    }
  });

  it('uses the resolved palette when system appearance changes', () => {
    jest.mocked(useThemeId).mockReturnValue(DEFAULT_THEME_BY_MODE.light);
    const { rerender } = render(createElement(Hero));
    expect(screen.getByAltText('Musclog app screenshot').getAttribute('src')).toBe(
      `/images/themes/${DEFAULT_THEME_BY_MODE.light}.webp`
    );

    jest.mocked(useThemeId).mockReturnValue(DEFAULT_THEME_BY_MODE.dark);
    rerender(createElement(Hero));
    expect(screen.getByAltText('Musclog app screenshot').getAttribute('src')).toBe(
      `/images/themes/${DEFAULT_THEME_BY_MODE.dark}.webp`
    );
  });
});
