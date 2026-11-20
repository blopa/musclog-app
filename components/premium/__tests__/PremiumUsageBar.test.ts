import { readFileSync } from 'fs';
import { join } from 'path';

import { formatRenewalDate, usageTone } from '@/components/premium/PremiumUsageBar';

const source = readFileSync(join(__dirname, '..', 'PremiumUsageBar.tsx'), 'utf8');

describe('usageTone', () => {
  it('stays normal below the warning threshold', () => {
    expect(usageTone(0)).toBe('normal');
    expect(usageTone(79)).toBe('normal');
  });

  it('switches to warning at 80 percent', () => {
    expect(usageTone(80)).toBe('warning');
    expect(usageTone(99)).toBe('warning');
  });

  it('switches to error at 100 percent', () => {
    expect(usageTone(100)).toBe('error');
    expect(usageTone(120)).toBe('error');
  });
});

describe('formatRenewalDate', () => {
  it('returns null for a missing or unreadable instant', () => {
    expect(formatRenewalDate(null, 'en-US')).toBeNull();
    expect(formatRenewalDate('not a date', 'en-US')).toBeNull();
  });

  it('formats a readable instant in the given locale', () => {
    const formatted = formatRenewalDate('2026-12-01T00:00:00.000Z', 'en-US');

    expect(formatted).toMatch(/2026/);
    expect(formatted).toMatch(/Dec/);
  });
});

describe('PremiumUsageBar source', () => {
  it('exposes the bar as a progressbar with its value', () => {
    expect(source).toContain('accessibilityRole="progressbar"');
    expect(source).toContain('accessibilityValue={{ min: 0, max: 100');
  });

  it('draws no glow or shadow', () => {
    expect(source).not.toMatch(/shadow/i);
  });

  it('says the warning and full states in text as well as colour', () => {
    expect(source).toContain("t('premium.usage.nearLimit')");
    expect(source).toContain("t('premium.usage.full')");
  });
});
