import { timestampSlug } from '@/utils/timestampSlug';

const SLUG_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}$/;

describe('timestampSlug', () => {
  it('renders an ISO-like slug at second precision', () => {
    expect(timestampSlug(new Date('2026-07-08T18:14:57.123Z'))).toBe('2026-07-08T18-14-57');
  });

  it('drops the milliseconds and the trailing Z', () => {
    const slug = timestampSlug(new Date('2026-07-08T18:14:57.999Z'));
    expect(slug).toHaveLength(19);
    expect(slug.endsWith('Z')).toBe(false);
    expect(slug).not.toContain('.');
  });

  it('contains no characters that are illegal in a filename', () => {
    // The whole point of the helper: backup/export filenames must survive every
    // filesystem, so ':' (invalid on Windows/macOS) and '.' must be gone.
    const slug = timestampSlug(new Date('2026-01-02T03:04:05.006Z'));
    expect(slug).not.toMatch(/[:.\\/]/);
    expect(slug).toMatch(SLUG_PATTERN);
  });

  it('is UTC-based, so the slug does not shift with the machine timezone', () => {
    // Same instant, two constructions — the epoch value is what matters.
    const instant = Date.UTC(2026, 0, 2, 3, 4, 5);
    expect(timestampSlug(new Date(instant))).toBe('2026-01-02T03-04-05');
  });

  it('zero-pads every component', () => {
    expect(timestampSlug(new Date('2026-01-02T03:04:05.000Z'))).toBe('2026-01-02T03-04-05');
  });

  it('sorts lexicographically in chronological order (backup listings rely on this)', () => {
    const instants = [
      new Date('2026-07-08T18:14:57.000Z'),
      new Date('2025-12-31T23:59:59.000Z'),
      new Date('2026-07-08T09:00:00.000Z'),
      new Date('2026-01-01T00:00:00.000Z'),
    ];

    const byTime = [...instants]
      .sort((a, b) => a.getTime() - b.getTime())
      .map((d) => timestampSlug(d));
    const bySlug = instants.map((d) => timestampSlug(d)).sort();

    expect(bySlug).toEqual(byTime);
  });

  it('is stable for the same instant', () => {
    const date = new Date('2026-07-08T18:14:57.123Z');
    expect(timestampSlug(date)).toBe(timestampSlug(date));
  });

  it('uses the current time when called with no argument', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-07T12:34:56.789Z'));
    try {
      expect(timestampSlug()).toBe('2026-08-07T12-34-56');
    } finally {
      jest.useRealTimers();
    }
  });
});
