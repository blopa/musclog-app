/**
 * Stable session keys. Built from the date text as read in the file (not epoch
 * ms), so the same file gives the same keys on every device and timezone, and
 * independent of the weight unit.
 */
import { parseDateText } from './parseDate';
import type { ImportedSession, WorkoutImportSource } from './types';

export function buildImportKey(
  source: WorkoutImportSource,
  rawStart: string,
  workoutName: string
): string {
  const name = collapseSpaces(workoutName);
  return `${source}:${hash64Hex(`${canonicalStart(rawStart)}\u001f${name}`)}`;
}

/** Separates a session's key from the index of a cardio log it wrote. */
export const CARDIO_KEY_INFIX = '#cardio';

export function cardioImportKey(sessionKey: string, index: number): string {
  return `${sessionKey}${CARDIO_KEY_INFIX}${index}`;
}

/** Every key a session writes. A cardio-only session has no strength log, so all of them count. */
export function sessionImportKeys(session: ImportedSession): string[] {
  return [
    session.importKey,
    ...session.cardio.map((_, index) => cardioImportKey(session.importKey, index)),
  ];
}

/** Whether any key the session writes is already in `keys` (the live keys, or those queued so far). */
export function isSessionPresent(session: ImportedSession, keys: ReadonlySet<string>): boolean {
  return sessionImportKeys(session).some((key) => keys.has(key));
}

function canonicalStart(raw: string): string {
  const parsed = parseDateText(raw);
  if (!parsed) {
    return `raw:${collapseSpaces(raw)}`;
  }

  if (parsed.zoned) {
    // Zoned text is kept as written: converting it would depend on the device's timezone.
    return `zoned:${collapseSpaces(raw).toUpperCase()}`;
  }

  return `wall:${parsed.day}|${parsed.startMinutes ?? ''}`;
}

function collapseSpaces(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

const FNV_PRIME = 0x01000193;
const FNV_OFFSET_A = 0x811c9dc5;
const FNV_OFFSET_B = 0x9e3779b9;

function fnv1a(text: string, seed: number): number {
  let hash = seed >>> 0;
  for (let k = 0; k < text.length; k++) {
    hash ^= text.charCodeAt(k);
    hash = Math.imul(hash, FNV_PRIME) >>> 0;
  }

  return hash >>> 0;
}

/** Two FNV-1a passes with different seeds: 64 bits as 16 hex characters. */
function hash64Hex(text: string): string {
  return (
    fnv1a(text, FNV_OFFSET_A).toString(16).padStart(8, '0') +
    fnv1a(text, FNV_OFFSET_B).toString(16).padStart(8, '0')
  );
}
