import {
  FOOD_SOURCE_CARBS_CONVENTION,
  digestibleCarbs,
  totalCarbsForFoodSource,
  totalCarbsFromSource,
} from '@/utils/carbsConvention';

describe('carbsConvention', () => {
  describe('totalCarbsFromSource', () => {
    it("leaves a 'total' source (USDA) unchanged", () => {
      expect(totalCarbsFromSource('total', { carbs: 30, fiber: 5 })).toBe(30);
    });

    it("adds fiber for a 'net' source (EU label)", () => {
      // EU "carbohydrates" excludes fiber -> total = 25 + 5 = 30
      expect(totalCarbsFromSource('net', { carbs: 25, fiber: 5 })).toBe(30);
    });

    it('off-mixed without an explicit total assumes net (EU-dominant) and adds fiber', () => {
      expect(totalCarbsFromSource('off-mixed', { carbs: 25, fiber: 5 })).toBe(30);
    });

    it('off-mixed prefers carbohydrates-total when present and self-consistent', () => {
      // OFF gave an explicit total (e.g. US product) -> use it, do not add fiber again.
      expect(totalCarbsFromSource('off-mixed', { carbs: 28, fiber: 3, offCarbsTotal: 31 })).toBe(
        31
      );
    });

    it('off-mixed ignores an inconsistent carbohydrates-total smaller than carbs', () => {
      // Bad data: total < net -> fall back to net + fiber.
      expect(totalCarbsFromSource('off-mixed', { carbs: 30, fiber: 4, offCarbsTotal: 10 })).toBe(
        34
      );
    });

    describe('off-mixed energy reconciliation', () => {
      // Co-macros shared by the cases below: protein 3g, fat 2g → base (excl. carbs) without fiber = 30.
      const coMacros = { protein: 3, fat: 2 };

      it('keeps carbs as total when the stated energy matches the total interpretation', () => {
        // US product: carbs (20) already include fiber (5). Energy as total =
        // 4*(20-5) + 2*5 + 4*3 + 9*2 = 100.
        expect(
          totalCarbsFromSource('off-mixed', {
            carbs: 20,
            fiber: 5,
            energyReconciliation: { statedKcalPer100g: 100, ...coMacros },
          })
        ).toBe(20);
      });

      it('adds fiber when the stated energy matches the net interpretation', () => {
        // EU product: carbs (15) exclude fiber (5). Energy as net = 4*15 + 2*5 + 4*3 + 9*2 = 100.
        expect(
          totalCarbsFromSource('off-mixed', {
            carbs: 15,
            fiber: 5,
            energyReconciliation: { statedKcalPer100g: 100, ...coMacros },
          })
        ).toBe(20);
      });

      it('falls back to the net default when the energy is inconclusive', () => {
        // Midpoint energy (90) fits neither interpretation better than the tolerance → default net.
        expect(
          totalCarbsFromSource('off-mixed', {
            carbs: 15,
            fiber: 5,
            energyReconciliation: { statedKcalPer100g: 90, ...coMacros },
          })
        ).toBe(20);
      });

      it('ignores the energy hint when there is no fiber (interpretations are identical)', () => {
        expect(
          totalCarbsFromSource('off-mixed', {
            carbs: 20,
            fiber: 0,
            energyReconciliation: { statedKcalPer100g: 9999, ...coMacros },
          })
        ).toBe(20);
      });

      it('still prefers carbohydrates-total over the energy hint', () => {
        // Energy says "total" (would return 15), but an explicit carbohydrates-total wins.
        expect(
          totalCarbsFromSource('off-mixed', {
            carbs: 15,
            fiber: 5,
            offCarbsTotal: 22,
            energyReconciliation: { statedKcalPer100g: 80, ...coMacros },
          })
        ).toBe(22);
      });
    });

    it('clamps negative inputs to 0', () => {
      expect(totalCarbsFromSource('net', { carbs: -5, fiber: -2 })).toBe(0);
      expect(totalCarbsFromSource('total', { carbs: -5, fiber: 0 })).toBe(0);
    });

    it('treats non-finite inputs as 0', () => {
      expect(totalCarbsFromSource('off-mixed', { carbs: NaN as number, fiber: 5 })).toBe(5);
    });
  });

  describe('totalCarbsForFoodSource', () => {
    it('maps each source to its documented convention', () => {
      expect(FOOD_SOURCE_CARBS_CONVENTION).toEqual({
        usda: 'total',
        openfood: 'off-mixed',
        musclog: 'net',
      });
    });

    it('leaves USDA carbs unchanged (already total)', () => {
      expect(totalCarbsForFoodSource('usda', { carbs: 30, fiber: 5 })).toBe(30);
    });

    it('adds fiber for Musclog (EU net supermarket scrape)', () => {
      // Dutch "Koolhydraten" excludes fiber -> total = 25 + 5 = 30
      expect(totalCarbsForFoodSource('musclog', { carbs: 25, fiber: 5 })).toBe(30);
    });

    it('resolves Open Food Facts via the off-mixed rule', () => {
      expect(totalCarbsForFoodSource('openfood', { carbs: 25, fiber: 5 })).toBe(30);
      expect(totalCarbsForFoodSource('openfood', { carbs: 28, fiber: 3, offCarbsTotal: 31 })).toBe(
        31
      );
    });
  });

  describe('digestibleCarbs', () => {
    it('subtracts fiber from total carbs', () => {
      expect(digestibleCarbs(30, 5)).toBe(25);
    });

    it('clamps to 0 when fiber exceeds carbs', () => {
      expect(digestibleCarbs(3, 10)).toBe(0);
    });

    it('treats undefined / non-finite as 0', () => {
      expect(digestibleCarbs(undefined, undefined)).toBe(0);
      expect(digestibleCarbs(20, undefined)).toBe(20);
      expect(digestibleCarbs(NaN, 5)).toBe(0);
    });
  });

  it('round-trips: digestible(total(net)) recovers the net carbs', () => {
    const net = 25;
    const fiber = 6;
    const total = totalCarbsFromSource('net', { carbs: net, fiber });
    expect(digestibleCarbs(total, fiber)).toBe(net);
  });
});
