/**
 * UTC offset as a fixed "±HH:MM" string (e.g. "-05:00", "+05:30", "+00:00"), captured at
 * the moment a record is written. Stored alongside log timestamps (nutrition_logs.timezone,
 * workout_logs.timezone, user_metrics.timezone) so history can later be shown at the
 * wall-clock offset it was recorded in, independent of where it is viewed.
 *
 * A fixed offset (rather than an IANA zone name like "America/New_York") is used so every
 * source stores the same format: locally-entered records and records imported from Health
 * Connect, which only exposes the raw UTC offset. Tradeoff: the offset does not carry DST
 * rules or the zone identity — only the wall-clock offset in effect when written.
 */
export function getCurrentTimezone(): string {
  // getTimezoneOffset() returns minutes *behind* UTC (UTC-5 → +300), so negate it.
  return offsetMinutesToTimezone(-new Date().getTimezoneOffset());
}

/**
 * UTC offset for the device-local timezone at a specific instant/date.
 * Use for future calendar-day records so DST-sensitive offsets are captured for
 * the day being stored, not for "now".
 */
export function getTimezoneAt(date: Date | number): string {
  const d = typeof date === 'number' ? new Date(date) : date;
  return offsetMinutesToTimezone(-d.getTimezoneOffset());
}

/**
 * Format a UTC offset given in minutes east of UTC as a "±HH:MM" string.
 * e.g. -300 → "-05:00", 330 → "+05:30", 0 → "+00:00".
 */
export function offsetMinutesToTimezone(offsetMinutes: number): string {
  const sign = offsetMinutes < 0 ? '-' : '+';
  const abs = Math.abs(Math.trunc(offsetMinutes));
  const hh = String(Math.floor(abs / 60)).padStart(2, '0');
  const mm = String(abs % 60).padStart(2, '0');
  return `${sign}${hh}:${mm}`;
}

/**
 * Resolve the UTC offset ("±HH:MM") in effect for an IANA zone at a given instant.
 * Used to normalize IANA zone names (e.g. from HealthKit's HKTimeZone metadata) into the
 * app's offset format, accounting for DST at that instant. Returns undefined if the zone
 * cannot be resolved.
 */
export function ianaZoneToTimezoneAt(ianaZone: string, date: Date): string | undefined {
  try {
    // Render the instant as wall-clock time in the target zone, reinterpret those fields as
    // UTC, and diff against the real instant to recover the offset. Works on any Intl that
    // supports timeZone formatting (already a baseline requirement of the app).
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: ianaZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).formatToParts(date);

    const map: Record<string, string> = {};
    for (const part of parts) {
      map[part.type] = part.value;
    }

    const asUtc = Date.UTC(
      Number(map.year),
      Number(map.month) - 1,
      Number(map.day),
      Number(map.hour),
      Number(map.minute),
      Number(map.second)
    );

    if (Number.isNaN(asUtc)) {
      return undefined;
    }

    return offsetMinutesToTimezone(Math.round((asUtc - date.getTime()) / 60000));
  } catch {
    return undefined;
  }
}

/**
 * True when `value` is already in the app's "±HH:MM" offset format (e.g. "-05:00", "+09:00").
 */
export function isTimezoneOffset(value: string): boolean {
  return /^[+-]\d{2}:\d{2}$/.test(value);
}

/**
 * Parse a "±HH:MM" offset string into minutes east of UTC — the inverse of
 * {@link offsetMinutesToTimezone}. Returns null when `value` is not a valid offset.
 * e.g. "-05:00" → -300, "+05:30" → 330, "+00:00" → 0.
 */
export function parseTimezoneOffsetMinutes(value: string): number | null {
  if (!isTimezoneOffset(value)) {
    return null;
  }

  const sign = value[0] === '-' ? -1 : 1;
  const hours = parseInt(value.slice(1, 3), 10);
  const minutes = parseInt(value.slice(4, 6), 10);
  return sign * (hours * 60 + minutes);
}

/**
 * Normalize a stored or imported timezone value to the app's "±HH:MM" offset format. Values
 * already in offset form are returned unchanged; IANA zone names (e.g. "America/New_York") are
 * resolved to the offset in effect at `atDate` (DST-aware). Empty or unresolvable values are
 * returned unchanged so callers never lose data.
 */
export function normalizeTimezoneToOffset(value: string, atDate: Date): string {
  if (!value || isTimezoneOffset(value)) {
    return value;
  }
  return ianaZoneToTimezoneAt(value, atDate) ?? value;
}
