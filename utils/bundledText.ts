/** The words of one built-in row (exercise or foundation food), in some language or as stored. */
export interface BundledText {
  name: string;
  description?: string;
}

export type StoredBundledText = BundledText & { createdAt?: number; updatedAt?: number };

/** A row nobody has written to since it was created, so its words are still the bundled ones. */
export function isUntouched(row: { createdAt?: number; updatedAt?: number }): boolean {
  return row.createdAt !== undefined && row.createdAt === row.updatedAt;
}

/**
 * `stored` with its bundled words replaced by `target`'s. A field the person rewrote is returned as
 * they wrote it: a touched row's field is only replaced when it matches the copy of some bundled
 * language. An untouched row is bundled text whatever it says, so a later translation fix cannot
 * orphan it.
 */
export function swapBundledText(
  stored: StoredBundledText,
  target: BundledText,
  copies: readonly (BundledText | undefined)[]
): BundledText {
  const untouched = isUntouched(stored);
  const swap = (field: keyof BundledText) =>
    untouched || copies.some((copy) => copy !== undefined && copy[field] === stored[field]);

  return {
    name: swap('name') ? target.name : stored.name,
    description: swap('description') ? target.description : stored.description,
  };
}
