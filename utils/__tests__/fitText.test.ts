import {
  fitLabelFontSize,
  fitLineFontSize,
  labelsFitEvenly,
  layoutActionLabel,
  longestWord,
} from '@/utils/fitText';

describe('longestWord', () => {
  it('is the widest word, across spaces and line breaks', () => {
    expect(longestWord('Iniciar\nEntrenamiento')).toBe('Entrenamiento');
    expect(longestWord('Registrar Comida')).toBe('Registrar');
    expect(longestWord('')).toBe('');
  });
});

describe('fitLabelFontSize', () => {
  const options = { maxSize: 24, minSize: 14 };

  it('keeps the design size until the width is known', () => {
    expect(fitLabelFontSize('Masculino', null, options)).toBe(24);
    expect(fitLabelFontSize('Masculino', 0, options)).toBe(24);
  });

  it('keeps the design size when the word already fits', () => {
    expect(fitLabelFontSize('36', 120, options)).toBe(24);
  });

  it('shrinks a long word to the width it was given', () => {
    // 9 glyphs at 0.62 of the size: 100px holds 17px of type, not 24.
    expect(fitLabelFontSize('Masculino', 100, options)).toBe(17);
  });

  it('stops at the minimum rather than drawing unreadable type', () => {
    expect(fitLabelFontSize('Masculino', 40, options)).toBe(14);
  });

  it('leaves room for the OS font scale, which enlarges native text', () => {
    const plain = fitLabelFontSize('Masculino', 100, options);
    const large = fitLabelFontSize('Masculino', 100, { ...options, fontScale: 1.3 });

    expect(large).toBeLessThan(plain);
  });
});

describe('layoutActionLabel', () => {
  const options = {
    iconWidth: 24,
    gap: 12,
    comfortableSize: 13,
    maxSize: 16,
    minSize: 10,
  };

  it('is the full design before the tile has been measured', () => {
    expect(layoutActionLabel('Entrenamiento', null, options)).toEqual({
      showIcon: true,
      fontSize: 16,
    });
  });

  it('keeps the icon and the full size on a roomy tile', () => {
    expect(layoutActionLabel('Comida', 200, options)).toEqual({ showIcon: true, fontSize: 16 });
  });

  it('shrinks the label beside the icon while it stays comfortable', () => {
    const layout = layoutActionLabel('Entrenamiento', 150, options);

    expect(layout.showIcon).toBe(true);
    expect(layout.fontSize).toBeGreaterThanOrEqual(13);
    expect(layout.fontSize).toBeLessThan(16);
  });

  it('drops the icon when keeping it would squeeze the label below comfortable', () => {
    const layout = layoutActionLabel('Entrenamiento', 100, options);

    expect(layout.showIcon).toBe(false);
    // The icon's room goes to the label: 100px holds 12px of this word, where beside the icon the
    // 64px left would have held 7.
    expect(layout.fontSize).toBe(12);
  });

  it('never goes below the minimum, however narrow the tile', () => {
    expect(layoutActionLabel('Entrenamiento', 30, options)).toEqual({
      showIcon: false,
      fontSize: 10,
    });
  });
});

describe('fitLineFontSize', () => {
  const options = { maxSize: 36, minSize: 18 };

  it('keeps the design size until the width is known', () => {
    expect(fitLineFontSize('35.3 oz', null, options)).toBe(36);
  });

  it('keeps the design size when the whole line already fits', () => {
    expect(fitLineFontSize('5 g', 200, options)).toBe(36);
  });

  it('holds the WHOLE line, number and unit, unlike the longest-word fit', () => {
    // "35.3 oz" is 7 glyphs, so 100px holds 16px of type; its longest word "35.3" would allow 40.
    expect(fitLineFontSize('35.3 oz', 100, { ...options, minSize: 12 })).toBe(23);
    expect(fitLabelFontSize('35.3 oz', 100, { ...options, minSize: 12 })).toBe(36);
  });

  it('divides the room by the OS text scale, since native text is drawn larger', () => {
    expect(fitLineFontSize('35.3 oz', 200, { ...options, fontScale: 1.3 })).toBeLessThan(
      fitLineFontSize('35.3 oz', 200, options)
    );
  });

  it('stops at the minimum rather than drawing unreadable type', () => {
    expect(fitLineFontSize('1000.5 oz', 40, options)).toBe(18);
  });
});

describe('labelsFitEvenly', () => {
  const options = { fontSize: 14, chrome: 24, gap: 4 };
  const labels = ['Off', 'Structured', 'Flexible'];

  it('says yes until the width is known', () => {
    expect(labelsFitEvenly(labels, null, options)).toBe(true);
    expect(labelsFitEvenly(labels, 0, options)).toBe(true);
  });

  it('says yes when each share holds the longest word at the design size', () => {
    // 3 options in 340px: 110px each, 86px after padding; "Structured" needs about 87px.
    expect(labelsFitEvenly(labels, 360, options)).toBe(true);
    expect(labelsFitEvenly(['Off', 'On'], 200, options)).toBe(true);
  });

  it('says no when one label cannot fit its share, so the options wrap instead of breaking it', () => {
    expect(labelsFitEvenly(labels, 232, options)).toBe(false);
  });

  it('counts the OS text scale and an icon beside each label', () => {
    expect(labelsFitEvenly(labels, 360, { ...options, fontScale: 1.3 })).toBe(false);
    expect(labelsFitEvenly(labels, 360, { ...options, chrome: 46 })).toBe(false);
  });

  it('judges the longest WORD, since a label wraps between words', () => {
    expect(labelsFitEvenly(['Add to the plan'], 120, options)).toBe(true);
  });

  it('asks about a grid of two columns whatever the option count', () => {
    // Five goal cards in two columns: each gets half the grid, not a fifth of it.
    const goals = ['Build muscle', 'Strength', 'Endurance', 'Weight loss', 'General'];
    const grid = { fontSize: 14, chrome: 81, gap: 16, glyphWidthRatio: 0.56 };
    expect(labelsFitEvenly(goals, 342, { ...grid, columns: 2 })).toBe(true);
    expect(labelsFitEvenly(goals, 342, grid)).toBe(false);
  });

  it('sends a long compound word or large text to one column', () => {
    const grid = { fontSize: 14, chrome: 81, gap: 16, glyphWidthRatio: 0.56, columns: 2 };
    expect(labelsFitEvenly(['Uithoudingsvermogen', 'Kracht'], 342, grid)).toBe(false);
    // At 1.3x the phone is 264pt wide, and half of it no longer holds "Strength" beside its icon.
    expect(labelsFitEvenly(['Strength'], 264, { ...grid, fontScale: 1.3 })).toBe(false);
  });
});
