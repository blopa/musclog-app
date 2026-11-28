import { mentionsBodyWeight, readSpokenWeight } from '@/utils/voiceCommand/spokenWeight';

describe('readSpokenWeight', () => {
  it('reads a decimal comma with a kilo word after it', () => {
    expect(readSpokenWeight('I weigh 82,4 kilos')).toEqual({ value: 82.4, unit: 'kg' });
  });

  it('reads a decimal point with lbs', () => {
    expect(readSpokenWeight('My weight is 180.5 lbs')).toEqual({ value: 180.5, unit: 'lb' });
  });

  it('reads a unit glued to the number', () => {
    expect(readSpokenWeight('82kg')).toEqual({ value: 82, unit: 'kg' });
  });

  it('reads a unit written before the number', () => {
    expect(readSpokenWeight('weight in kg: 82')).toEqual({ value: 82, unit: 'kg' });
  });

  it('reads Russian kilograms', () => {
    expect(readSpokenWeight('я вешу 82,4 килограмма')).toEqual({ value: 82.4, unit: 'kg' });
  });

  it('reads Spanish pounds', () => {
    expect(readSpokenWeight('peso 180 libras')).toEqual({ value: 180, unit: 'lb' });
  });

  it('reads Arabic-Indic digits with the Arabic decimal separator', () => {
    expect(readSpokenWeight('وزني ٨٢٫٤')).toEqual({ value: 82.4, unit: null });
  });

  it('reads full-width digits', () => {
    expect(readSpokenWeight('I weigh ８２ kilos')).toEqual({ value: 82, unit: 'kg' });
  });

  it('returns no unit when none is said', () => {
    expect(readSpokenWeight('I weigh 82')).toEqual({ value: 82, unit: null });
  });

  it('does not treat German Pfund as a unit', () => {
    expect(readSpokenWeight('82 pfund')).toEqual({ value: 82, unit: null });
  });

  it('does not treat kilometres as a unit', () => {
    expect(readSpokenWeight('I ran 5 kilometers')).toEqual({ value: 5, unit: null });
  });

  it('does not treat Turkish kilom as a unit', () => {
    expect(readSpokenWeight('kilom 80')).toEqual({ value: 80, unit: null });
  });

  it('returns null for two different numbers', () => {
    expect(readSpokenWeight('82 kilos 400 grams')).toBeNull();
  });

  it('accepts the same number said twice', () => {
    expect(readSpokenWeight('82 kilos, that is 82')).toEqual({ value: 82, unit: 'kg' });
  });

  it('returns null when there is no number', () => {
    expect(readSpokenWeight('eighty two kilos')).toBeNull();
  });

  it('ignores a clock time', () => {
    expect(readSpokenWeight('at 8:30 I was 82')).toEqual({ value: 82, unit: null });
  });
});

describe('mentionsBodyWeight', () => {
  it.each([
    'I weigh 82.4',
    'Peso 75',
    'Ik weeg 90',
    'Ich wiege 84',
    'Я вешу 82',
    'Ważę 80',
    'My weight is 79.9',
    '82 kilos',
  ])('reads %s as about weight', (sentence) => {
    expect(mentionsBodyWeight(sentence)).toBe(true);
  });

  it.each(["I'm Maria and I'm 30", 'Set an alarm for 7', 'I ate 2 eggs'])(
    'does not read %s as about weight',
    (sentence) => {
      expect(mentionsBodyWeight(sentence)).toBe(false);
    }
  );
});
