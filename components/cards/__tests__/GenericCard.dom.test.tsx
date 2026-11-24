import { render, screen } from '@testing-library/react';

import { GenericCard } from '@/components/cards/GenericCard';
import { useSurfaceColor } from '@/context/SurfaceColorContext';

// Scope's card is a step lighter than its page, which is exactly where a fade to the wrong
// surface shows as a band, so it is the palette the cases below run on.
const mockTheme = () => require('@/theme').THEMES['kinetic-scope'];

jest.mock('@/hooks/useTheme', () => ({ useTheme: () => mockTheme() }));

/** Reads what a fade inside the card would fade into. */
function SurfaceProbe() {
  return <span data-testid="surface">{useSurfaceColor()}</span>;
}

describe('GenericCard surface', () => {
  it('has a card fill that differs from the page, so the cases below can tell them apart', () => {
    const { colors } = mockTheme();

    expect(colors.background.card).not.toBe(colors.background.primary);
    expect(colors.background.cardElevated).not.toBe(colors.background.card);
  });

  it('tells what is inside a flat card to fade into the card fill, not the page', () => {
    render(
      <GenericCard>
        <SurfaceProbe />
      </GenericCard>
    );

    expect(screen.getByTestId('surface').textContent).toBe(mockTheme().colors.background.card);
  });

  it('does the same for a raised card with its own fill', () => {
    render(
      <GenericCard variant="raised">
        <SurfaceProbe />
      </GenericCard>
    );

    expect(screen.getByTestId('surface').textContent).toBe(
      mockTheme().colors.background.cardElevated
    );
  });

  it('publishes nothing from the hero card, a gradient with no single fill', () => {
    render(
      <GenericCard variant="hero">
        <SurfaceProbe />
      </GenericCard>
    );

    expect(screen.getByTestId('surface').textContent).toBe(mockTheme().colors.background.primary);
  });
});
