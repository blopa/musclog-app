import premiumCopy from '@/lang/locales/en-us/websitePremium.json';

const copy = premiumCopy.websitePremium;

describe('Premium page copy (en-us)', () => {
  it('has non-empty lists for every section that renders one', () => {
    for (const list of [copy.free.items, copy.how.steps, copy.subscription.items, copy.faq.items]) {
      expect(Array.isArray(list)).toBe(true);
      expect(list.length).toBeGreaterThan(0);
    }
  });

  it('gives every question an answer', () => {
    for (const item of copy.faq.items) {
      expect(item.q.trim()).not.toBe('');
      expect(item.a.trim()).not.toBe('');
    }
  });

  it('names no price figure', () => {
    expect(JSON.stringify(copy)).not.toMatch(/[$€£]\s?\d|\d\s?(USD|EUR)/);
  });
});
