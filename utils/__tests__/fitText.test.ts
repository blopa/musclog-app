import { fitLabelFontSize, layoutActionLabel, longestWord } from '@/utils/fitText';

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
