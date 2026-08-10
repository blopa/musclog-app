/**
 * Optical transfer — how the send screen states a payload's size.
 *
 * Lives beside the modal rather than inside it so the thresholds are testable without a renderer,
 * the same way `opticalReceiveScreen.ts` holds the receive modal's screen resolution.
 *
 * The rule that matters is the small end. The card used to round every size below 1 MB with
 * `Math.round(bytes / 1024)`, which is fine for a database dump and useless for a single food:
 * a share is 1–5 KB, so turning the photo toggle on and adding a ~90-byte photo URL produced a
 * byte-for-byte identical "1 KB to transfer (4 KB of data)". The toggle read as broken. One
 * decimal below 10 KB makes changes at that scale visible; above it the fraction is noise.
 */

export interface TransferByteFormatters {
  formatInteger: (value: number) => string;
  formatRoundedDecimal: (
    value: number,
    fractionDigits: number,
    options?: Intl.NumberFormatOptions
  ) => string;
}

const KB = 1024;
const MB = 1024 * 1024;

/** Below this, a whole-KB readout hides the differences a share-sized payload is made of. */
const DECIMAL_KB_CEILING = 10 * KB;

/**
 * The app's decimal formatter drops a trailing zero by default, which would print one payload as
 * "2 KB" and the next as "2.1 KB" — a readout whose precision changes with the value reads as a
 * glitch, so the decimal place is pinned on.
 */
const ONE_DECIMAL: Intl.NumberFormatOptions = { minimumFractionDigits: 1 };

export function formatTransferBytes(bytes: number, format: TransferByteFormatters): string {
  if (bytes < DECIMAL_KB_CEILING) {
    return `${format.formatRoundedDecimal(bytes / KB, 1, ONE_DECIMAL)} KB`;
  }

  if (bytes < MB) {
    return `${format.formatInteger(Math.round(bytes / KB))} KB`;
  }

  return `${format.formatRoundedDecimal(bytes / MB, 1, ONE_DECIMAL)} MB`;
}
