import { readFileSync } from 'fs';
import { join } from 'path';

import { fireEvent, render, screen } from '@testing-library/react';

import { AiChoiceCard } from '@/components/onboarding/AiChoiceCard';

jest.mock('@/hooks/useTheme', () => ({ useTheme: () => require('@/theme').darkTheme }));

const POINTS = [
  { kind: 'plus', text: 'Works at once' },
  { kind: 'minus', text: 'Daily limit' },
] as const;

function renderCard(overrides: Partial<React.ComponentProps<typeof AiChoiceCard>> = {}) {
  const onPress = jest.fn();
  render(
    <AiChoiceCard
      title="Musclog Premium"
      badge="Most private"
      price="$4.99 / month"
      points={POINTS}
      selected={false}
      onPress={onPress}
      {...overrides}
    />
  );

  return onPress;
}

describe('AiChoiceCard', () => {
  it('renders the title, badge, price and every point', () => {
    renderCard();

    expect(screen.getByText('Musclog Premium')).toBeTruthy();
    expect(screen.getByText('Most private')).toBeTruthy();
    expect(screen.getByText('$4.99 / month')).toBeTruthy();
    expect(screen.getByText('Works at once')).toBeTruthy();
    expect(screen.getByText('Daily limit')).toBeTruthy();
  });

  it('omits the badge and price when not given', () => {
    renderCard({ badge: undefined, price: undefined });

    expect(screen.queryByText('Most private')).toBeNull();
    expect(screen.queryByText('$4.99 / month')).toBeNull();
  });

  it('is a radio whose aria-checked follows selected', () => {
    renderCard();
    expect(screen.getByRole('radio').getAttribute('aria-checked')).toBe('false');
  });

  it('reports the selected card as checked, on web and to native screen readers', () => {
    renderCard({ selected: true });

    expect(screen.getByRole('radio').getAttribute('aria-checked')).toBe('true');
    // Native screen readers read accessibilityState; react-native-web reads aria-checked.
    expect(
      readFileSync(join(__dirname, '..', 'AiChoiceCard.tsx'), 'utf8').replace(/\s+/g, ' ')
    ).toContain('accessibilityState={{ checked: selected, disabled }}');
  });

  it('labels the radio with the title and price', () => {
    renderCard();

    expect(screen.getByRole('radio').getAttribute('aria-label')).toBe(
      'Musclog Premium, $4.99 / month'
    );
  });

  it('calls onPress when pressed', () => {
    const onPress = renderCard();

    fireEvent.click(screen.getByRole('radio'));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not call onPress when disabled', () => {
    const onPress = renderCard({ disabled: true });

    fireEvent.click(screen.getByRole('radio'));

    expect(onPress).not.toHaveBeenCalled();
  });
});
