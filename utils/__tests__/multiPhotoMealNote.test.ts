import { getMultiPhotoMealNote } from '../prompts';

describe('getMultiPhotoMealNote', () => {
  it('is empty for no photo or one photo', () => {
    expect(getMultiPhotoMealNote(0)).toBe('');
    expect(getMultiPhotoMealNote(1)).toBe('');
  });

  it('names the count and says the photos show one meal', () => {
    const note = getMultiPhotoMealNote(3);

    expect(note).toContain('3 photos');
    expect(note).toMatch(/ONE meal/);
    expect(note).toMatch(/once/);
  });
});
