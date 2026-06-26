import {
  buildFreshGameBoyCartridgeRam,
  decodeGameBoySave,
  stampGameBoyTodayDate,
} from '@/utils/decodeGameBoySave';

const SRAM_IMAGE_SIZE = 0x2000 * 4; // 32 KB, 4 banks
const SRAM_RTC_HOUR = 0x17; // seed-hint bytes (outside the checksummed block)
const SRAM_RTC_MINUTE = 0x18;

describe('Game Boy save seeding (encode → decode round-trip)', () => {
  const today = { year: 2026, month: 6, day: 26, hour: 14, minute: 37 };

  describe('buildFreshGameBoyCartridgeRam', () => {
    it('produces a full 32 KB image', () => {
      expect(buildFreshGameBoyCartridgeRam(today)).toHaveLength(SRAM_IMAGE_SIZE);
    });

    it('writes a valid, not-onboarded profile carrying the seeded RTC date', () => {
      const { profile } = decodeGameBoySave(buildFreshGameBoyCartridgeRam(today));

      // db_load() will only accept the seed if magic + version + checksum match.
      expect(profile.magicValid).toBe(true);
      expect(profile.version).toBe(3);
      expect(profile.checksumValid).toBe(true);

      // Must still trigger onboarding, with the date available to pre-fill.
      expect(profile.onboarded).toBe(false);
      expect(profile.rtcIsSet).toBe(true);
      expect(profile.rtcBaseDate).toBe('2026-06-26');
    });

    it('round-trips arbitrary dates including single-digit month/day', () => {
      const { profile } = decodeGameBoySave(
        buildFreshGameBoyCartridgeRam({ year: 2031, month: 1, day: 5 })
      );
      expect(profile.rtcBaseDate).toBe('2031-01-05');
      expect(profile.checksumValid).toBe(true);
    });

    it('seeds hour and minute into the (non-checksummed) seed-hint bytes', () => {
      const ram = buildFreshGameBoyCartridgeRam(today);
      expect(ram[SRAM_RTC_HOUR]).toBe(14);
      expect(ram[SRAM_RTC_MINUTE]).toBe(37);
      // The hint bytes are outside the profile block, so the checksum still holds.
      expect(decodeGameBoySave(ram).profile.checksumValid).toBe(true);
    });

    it('defaults the time to 00:00 when no hour/minute is supplied', () => {
      const ram = buildFreshGameBoyCartridgeRam({ year: 2026, month: 6, day: 26 });
      expect(ram[SRAM_RTC_HOUR]).toBe(0);
      expect(ram[SRAM_RTC_MINUTE]).toBe(0);
    });

    it('clamps out-of-range hour/minute to valid RTC ranges', () => {
      const ram = buildFreshGameBoyCartridgeRam({ ...today, hour: 30, minute: 99 });
      expect(ram[SRAM_RTC_HOUR]).toBe(23);
      expect(ram[SRAM_RTC_MINUTE]).toBe(59);
    });
  });

  describe('stampGameBoyTodayDate', () => {
    it('patches the date on an existing valid save while preserving other banks', () => {
      // Start from a valid, not-onboarded save dated in the past, then mark a
      // byte in bank 2 (the workout log bank) to prove it survives the stamp.
      const existing = buildFreshGameBoyCartridgeRam({ year: 2025, month: 1, day: 1 });
      const markerOffset = 0x2000 * 2 + 0x123;
      existing[markerOffset] = 0xab;

      const stamped = stampGameBoyTodayDate(existing, today);
      const { profile } = decodeGameBoySave(stamped);

      expect(profile.rtcBaseDate).toBe('2026-06-26');
      expect(profile.rtcIsSet).toBe(true);
      expect(profile.onboarded).toBe(false);
      expect(profile.checksumValid).toBe(true);
      expect(stamped[markerOffset]).toBe(0xab); // bank 2 untouched
      expect(stamped[SRAM_RTC_HOUR]).toBe(14); // time seeded too
      expect(stamped[SRAM_RTC_MINUTE]).toBe(37);
    });

    it('mints a fresh valid profile when the existing image is blank/invalid', () => {
      const blank = new Uint8Array(SRAM_IMAGE_SIZE); // no magic → invalid profile
      const { profile } = decodeGameBoySave(stampGameBoyTodayDate(blank, today));

      expect(profile.magicValid).toBe(true);
      expect(profile.checksumValid).toBe(true);
      expect(profile.rtcBaseDate).toBe('2026-06-26');
      expect(profile.onboarded).toBe(false);
    });

    it('resets a profile with a stale/corrupt checksum to a fresh not-onboarded save', () => {
      // Mirror what the firmware's db_load() does: a save whose checksum no longer
      // validates is junk, so a stamp must not trust its bytes (including a stray
      // onboarding bit) — it mints a fresh, not-onboarded profile instead.
      const corrupt = buildFreshGameBoyCartridgeRam({ year: 2025, month: 1, day: 1 });
      corrupt[0x06] |= 1 << 4; // set FLAGS2 onboarding bit WITHOUT re-checksumming

      const { profile } = decodeGameBoySave(stampGameBoyTodayDate(corrupt, today));

      expect(profile.checksumValid).toBe(true);
      expect(profile.onboarded).toBe(false); // corrupt onboarding bit was not trusted
      expect(profile.rtcBaseDate).toBe('2026-06-26');
    });
  });
});
