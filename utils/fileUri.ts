/**
 * Normalizes a native file path (with or without the `file://` scheme) to a URI.
 *
 * Pure, platform-agnostic string logic — kept out of the `file.ts` / `file.web.ts` platform
 * split (both of which re-export it) so the two platforms can't drift.
 */
export const toFileUri = (path: string) => (path.startsWith('file://') ? path : `file://${path}`);
