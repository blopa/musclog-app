/*
 * Decoder for the Musclog Game Boy Color save (the cartridge SRAM image that
 * WasmBoy persists to the `wasmboy` IndexedDB database as `cartridgeRam`).
 *
 * This mirrors the byte layouts defined in the GBDK firmware under `gameboy/src`
 * — keep it in sync with those files if the on-cartridge format ever changes:
 *   - profile.c / profile.h   (bank 0, 0x00) — profile + macro goals + RTC base
 *   - metrics.c  / metrics.h  (bank 0, 0x40) — body-weight log
 *   - foodlog.c  / foodlog.h  (bank 1)       — food log
 *   - workoutlog.c/.h         (bank 2)       — workout log
 *   - custom_foods.c/.h       (bank 3)       — user-created custom foods
 *   - sram.h                                 — shared little-endian + checksum
 *
 * The SRAM image is 4 banks x 8 KB = 32 KB. Names of bundled foods/exercises and
 * muscle groups are NOT stored in SRAM (only indices into the ROM tables are), so
 * those are surfaced as raw indices. Custom food names live in SRAM and ARE
 * decoded. Multi-byte values are little-endian throughout.
 *
 * Besides decoding, this module can also *write* the profile block back: it can
 * seed today's date into the RTC-base-date fields of a not-yet-onboarded save
 * (plus today's time of day into two seed-hint bytes after the block), or mint a
 * fresh save image from scratch, and persist it into WasmBoy's IndexedDB store so
 * the emulator restores it on the next loadROM(). See seedGameBoyTodayDate() at
 * the bottom of the file.
 */

const BANK_SIZE = 0x2000; // 8 KB per SRAM bank
const HASH_SEED = 0xa55a;

// Profile header (bank 0, 0x00) — mirrors profile.h / sram.h. Used by both the
// decoder above and the encoder/seeder below.
const SAVE_MAGIC = 0x4d47; // 'MG' (stored lo,hi → bytes 0x47, 0x4d)
const SAVE_VERSION = 3; // SAVE_VERSION in profile.h (v3: packed layout + RTC)
const SRAM_VERSION_OFF = 0x02;
const SRAM_CHECKSUM = 0x03; // 16-bit, occupies 0x03 + 0x04
const SRAM_FLAGS2 = 0x06;
const SRAM_RTC_YEAR_OFS = 0x14; // rtc_base_date.year - 2000
const SRAM_RTC_MONTH = 0x15;
const SRAM_RTC_DAY = 0x16;
const SRAM_SAVE_SIZE = 0x17; // 23-byte profile block (the checksummed region)
const FLAGS2_RTC_IS_SET = 1 << 5; // FLAGS2 bit 5 (FLAGS2_RTC_IS_SET_BIT)

// Onboarding seed hints, written by the web emulator right after the profile
// block — NOT covered by the profile checksum and not read by db_load/db_save.
// They carry today's time-of-day so the onboarding date/time picker pre-fills
// hour+minute (the date itself lives in the checksummed block above).
const SRAM_RTC_HOUR = 0x17; // seeded hour (0-23)
const SRAM_RTC_MINUTE = 0x18; // seeded minute (0-59)

const GENDERS = ['male', 'female', 'other'] as const;
const EXPERIENCE = ['beginner', 'intermediate', 'advanced'] as const;
const FITNESS = ['muscle', 'strength', 'endurance', 'general'] as const;
const WEIGHT_GOALS = ['lose', 'maintain', 'gain'] as const;

const CUSTOM_FOOD_BASE = 0x8000;
const MAX_CUSTOM_FOODS = 100;

type Ram = ArrayLike<number>;

// Reads bytes out of one SRAM bank, mirroring sram.h's helpers.
class BankReader {
  private base: number;

  constructor(
    private ram: Ram,
    bank: number
  ) {
    this.base = bank * BANK_SIZE;
  }

  u8(off: number): number {
    return this.ram[this.base + off] ?? 0;
  }

  u16(off: number): number {
    return this.u8(off) | (this.u8(off + 1) << 8);
  }

  // Rolling hash over `len` bytes at `off` (sram_hash). Seed new hashes with HASH_SEED.
  hash(seed: number, off: number, len: number): number {
    let sum = seed;
    for (let i = 0; i < len; i++) {
      sum = this.hashByte(sum, this.u8(off + i));
    }
    return sum;
  }

  hashByte(sum: number, b: number): number {
    return ((sum << 5) ^ (sum >> 1) ^ b) & 0xffff;
  }
}

// Map a day number (days since 2000-01-01, per rtc.c cal_day_number) to YYYY-MM-DD.
function dayNumberToISODate(dayNum: number): string {
  const ms = Date.UTC(2000, 0, 1) + dayNum * 86_400_000;
  return new Date(ms).toISOString().slice(0, 10);
}

function indexName<T extends string>(table: readonly T[], idx: number): T | number {
  return idx < table.length ? table[idx] : idx;
}

export type GameBoyProfile = {
  magicValid: boolean;
  version: number;
  checksumValid: boolean;
  onboarded: boolean;
  units: 'metric' | 'imperial';
  gender: (typeof GENDERS)[number] | number;
  activityLevel: number;
  experience: (typeof EXPERIENCE)[number] | number;
  fitnessFocus: (typeof FITNESS)[number] | number;
  weightGoal: (typeof WEIGHT_GOALS)[number] | number;
  age: number;
  heightCm: number;
  weightKg: number;
  calorieGoal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  rtcIsSet: boolean;
  rtcBaseDate: string;
};

export type GameBoyWeighIn = { date: string; dayNumber: number; weightKg: number };

export type GameBoyFoodEntry = {
  date: string;
  dayNumber: number;
  grams: number;
} & ({ bundledFoodIdx: number } | { customFoodSlot: number });

export type GameBoyWorkoutSet = { exerciseIdx: number; reps: number; weightKg: number };

export type GameBoyWorkout = {
  date: string;
  dayNumber: number;
  dominantMuscleIdx: number;
  exerciseCount: number;
  setCount: number;
  volumeKg: number;
  sets: GameBoyWorkoutSet[];
};

export type GameBoyCustomFood = {
  slot: number;
  name: string;
  // Per-100g, matching the firmware: kcal whole, macros in grams.
  kcal: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  fiberG: number;
};

export type GameBoySave = {
  profile: GameBoyProfile;
  weighIns: { checksumValid: boolean; count: number; entries: GameBoyWeighIn[] };
  foodLog: { checksumValid: boolean; count: number; entries: GameBoyFoodEntry[] };
  workouts: { checksumValid: boolean; count: number; entries: GameBoyWorkout[] };
  customFoods: { checksumValid: boolean; count: number; entries: GameBoyCustomFood[] };
};

// Rolling checksum over the 23-byte profile block with the 2 checksum bytes
// (0x03, 0x04) zeroed — mirrors db_checksum_bytes. The single source of truth
// for both validating (decodeProfile) and writing (writeProfileChecksum) it, so
// the encoder can never drift from the decoder.
function profileChecksum(ram: Ram): number {
  let sum = HASH_SEED;
  for (let i = 0; i < SRAM_SAVE_SIZE; i++) {
    const b = i === SRAM_CHECKSUM || i === SRAM_CHECKSUM + 1 ? 0 : (ram[i] ?? 0);
    sum = ((sum << 5) ^ (sum >> 1) ^ b) & 0xffff;
  }

  return sum;
}

// ── Profile + RTC base (bank 0, 0x00) — profile.c ──────────────────────────
function decodeProfile(ram: Ram): GameBoyProfile {
  const r = new BankReader(ram, 0);
  const flags1 = r.u8(0x05);
  const flags2 = r.u8(0x06);
  return {
    magicValid: r.u16(0x00) === SAVE_MAGIC,
    version: r.u8(0x02),
    checksumValid: r.u16(SRAM_CHECKSUM) === profileChecksum(ram),
    onboarded: ((flags2 >> 4) & 1) === 1,
    units: flags1 & 1 ? 'imperial' : 'metric',
    gender: indexName(GENDERS, (flags1 >> 1) & 3),
    activityLevel: ((flags1 >> 3) & 7) + 1,
    experience: indexName(EXPERIENCE, (flags1 >> 6) & 3),
    fitnessFocus: indexName(FITNESS, flags2 & 3),
    weightGoal: indexName(WEIGHT_GOALS, (flags2 >> 2) & 3),
    age: r.u8(0x07),
    heightCm: r.u8(0x08) + 120,
    weightKg: (r.u16(0x09) + 300) / 10,
    calorieGoal: r.u16(0x0b),
    proteinG: r.u16(0x0d),
    carbsG: r.u16(0x0f),
    fatG: r.u16(0x11),
    fiberG: r.u8(0x13),
    rtcIsSet: ((flags2 >> 5) & 1) === 1,
    rtcBaseDate: `${2000 + r.u8(0x14)}-${String(r.u8(0x15)).padStart(2, '0')}-${String(
      r.u8(0x16)
    ).padStart(2, '0')}`,
  };
}

// ── Body-weight log (bank 0, 0x40) — metrics.c ─────────────────────────────
function decodeWeighIns(ram: Ram): GameBoySave['weighIns'] {
  const r = new BankReader(ram, 0);
  const base = 0x40;
  const count = r.u16(base + 0x03);
  const entriesOff = base + 0x08;
  const sum = r.hash(r.hash(HASH_SEED, base + 0x03, 2), entriesOff, count * 4);
  const entries: GameBoyWeighIn[] = [];
  for (let i = 0; i < count; i++) {
    const off = entriesOff + i * 4;
    const dayNumber = r.u16(off);
    entries.push({
      date: dayNumberToISODate(dayNumber),
      dayNumber,
      weightKg: r.u16(off + 2) / 10,
    });
  }
  return {
    checksumValid: r.u16(base + 0x05) === sum && r.u16(base + 0x00) === 0x4257,
    count,
    entries,
  };
}

// ── Food log (bank 1) — foodlog.c ──────────────────────────────────────────
function decodeFoodLog(ram: Ram): GameBoySave['foodLog'] {
  const r = new BankReader(ram, 1);
  const count = r.u16(0x03);
  const entriesOff = 0x08;
  const sum = r.hash(r.hash(HASH_SEED, 0x03, 2), entriesOff, count * 6);
  const entries: GameBoyFoodEntry[] = [];
  for (let i = 0; i < count; i++) {
    const off = entriesOff + i * 6;
    const dayNumber = r.u16(off);
    const foodIdx = r.u16(off + 2);
    const common = { date: dayNumberToISODate(dayNumber), dayNumber, grams: r.u16(off + 4) };
    entries.push(
      foodIdx >= CUSTOM_FOOD_BASE
        ? { ...common, customFoodSlot: foodIdx - CUSTOM_FOOD_BASE }
        : { ...common, bundledFoodIdx: foodIdx }
    );
  }
  return { checksumValid: r.u16(0x05) === sum && r.u16(0x00) === 0x464c, count, entries };
}

// ── Workout log (bank 2, variable-length records) — workoutlog.c ───────────
function decodeWorkouts(ram: Ram): GameBoySave['workouts'] {
  const r = new BankReader(ram, 2);
  const count = r.u8(0x03);
  const bytesUsed = r.u16(0x04);
  const recordsOff = 0x08;
  let sum = r.hashByte(r.hashByte(r.hashByte(HASH_SEED, count), bytesUsed & 0xff), bytesUsed >> 8);
  sum = r.hash(sum, recordsOff, bytesUsed);

  const entries: GameBoyWorkout[] = [];
  let off = recordsOff;
  for (let i = 0; i < count; i++) {
    const dayNumber = r.u16(off);
    const setCount = r.u8(off + 4);
    const sets: GameBoyWorkoutSet[] = [];
    for (let s = 0; s < setCount; s++) {
      const setOff = off + 7 + s * 4;
      sets.push({
        exerciseIdx: r.u8(setOff),
        reps: r.u8(setOff + 1),
        weightKg: r.u16(setOff + 2) / 10,
      });
    }
    entries.push({
      date: dayNumberToISODate(dayNumber),
      dayNumber,
      dominantMuscleIdx: r.u8(off + 2),
      exerciseCount: r.u8(off + 3),
      setCount,
      volumeKg: r.u16(off + 5),
      sets,
    });
    off += 7 + setCount * 4;
  }
  return { checksumValid: r.u16(0x06) === sum && r.u16(0x00) === 0x574c, count, entries };
}

// ── Custom foods (bank 3, 100 fixed 26-byte slots) — custom_foods.c ────────
function decodeCustomFoods(ram: Ram): GameBoySave['customFoods'] {
  const r = new BankReader(ram, 3);
  const entriesOff = 0x08;
  const entriesBytes = MAX_CUSTOM_FOODS * 26;
  const sum = r.hash(HASH_SEED, entriesOff, entriesBytes);
  const entries: GameBoyCustomFood[] = [];
  for (let slot = 0; slot < MAX_CUSTOM_FOODS; slot++) {
    const off = entriesOff + slot * 26;
    if (r.u8(off) === 0) {
      continue; // empty / tombstoned slot (name[0] == '\0')
    }
    let name = '';
    for (let i = 0; i < 16 && r.u8(off + i) !== 0; i++) {
      name += String.fromCharCode(r.u8(off + i));
    }
    entries.push({
      slot,
      name,
      kcal: r.u16(off + 16),
      proteinG: r.u16(off + 18) / 10,
      fatG: r.u16(off + 20) / 10,
      carbsG: r.u16(off + 22) / 10,
      fiberG: r.u16(off + 24) / 10,
    });
  }
  return {
    checksumValid: r.u16(0x04) === sum && r.u16(0x00) === 0x4346,
    count: entries.length,
    entries,
  };
}

/* Decode a full 32 KB cartridge-SRAM image into its structured save data. */
export function decodeGameBoySave(ram: Ram): GameBoySave {
  return {
    profile: decodeProfile(ram),
    weighIns: decodeWeighIns(ram),
    foodLog: decodeFoodLog(ram),
    workouts: decodeWorkouts(ram),
    customFoods: decodeCustomFoods(ram),
  };
}

/*
 * Read every saved cartridge out of the `wasmboy` IndexedDB database and decode
 * it. Browser-only (uses indexedDB). Resolves to one decoded save per stored
 * cartridge (usually just one).
 *
 * Goes through openWasmBoyKeyval() (DB `wasmboy` v1, store `keyval`) and closes
 * the connection when done. Using the shared opener — rather than a version-less
 * indexedDB.open() — is important: a version-less open creates the DB *without*
 * the `keyval` store, which then breaks every later open (ours and WasmBoy's own
 * boot) because the store can no longer be added at the pinned v1.
 */
export async function readAndDecodeGameBoySaves(): Promise<GameBoySave[]> {
  if (typeof indexedDB === 'undefined') {
    return [];
  }

  const db = await openWasmBoyKeyval();
  try {
    const rows = await keyvalGetAll<{ cartridgeRam?: Ram }>(db);
    return rows
      .filter((row) => row.cartridgeRam != null)
      .map((row) => decodeGameBoySave(row.cartridgeRam as Ram));
  } finally {
    db.close();
  }
}

/* ──────────────────────────────────────────────────────────────────────────
 * Encoding / seeding — write today's date into the cartridge SRAM
 *
 * WasmBoy persists each game's battery-backed SRAM to the IndexedDB database
 * `wasmboy` (object store `keyval`, idb-keyval schema: DB version 1, out-of-line
 * keys). The record key is the 27-byte cartridge header at ROM offset 0x134, and
 * the value is `{ cartridgeRam: Uint8Array(32768), ... }`. WasmBoy restores
 * `cartridgeRam` into the live cartridge inside loadROM(), so writing this record
 * *before* loadROM() lets us pre-seed save data the ROM then reads at boot.
 *
 * We use that to hand the ROM today's real calendar date (the Game Boy has no
 * wall clock): if the player has not finished onboarding yet, we stamp today's
 * date into the RTC base-date fields (profile.h SRAM_RTC_*). The ROM's
 * onboarding flow preserves that seed across its db_init_defaults() reset and
 * pre-fills the date/time picker with it (see gameboy/src/onboarding.c).
 * ────────────────────────────────────────────────────────────────────────── */

const WASMBOY_DB_NAME = 'wasmboy';
const WASMBOY_DB_VERSION = 1;
const WASMBOY_STORE_NAME = 'keyval';
const CARTRIDGE_HEADER_OFFSET = 0x134;
const CARTRIDGE_HEADER_LENGTH = 27;
const SRAM_IMAGE_SIZE = BANK_SIZE * 4; // full 32 KB cartridge RAM

export type GameBoyCalDate = { year: number; month: number; day: number };

// A calendar date plus an optional time-of-day. The seeder writes the date into
// the checksummed profile block and the (optional) hour/minute into the seed-hint
// bytes; both pre-fill the onboarding date/time picker.
export type GameBoySeedInstant = GameBoyCalDate & { hour?: number; minute?: number };

/* Outcome of a seed attempt, mainly for logging/tests. */
export type SeedGameBoyDateResult =
  | 'created' // no save existed; minted a fresh image seeded with the date
  | 'patched' // save existed but onboarding was incomplete; stamped the date
  | 'already-onboarded' // save exists and onboarding is done; left untouched
  | 'unavailable'; // IndexedDB not available (e.g. SSR)

function writeProfileChecksum(ram: Uint8Array): void {
  const sum = profileChecksum(ram);
  ram[SRAM_CHECKSUM] = sum & 0xff;
  ram[SRAM_CHECKSUM + 1] = (sum >> 8) & 0xff;
}

// Clamp to an integer in [min, max]; non-finite input falls back to min.
const clampInt = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, Math.trunc(Number.isFinite(value) ? value : min)));

function writeRtcDate(ram: Uint8Array, date: GameBoyCalDate): void {
  ram[SRAM_FLAGS2] = (ram[SRAM_FLAGS2] ?? 0) | FLAGS2_RTC_IS_SET;
  ram[SRAM_RTC_YEAR_OFS] = (date.year - 2000) & 0xff;
  ram[SRAM_RTC_MONTH] = clampInt(date.month, 1, 12);
  ram[SRAM_RTC_DAY] = clampInt(date.day, 1, 31);
}

// Write today's time-of-day into the seed-hint bytes (outside the checksummed
// block, so this is independent of writeProfileChecksum). Clamped to valid RTC
// ranges; defaults to 00:00 when no time is supplied.
function writeSeedTime(ram: Uint8Array, instant: GameBoySeedInstant): void {
  ram[SRAM_RTC_HOUR] = clampInt(instant.hour ?? 0, 0, 23);
  ram[SRAM_RTC_MINUTE] = clampInt(instant.minute ?? 0, 0, 59);
}

// Stamp today's date into the RTC base-date fields of an existing (valid v3,
// not-onboarded) profile block, preserving every other byte, then re-checksum.
function seedExistingProfileDate(ram: Uint8Array, date: GameBoyCalDate): void {
  writeRtcDate(ram, date);
  writeProfileChecksum(ram);
}

// Mint a minimal valid profile block: magic + version + rtc_is_set + date, with
// onboarding_complete = 0 so the ROM still runs onboarding. Every other profile
// field is left 0; the ROM's db_init_defaults() resets them during onboarding.
function writeFreshProfileBlock(ram: Uint8Array, date: GameBoyCalDate): void {
  for (let i = 0; i < SRAM_SAVE_SIZE; i++) {
    ram[i] = 0;
  }
  ram[0x00] = SAVE_MAGIC & 0xff;
  ram[0x01] = (SAVE_MAGIC >> 8) & 0xff;
  ram[SRAM_VERSION_OFF] = SAVE_VERSION;
  writeRtcDate(ram, date); // sets FLAGS2 rtc_is_set bit + date bytes
  writeProfileChecksum(ram);
}

/*
 * Build a fresh 32 KB cartridge image whose profile block carries `date` as the
 * RTC base date (rtc_is_set=1) and onboarding_complete=0, with every other bank
 * empty (the ROM's *_init() routines reset empty banks on boot). Pure — exported
 * for the seeder below and for tests.
 */
export function buildFreshGameBoyCartridgeRam(
  today: GameBoySeedInstant = localToday()
): Uint8Array {
  const ram = new Uint8Array(SRAM_IMAGE_SIZE);
  writeFreshProfileBlock(ram, today);
  writeSeedTime(ram, today);
  return ram;
}

// Mirrors the firmware's db_load() acceptance test: a save is loadable only when
// magic, version, and the profile checksum all validate. Anything else makes
// db_load() reject the save and re-run onboarding, so the seeder must treat such
// a profile as junk (mint fresh) rather than trusting its bytes.
function isLoadableProfile(profile: GameBoyProfile): boolean {
  return profile.magicValid && profile.version === SAVE_VERSION && profile.checksumValid;
}

/*
 * Return a 32 KB copy of `existing` (other banks — weigh-ins, food log, workouts,
 * custom foods — preserved) with `date` stamped into the profile's RTC base date.
 * A loadable v3 profile (valid magic + version + checksum) is patched in place;
 * anything else gets a fresh profile block. Pure — exported for the seeder below
 * and for tests.
 */
export function stampGameBoyTodayDate(
  existing: Ram,
  today: GameBoySeedInstant = localToday()
): Uint8Array {
  const ram = new Uint8Array(SRAM_IMAGE_SIZE);
  const src = toUint8Array(existing);
  ram.set(src.subarray(0, Math.min(src.length, ram.length)));

  if (isLoadableProfile(decodeProfile(ram))) {
    seedExistingProfileDate(ram, today);
  } else {
    writeFreshProfileBlock(ram, today);
  }
  writeSeedTime(ram, today);
  return ram;
}

// The 27-byte cartridge header WasmBoy uses as the IndexedDB record key.
function cartridgeHeaderKey(rom: Ram): Uint8Array<ArrayBuffer> {
  const header = new Uint8Array(CARTRIDGE_HEADER_LENGTH);
  for (let i = 0; i < CARTRIDGE_HEADER_LENGTH; i++) {
    header[i] = rom[CARTRIDGE_HEADER_OFFSET + i] ?? 0;
  }
  return header;
}

function toUint8Array(ram: Ram): Uint8Array {
  return ram instanceof Uint8Array ? ram : Uint8Array.from(ram as ArrayLike<number>);
}

function localToday(): GameBoySeedInstant {
  const now = new Date();
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    day: now.getDate(),
    hour: now.getHours(),
    minute: now.getMinutes(),
  };
}

// Open DB `wasmboy` v1, creating the `keyval` store if this is the first open.
function openWasmBoyKeyvalRaw(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(WASMBOY_DB_NAME, WASMBOY_DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(WASMBOY_STORE_NAME)) {
        request.result.createObjectStore(WASMBOY_STORE_NAME);
      }
    };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

function deleteWasmBoyDb(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(WASMBOY_DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    // Another open connection is blocking the delete; it will complete (firing
    // onsuccess) once that connection closes, so just wait it out.
    request.onblocked = () => {};
  });
}

/*
 * Open WasmBoy's idb-keyval store (`wasmboy` DB v1, `keyval` store), guaranteeing
 * the store exists. WasmBoy pins the DB to version 1, so the store can only be
 * created during the v1 upgrade. Self-heals one broken state: a `wasmboy` DB
 * left at v1 *without* the `keyval` store — which happens when something opens
 * the DB with no version (creating it store-less) before WasmBoy or this module
 * does. Such a DB holds no save data, so we delete and recreate it with the
 * store; otherwise both this seeder and WasmBoy's own boot fail on
 * `transaction('keyval')`.
 */
async function openWasmBoyKeyval(): Promise<IDBDatabase> {
  let db = await openWasmBoyKeyvalRaw();
  if (db.objectStoreNames.contains(WASMBOY_STORE_NAME)) {
    return db;
  }
  db.close();
  await deleteWasmBoyDb();
  db = await openWasmBoyKeyvalRaw();
  return db;
}

function keyvalGet<T>(db: IDBDatabase, key: BufferSource): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const request = db
      .transaction(WASMBOY_STORE_NAME, 'readonly')
      .objectStore(WASMBOY_STORE_NAME)
      .get(key);
    request.onsuccess = () => resolve(request.result as T | undefined);
    request.onerror = () => reject(request.error);
  });
}

function keyvalGetAll<T>(db: IDBDatabase): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const request = db
      .transaction(WASMBOY_STORE_NAME, 'readonly')
      .objectStore(WASMBOY_STORE_NAME)
      .getAll();
    request.onsuccess = () => resolve(request.result as T[]);
    request.onerror = () => reject(request.error);
  });
}

function keyvalPut(db: IDBDatabase, key: BufferSource, value: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(WASMBOY_STORE_NAME, 'readwrite');
    tx.objectStore(WASMBOY_STORE_NAME).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

/*
 * Seed today's date into the Game Boy save for the given ROM, but only while the
 * player has not finished onboarding:
 *   - no save yet            → mint a fresh 32 KB image seeded with the date
 *   - save, not onboarded    → stamp the date into the existing image
 *   - save, already onboarded → leave it untouched (returns 'already-onboarded')
 *
 * Must be called BEFORE WasmBoy.loadROM() so the emulator restores the seeded
 * RAM. Browser-only. `rom` is the raw ROM bytes (used to derive the record key).
 */
export async function seedGameBoyTodayDate(
  rom: Ram,
  today: GameBoySeedInstant = localToday()
): Promise<SeedGameBoyDateResult> {
  if (typeof indexedDB === 'undefined') {
    return 'unavailable';
  }

  const key = cartridgeHeaderKey(rom);
  const db = await openWasmBoyKeyval();
  try {
    const record = (await keyvalGet<{ cartridgeRam?: Ram }>(db, key)) ?? {};
    const existing = record.cartridgeRam;

    // Only treat the save as onboarded when db_load() would actually accept it
    // (valid magic + version + checksum). A profile whose checksum fails is
    // rejected by the ROM and re-onboarded, so we must still seed it.
    if (existing != null) {
      const profile = decodeProfile(existing);
      if (isLoadableProfile(profile) && profile.onboarded) {
        return 'already-onboarded';
      }
    }

    const ram =
      existing != null
        ? stampGameBoyTodayDate(existing, today)
        : buildFreshGameBoyCartridgeRam(today);
    await keyvalPut(db, key, { ...record, cartridgeRam: ram });
    return existing != null ? 'patched' : 'created';
  } finally {
    db.close();
  }
}
