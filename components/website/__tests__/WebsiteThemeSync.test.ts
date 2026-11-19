/**
 * @jest-environment jsdom
 */

import { render } from '@testing-library/react';
import { createElement } from 'react';

import { WebsiteThemeSync } from '@/components/website/WebsiteThemeSync';
import { SettingsService } from '@/database/services/SettingsService';
import { useSettings } from '@/hooks/useSettings';
import { setMirroredThemePreference } from '@/utils/themeMirror';

jest.mock('@/database/services/SettingsService', () => ({
  SettingsService: { setTheme: jest.fn(() => Promise.resolve()) },
}));

jest.mock('@/hooks/useSettings', () => ({
  useSettings: jest.fn(),
}));

const mockUseSettings = useSettings as jest.Mock;
const mockSetTheme = SettingsService.setTheme as jest.Mock;

describe('WebsiteThemeSync', () => {
  beforeEach(() => {
    mockSetTheme.mockClear();
    setMirroredThemePreference('kinetic-volt');
  });

  it('writes the website choice back when the readable row still holds an older theme', () => {
    // The picker's own write was lost: the page was left before the database opened.
    mockUseSettings.mockReturnValue({ isLoading: false, theme: 'kinetic-blush' });

    render(createElement(WebsiteThemeSync));

    expect(mockSetTheme).toHaveBeenCalledTimes(1);
    expect(mockSetTheme).toHaveBeenCalledWith('kinetic-volt');
  });

  it('does nothing while the row cannot be read', () => {
    mockUseSettings.mockReturnValue({ isLoading: true, theme: 'system' });

    render(createElement(WebsiteThemeSync));

    expect(mockSetTheme).not.toHaveBeenCalled();
  });

  it('does nothing when the row already agrees', () => {
    mockUseSettings.mockReturnValue({ isLoading: false, theme: 'kinetic-volt' });

    render(createElement(WebsiteThemeSync));

    expect(mockSetTheme).not.toHaveBeenCalled();
  });
});
