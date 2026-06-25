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
 */

const BANK_SIZE = 0x2000; // 8 KB per SRAM bank
const HASH_SEED = 0xa55a;

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

// ── Profile + RTC base (bank 0, 0x00) — profile.c ──────────────────────────
function decodeProfile(ram: Ram): GameBoyProfile {
  const r = new BankReader(ram, 0);
  // Checksum hashes the 23-byte block with the 2 checksum bytes (0x03,0x04) zeroed.
  let sum = HASH_SEED;
  for (let i = 0; i < 0x17; i++) {
    sum = r.hashByte(sum, i === 0x03 || i === 0x04 ? 0 : r.u8(i));
  }
  const flags1 = r.u8(0x05);
  const flags2 = r.u8(0x06);
  return {
    magicValid: r.u16(0x00) === 0x4d47,
    version: r.u8(0x02),
    checksumValid: r.u16(0x03) === sum,
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
 */
export function readAndDecodeGameBoySaves(): Promise<GameBoySave[]> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      resolve([]);
      return;
    }

    const request = indexedDB.open('wasmboy');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      if (db.objectStoreNames.length === 0) {
        resolve([]);
        return;
      }
      const storeName = db.objectStoreNames[0];
      const getAll = db.transaction(storeName, 'readonly').objectStore(storeName).getAll();
      getAll.onerror = () => reject(getAll.error);
      getAll.onsuccess = () => {
        const saves = (getAll.result as { cartridgeRam?: Ram }[])
          .filter((row) => row.cartridgeRam != null)
          .map((row) => decodeGameBoySave(row.cartridgeRam as Ram));
        resolve(saves);
      };
    };
  });
}
