import {
  fitFontSize,
  fitLabelFontSize,
  fitLineFontSize,
  insetWidth,
  labelsFitEvenly,
  layoutActionLabel,
  layoutIconRow,
  layoutTableColumns,
  layoutToggleRow,
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

describe('layoutToggleRow', () => {
  // A 40pt icon tile and its gap, a 52pt switch and its gap, as ToggleInput passes them.
  const options = { fontSize: 14, minSize: 12, iconRoom: 48, switchRoom: 60, dropIcon: false };
  const texts = ['Daily supplement reminder', 'Show a reminder on the home screen'];

  it('is the designed row until the width is known', () => {
    expect(layoutToggleRow(texts, null, options)).toEqual({
      showIcon: true,
      stackSwitch: false,
      fontSize: 14,
    });
    expect(layoutToggleRow(texts, 0, { ...options, dropIcon: true })).toEqual({
      showIcon: false,
      stackSwitch: false,
      fontSize: 14,
    });
  });

  it('keeps the icon and the switch beside the text while the longest word fits', () => {
    // "supplement" (10 glyphs, about 79px) in 300 - 48 - 60.
    expect(layoutToggleRow(texts, 300, options)).toEqual({
      showIcon: true,
      stackSwitch: false,
      fontSize: 14,
    });
  });

  it('moves the switch under the text before it touches the icon or the type', () => {
    // "supplementherinneringen" (23 glyphs, about 180px) cannot sit beside a switch in 250px but
    // fits the 202px left once only the icon is taken off.
    const dutch = ['Dagelijkse Supplementherinnering', 'Toon dagelijkse supplementherinneringen'];
    expect(layoutToggleRow(dutch, 250, options)).toEqual({
      showIcon: true,
      stackSwitch: true,
      fontSize: 14,
    });
  });

  it('gives the icon its room away when stacking alone is not enough', () => {
    const dutch = ['Dagelijkse Supplementherinnering'];
    expect(layoutToggleRow(dutch, 200, options)).toEqual({
      showIcon: false,
      stackSwitch: true,
      fontSize: 14,
    });
  });

  it('drops the icon from the start when the layout is cramped, and still moves the switch', () => {
    // Without the icon: 190 - 60 = 130px beside the switch, too little for 180px of word.
    const dutch = ['Dagelijkse Supplementherinnering', 'Toon dagelijkse supplementherinneringen'];
    expect(layoutToggleRow(dutch, 190, { ...options, dropIcon: true })).toEqual({
      showIcon: false,
      stackSwitch: true,
      fontSize: 14,
    });
    expect(layoutToggleRow(['Reminders'], 190, { ...options, dropIcon: true })).toEqual({
      showIcon: false,
      stackSwitch: false,
      fontSize: 14,
    });
  });

  it('shrinks the type a little, never below the minimum, once the whole row cannot hold the word', () => {
    // 26 glyphs of "Vruchtbaarheidsschattingen" need about 204px at 14; 190px holds 13.
    const long = ['Vruchtbaarheidsschattingen tonen'];
    expect(layoutToggleRow(long, 190, { ...options, dropIcon: true })).toEqual({
      showIcon: false,
      stackSwitch: true,
      fontSize: 13,
    });
    expect(layoutToggleRow(long, 100, { ...options, dropIcon: true }).fontSize).toBe(12);
  });

  it('judges a toggle without an icon the same way', () => {
    const noIcon = { ...options, iconRoom: 0 };
    expect(layoutToggleRow(['Reminders'], 150, noIcon).showIcon).toBe(false);
    expect(layoutToggleRow(['Reminders'], 150, noIcon).stackSwitch).toBe(false);
  });

  it('divides the room by the OS text scale, since native text is drawn larger', () => {
    const plain = layoutToggleRow(['Supplementherinneringen'], 230, { ...options, iconRoom: 0 });
    const large = layoutToggleRow(['Supplementherinneringen'], 230, {
      ...options,
      iconRoom: 0,
      fontScale: 1.3,
    });
    expect(plain.stackSwitch).toBe(true);
    expect(large.fontSize).toBeLessThan(plain.fontSize);
  });
});

describe('layoutIconRow', () => {
  // A 24pt icon and its 12pt gap, a 16pt chevron and its 12pt gap, 16pt type.
  const options = { fontSize: 16, minSize: 14, iconRoom: 36, trailingRoom: 28, dropIcon: false };

  it('is the designed row until the width is known', () => {
    expect(layoutIconRow(['Workouts'], null, options)).toEqual({ showIcon: true, fontSize: 16 });
    expect(layoutIconRow(['Workouts'], 0, { ...options, dropIcon: true })).toEqual({
      showIcon: false,
      fontSize: 16,
    });
  });

  it('keeps the icon while the longest word fits beside it', () => {
    // "Workouts" is 8 glyphs, about 72px, in 230 - 36 - 28.
    expect(layoutIconRow(['Workouts', 'Past sessions'], 230, options)).toEqual({
      showIcon: true,
      fontSize: 16,
    });
  });

  it('gives the icon its room before the type shrinks', () => {
    // "Trainingsbestanden" (18 glyphs, about 161px) fits 198 - 28 = 170 once the icon is gone.
    expect(layoutIconRow(['BLE Trainingsbestanden'], 198, options)).toEqual({
      showIcon: false,
      fontSize: 16,
    });
  });

  it('drops the icon from the start when the layout is cramped', () => {
    expect(layoutIconRow(['Workouts'], 230, { ...options, dropIcon: true })).toEqual({
      showIcon: false,
      fontSize: 16,
    });
  });

  it('draws the type a little smaller, never below the minimum, when the word still does not fit', () => {
    // 18 glyphs in 150 - 28 = 122px hold 12px of type; the minimum is 14.
    expect(layoutIconRow(['Trainingsbestanden'], 150, options)).toEqual({
      showIcon: false,
      fontSize: 14,
    });
    // 18 glyphs in 170 - 28 = 142px hold 14px of type, and with a lower minimum it is not clamped.
    expect(layoutIconRow(['Trainingsbestanden'], 170, { ...options, minSize: 10 })).toEqual({
      showIcon: false,
      fontSize: 14,
    });
  });
});

describe('layoutTableColumns', () => {
  const options = { maxSize: 12, minSize: 10, padding: 4, minBasis: 28 };
  const russian = ['Подход', 'ВЕС', 'Повторы', 'Частичные', 'RIR'];

  it('sizes the columns for the design size until the width is known', () => {
    const { fontSize } = layoutTableColumns(russian, null, options);
    expect(fontSize).toBe(12);
  });

  it('gives each column the width of its own longest word, not the longest of all', () => {
    const { fontSize, bases } = layoutTableColumns(russian, 400, options);
    expect(fontSize).toBe(12);
    // 9 glyphs of "Частичные" at 12px (0.56 of the size): 61px plus 4px of padding.
    expect(bases[3]).toBe(65);
    // "ВЕС" is 3 glyphs, so it takes the minimum, not a ninth of the table.
    expect(bases[1]).toBe(28);
    expect(bases[3]).toBeGreaterThan(bases[0]);
  });

  it('keeps the design size while every column fits the table', () => {
    const { fontSize, bases } = layoutTableColumns(russian, 250, options);
    expect(fontSize).toBe(12);
    expect(bases.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(250);
  });

  it('shrinks the header a little when the table is narrower than the words need', () => {
    const { fontSize, bases } = layoutTableColumns(russian, 213, options);
    expect(fontSize).toBeLessThan(12);
    expect(fontSize).toBeGreaterThanOrEqual(10);
    expect(bases.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(213);
  });

  it('stops at the minimum size rather than drawing unreadable headers', () => {
    expect(layoutTableColumns(russian, 100, options).fontSize).toBe(10);
  });

  it('divides the room by the OS text scale, since native text is drawn larger', () => {
    const plain = layoutTableColumns(russian, 250, options);
    const large = layoutTableColumns(russian, 250, { ...options, fontScale: 1.3 });
    expect(large.fontSize).toBeLessThan(plain.fontSize);
  });
});

describe('fitFontSize', () => {
  it('keeps a short figure at the full size', () => {
    expect(fitFontSize('7', 310, 132)).toBe(132);
  });

  it('shrinks a long figure so it stays on one line', () => {
    const size = fitFontSize('1,204,332', 310, 132);

    expect(size).toBeLessThan(132);
    expect(size * 9 * 0.62).toBeLessThanOrEqual(310);
  });

  it('does not divide by nothing', () => {
    expect(fitFontSize('', 310, 132)).toBe(132);
  });
});

describe('insetWidth', () => {
  it('keeps a missing width missing', () => {
    expect(insetWidth(null, 16)).toBeNull();
  });

  it('takes the inset off both sides', () => {
    expect(insetWidth(300, 16)).toBe(268);
  });

  it('goes negative rather than clamping when the box is narrower than twice the inset', () => {
    expect(insetWidth(20, 16)).toBe(-12);
  });
});
