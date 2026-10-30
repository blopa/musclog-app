/** The image type each base64 prefix (the encoding of the file's first bytes) identifies. */
const MIME_BY_BASE64_PREFIX: [prefix: string, mime: string][] = [
  ['iVBOR', 'image/png'],
  ['UklGR', 'image/webp'],
];

/**
 * Wraps a raw base64 image (what `createThumbnail` returns) in a data URI. The MIME type is read
 * from the first bytes of the image, because native re-encodes to JPEG while web's canvas produces
 * PNG, and a wrong type makes some renderers refuse the image.
 */
export function dataUriFromBase64(base64: string): string {
  const mime =
    MIME_BY_BASE64_PREFIX.find(([prefix]) => base64.startsWith(prefix))?.[1] ?? 'image/jpeg';

  return `data:${mime};base64,${base64}`;
}
