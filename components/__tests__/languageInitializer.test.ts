/**
 * @jest-environment jsdom
 */

/**
 * Before settings load, `language` is a default (en-US), not the user's choice. Applying it
 * switched the app to English for the seconds the settings table took to load and then back,
 * so the initializer waits; `AppDbReadyGate` has already applied the mirrored language by then.
 */

import { render } from '@testing-library/react';
import { createElement } from 'react';

import { LanguageInitializer } from '@/components/LanguageInitializer';

let mockSettings: { isLoading: boolean; language: string };
const mockChangeLanguage = jest.fn(() => Promise.resolve());

jest.mock('@/constants/platform', () => ({ isStaticExport: false }));
jest.mock('@/hooks/useSettings', () => ({ useSettings: () => mockSettings }));
jest.mock('@/lang/lang', () => ({
  __esModule: true,
  default: {
    language: 'pt-BR',
    changeLanguage: (language: string) => mockChangeLanguage(language),
  },
}));

describe('LanguageInitializer', () => {
  beforeEach(() => {
    mockChangeLanguage.mockClear();
  });

  it('does not apply the default language while settings are loading', () => {
    mockSettings = { isLoading: true, language: 'en-US' };

    render(createElement(LanguageInitializer));

    expect(mockChangeLanguage).not.toHaveBeenCalled();
  });

  it('applies the stored language once settings have loaded', () => {
    mockSettings = { isLoading: false, language: 'nl-NL' };

    render(createElement(LanguageInitializer));

    expect(mockChangeLanguage).toHaveBeenCalledWith('nl-NL');
  });
});
