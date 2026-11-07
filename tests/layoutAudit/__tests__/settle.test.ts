import { maskClocks, STABLE_TEXT_MAX_READS, type TextReader, waitForStableText } from '../settle';

/** A page whose text is the next entry of `texts` on each read (the last one repeats). */
function pageReading(texts: string[]): TextReader & { reads: () => number } {
  let reads = 0;
  return {
    evaluate: async () => texts[Math.min(reads++, texts.length - 1)],
    waitForTimeout: async () => undefined,
    reads: () => reads,
  };
}

describe('maskClocks', () => {
  it('masks hh:mm:ss and m:ss clocks but leaves other numbers alone', () => {
    expect(maskClocks('Total time 00:01:44')).toBe('Total time #:##');
    expect(maskClocks('Rest 0:58 left')).toBe('Rest #:## left');
    expect(maskClocks('3 sets · 12 reps · 44,1 lb')).toBe('3 sets · 12 reps · 44,1 lb');
  });

  it('makes two readings of a ticking clock equal, and two different words not', () => {
    expect(maskClocks('Rest 1:30')).toBe(maskClocks('Rest 1:29'));
    expect(maskClocks('Loading')).not.toBe(maskClocks('Loaded'));
  });
});

describe('waitForStableText', () => {
  it('settles after two equal reads when the text is already still', async () => {
    const page = pageReading(['Hello']);
    // The first read differs from the empty start, then one repeat is a stable pair.
    expect(await waitForStableText(page)).toBe(3);
  });

  it('is not held up by a clock that ticks on every read (a live workout)', async () => {
    const ticking = Array.from(
      { length: 30 },
      (_, i) => `Total time 00:01:${10 + i} Rest 0:${59 - i}`
    );
    const page = pageReading(ticking);
    // Raw text would never repeat and run to the cap; masked it settles at once.
    expect(await waitForStableText(page)).toBe(3);
  });

  it('keeps waiting while real words are still arriving, then settles', async () => {
    const page = pageReading(['', 'Loading', 'Loading…', 'Workout', 'Workout', 'Workout']);
    expect(await waitForStableText(page)).toBe(6);
  });

  it('gives up at the cap on text that never settles, instead of waiting forever', async () => {
    const page = pageReading(Array.from({ length: 200 }, (_, i) => `row ${i}`));
    expect(await waitForStableText(page)).toBe(STABLE_TEXT_MAX_READS);
  });

  it('treats a page that cannot be read as empty text rather than throwing', async () => {
    const page: TextReader = {
      evaluate: () => Promise.reject(new Error('navigating')),
      waitForTimeout: async () => undefined,
    };
    await expect(waitForStableText(page)).resolves.toBeGreaterThan(0);
  });
});
