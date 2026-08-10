/**
 * The send card's size readout.
 *
 * What is being pinned is the small end. Every size below 1 MB used to round to whole KB, which is
 * right for a database dump and useless for a single food: a share is 1–5 KB, so turning the photo
 * toggle on printed a byte-for-byte identical "1 KB to transfer (4 KB of data)" and the toggle read
 * as broken.
 */

import { formatTransferBytes } from '@/components/modals/opticalSendBytes';
import { formatAppInteger, formatAppRoundedDecimal } from '@/utils/formatAppNumber';

function formatters(locale: string) {
  return {
    formatInteger: (value: number) => formatAppInteger(locale, value),
    formatRoundedDecimal: (value: number, digits: number, options?: Intl.NumberFormatOptions) =>
      formatAppRoundedDecimal(locale, value, digits, options),
  };
}

const en = formatters('en-US');

describe('formatTransferBytes', () => {
  it('keeps one decimal at share sizes, where whole KB hides the differences', () => {
    expect(formatTransferBytes(993, en)).toBe('1.0 KB');
    expect(formatTransferBytes(2082, en)).toBe('2.0 KB');
    expect(formatTransferBytes(2181, en)).toBe('2.1 KB');
  });

  // The regression itself: a food and the same food with its photo linked used to print the same
  // string at every size, because both rounded to the same whole KB.
  it('separates a payload from the same payload with a photo added', () => {
    const withoutPhoto = formatTransferBytes(4096, en);
    const withLinkedPhoto = formatTransferBytes(4096 + 190, en);

    expect(withoutPhoto).toBe('4.0 KB');
    expect(withLinkedPhoto).not.toBe(withoutPhoto);
  });

  it('drops the decimal once a payload is large enough for it to be noise', () => {
    expect(formatTransferBytes(10 * 1024, en)).toBe('10 KB');
    expect(formatTransferBytes(27559, en)).toBe('27 KB');
    expect(formatTransferBytes(650 * 1024, en)).toBe('650 KB');
  });

  it('switches to MB for a database-sized payload', () => {
    expect(formatTransferBytes(1024 * 1024, en)).toBe('1.0 MB');
    expect(formatTransferBytes(3.25 * 1024 * 1024, en)).toBe('3.3 MB');
  });

  // Sizes are user-visible numbers, so they go through the app's locale formatters rather than
  // `toFixed` — a German or Brazilian user must see "2,1 KB".
  it('formats through the caller’s locale', () => {
    const de = formatters('de-DE');

    expect(formatTransferBytes(2181, de)).toBe('2,1 KB');
    expect(formatTransferBytes(1024 * 1024, de)).toBe('1,0 MB');
  });
});
