import type { EnergyBalance } from '@/utils/energyBalance';

import { buildDailyStatCells } from '../dailyHomeStats';

const balance = (over: Partial<EnergyBalance> = {}): EnergyBalance => ({
  burned: 2500,
  eaten: 2000,
  balance: 500,
  direction: 'deficit',
  ...over,
});

describe('buildDailyStatCells', () => {
  it('renders nothing when neither half of the strip has data', () => {
    expect(buildDailyStatCells({ steps: null, energyBalance: null })).toEqual([]);
  });

  // Steps come from the platform health sync, so they are absent on web and on any
  // phone that has not granted the permission. The energy cells must still render.
  it('renders the energy cells alone when steps are unavailable', () => {
    const cells = buildDailyStatCells({ steps: null, energyBalance: balance() });

    expect(cells.map((cell) => cell.key)).toEqual(['burned', 'eaten', 'balance']);
  });

  // Intuitive-eating mode and a missing calorie goal both leave energyBalance null.
  it('renders the steps cell alone when there is no calorie goal', () => {
    const cells = buildDailyStatCells({ steps: 8241, energyBalance: null });

    expect(cells).toEqual([
      expect.objectContaining({ key: 'steps', value: 8241, interactive: true }),
    ]);
  });

  it('orders steps ahead of the energy cells when both are present', () => {
    const cells = buildDailyStatCells({ steps: 8241, energyBalance: balance() });

    expect(cells.map((cell) => cell.key)).toEqual(['steps', 'burned', 'eaten', 'balance']);
  });

  it('carries each cell its own value', () => {
    const cells = buildDailyStatCells({
      steps: 8241,
      energyBalance: balance({ burned: 2781, eaten: 1900, balance: 881 }),
    });

    expect(cells.map((cell) => cell.value)).toEqual([8241, 2781, 1900, 881]);
  });

  // The tint is a verdict on the day, so it belongs to the balance cell alone — the
  // inputs it is derived from stay neutral or the row reads as decoration.
  it.each([
    ['deficit', 'good'],
    ['surplus', 'caution'],
    ['even', 'neutral'],
  ] as const)('tones a %s balance as %s', (direction, tone) => {
    const cells = buildDailyStatCells({ steps: 8241, energyBalance: balance({ direction }) });
    const balanceCell = cells.find((cell) => cell.key === 'balance');

    expect(balanceCell?.tone).toBe(tone);
    expect(
      cells.filter((cell) => cell.key !== 'balance').every((cell) => cell.tone === 'neutral')
    ).toBe(true);
  });

  it('labels the balance cell by its direction', () => {
    const cells = buildDailyStatCells({
      steps: null,
      energyBalance: balance({ direction: 'surplus' }),
    });

    expect(cells.find((cell) => cell.key === 'balance')?.labelKey).toBe('surplus');
  });

  // Three numbers in one row, all in kcal: labelling only the last one read as though the
  // other two were in some other unit.
  it('states the unit on every energy cell', () => {
    const cells = buildDailyStatCells({ steps: 8241, energyBalance: balance() });

    expect(cells.filter((cell) => cell.showsUnit).map((cell) => cell.key)).toEqual([
      'burned',
      'eaten',
      'balance',
    ]);
  });

  // Steps are the one cell that is not an energy figure.
  it('leaves the step count without a unit', () => {
    const cells = buildDailyStatCells({ steps: 8241, energyBalance: balance() });

    expect(cells.find((cell) => cell.key === 'steps')?.showsUnit).toBe(false);
  });

  it('makes only the steps cell interactive', () => {
    const cells = buildDailyStatCells({ steps: 8241, energyBalance: balance() });

    expect(cells.filter((cell) => cell.interactive).map((cell) => cell.key)).toEqual(['steps']);
  });

  it('keeps a zero step count as a rendered cell', () => {
    const cells = buildDailyStatCells({ steps: 0, energyBalance: null });

    expect(cells.map((cell) => cell.key)).toEqual(['steps']);
  });
});
