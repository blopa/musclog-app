import gameBoyOpticalProtocol from '@/data/gameBoyOpticalProtocol.json';
import { appExerciseId } from '@/utils/exerciseImage';

/**
 * Frozen cartridge exercise table order, shared with `gameboy/tools/gen-exercises.mjs`.
 *
 * A cartridge stores a logged set's exercise as the 0-based index into this list, and the
 * optical export sends that same index. It is deliberately NOT the catalogue's
 * `exerciseIndex`, which is alphabetical display order over all 873 entries and shifts
 * whenever free-exercise-db gains a row. Append only; reordering silently re-points every
 * `.sav` file and every past export at a different movement.
 */
export const GAME_BOY_EXERCISE_SLUGS: readonly string[] = gameBoyOpticalProtocol.exerciseSlugs;

/** Id used for a cartridge exercise this build cannot map onto the bundled catalogue. */
export function unmappedGameBoyExerciseId(cartridgeIndex: number): string {
  return `gb-e-${cartridgeIndex}`;
}

/**
 * Resolves a cartridge exercise index to the bundled catalogue exercise's database id.
 *
 * Returns `null` when the index is outside the frozen list, which happens only when the
 * cartridge is newer than this build. The caller then falls back to creating a plain user
 * exercise from the tuple the cartridge sent, so a newer ROM still imports — it just loses
 * the localized name, photos and target muscles for the movements this build has never
 * heard of.
 */
export function catalogueExerciseIdForCartridgeIndex(cartridgeIndex: number): null | string {
  const slug = GAME_BOY_EXERCISE_SLUGS[cartridgeIndex];
  return slug ? appExerciseId(slug) : null;
}
