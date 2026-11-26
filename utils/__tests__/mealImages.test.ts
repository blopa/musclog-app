import { MAX_MEAL_IMAGES, toMealImage, toMealImages } from '../mealImages';

describe('toMealImage', () => {
  it('strips a jpeg data URL prefix', () => {
    expect(toMealImage('data:image/jpeg;base64,AAAA')).toEqual({
      base64: 'AAAA',
      mimeType: 'image/jpeg',
    });
  });

  it('detects a png data URL', () => {
    expect(toMealImage('data:image/png;base64,BBBB')).toEqual({
      base64: 'BBBB',
      mimeType: 'image/png',
    });
  });

  it('takes bare base64 as jpeg', () => {
    expect(toMealImage('CCCC')).toEqual({ base64: 'CCCC', mimeType: 'image/jpeg' });
  });
});

describe('toMealImages', () => {
  it('wraps one string in a list', () => {
    expect(toMealImages('AAAA')).toEqual([{ base64: 'AAAA', mimeType: 'image/jpeg' }]);
  });

  it('drops blank entries and keeps order', () => {
    expect(toMealImages(['AAAA', '', '   ', 'data:image/png;base64,BBBB'])).toEqual([
      { base64: 'AAAA', mimeType: 'image/jpeg' },
      { base64: 'BBBB', mimeType: 'image/png' },
    ]);
  });

  it('returns an empty list for a blank string', () => {
    expect(toMealImages('')).toEqual([]);
  });

  it('exposes a cap of five photos', () => {
    expect(MAX_MEAL_IMAGES).toBe(5);
  });
});
