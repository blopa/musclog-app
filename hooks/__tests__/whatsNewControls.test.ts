import { fireEvent, render, screen } from '@testing-library/react';
import { createElement } from 'react';

import { OptionsSelector } from '@/components/OptionsSelector';
import { ToggleInput } from '@/components/theme/ToggleInput';
import { WeekdayChoiceChips } from '@/components/WeekdayChoiceChips';

jest.mock('@/hooks/useTheme', () => ({ useTheme: () => require('@/theme').darkTheme }));
jest.mock('@/database/services/SettingsService', () => ({ SettingsService: {} }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ i18n: { language: 'en-US' } }) }));
test('exposes the selected enum choice to web accessibility and blocks disabled taps', () => {
  const onSelect = jest.fn();
  const props = {
    title: 'View',
    options: ['Guided', 'Inline'].map((id) => ({
      id,
      label: id,
      description: '',
      icon: () => null,
      iconColor: '',
      iconBgColor: '',
    })),
    selectedId: 'Guided',
    onSelect,
  };
  const { rerender } = render(createElement(OptionsSelector, props));
  expect(screen.getByRole('radio', { name: 'Guided' }).getAttribute('aria-checked')).toBe('true');
  expect(screen.getByRole('radio', { name: 'Inline' }).getAttribute('aria-checked')).toBe('false');
  fireEvent.click(screen.getByRole('radio', { name: 'Inline' }));
  expect(onSelect).toHaveBeenCalledWith('Inline');
  rerender(createElement(OptionsSelector, { ...props, disabled: true }));
  fireEvent.click(screen.getByRole('radio', { name: 'Inline' }));
  expect(onSelect).toHaveBeenCalledTimes(1);
});
test('weekday chips are labelled by day and communicate checked state', () => {
  const onChange = jest.fn();
  render(createElement(WeekdayChoiceChips, { value: 1, onChange }));
  expect(screen.getByRole('radio', { name: 'Monday' }).getAttribute('aria-checked')).toBe('true');
  fireEvent.click(screen.getByRole('radio', { name: 'Friday' }));
  expect(onChange).toHaveBeenCalledWith(5);
});
test('boolean choices expose a labelled switch', () => {
  const onValueChange = jest.fn();
  render(
    createElement(ToggleInput, {
      items: [{ key: 'rest', label: 'Rest timer', value: true, onValueChange }],
    })
  );
  const control = screen.getByRole('switch', { name: 'Rest timer' });
  fireEvent.click(control);
  expect(onValueChange).toHaveBeenCalledWith(false);
});
