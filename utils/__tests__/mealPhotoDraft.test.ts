import {
  EMPTY_MEAL_PHOTO_DRAFT as E,
  MAX_MEAL_PHOTOS,
  canAddMealPhoto,
  hasDraftInput,
  mealCameraControls,
  mealPhotoDraftReducer as r,
  photoLimit,
} from '../mealPhotoDraft';

describe('mealPhotoDraftReducer', () => {
  it('adds photos and refuses duplicates, empty uris and over-limit', () => {
    const a = r(E, { type: 'addPhoto', uri: 'a', limit: 2 });
    expect(a.photos).toEqual(['a']);
    expect(r(a, { type: 'addPhoto', uri: 'a', limit: 2 })).toBe(a);
    expect(r(a, { type: 'addPhoto', uri: '', limit: 2 })).toBe(a);
    const b = r(a, { type: 'addPhoto', uri: 'b', limit: 2 });
    expect(r(b, { type: 'addPhoto', uri: 'c', limit: 2 })).toBe(b);
  });

  it('caps at MAX_MEAL_PHOTOS regardless of limit', () => {
    let d = E;
    for (let i = 0; i < 8; i++) {
      d = r(d, { type: 'addPhoto', uri: `p${i}`, limit: 99 });
    }
    expect(d.photos).toHaveLength(MAX_MEAL_PHOTOS);
    expect(canAddMealPhoto(d, 99)).toBe(false);
    expect(canAddMealPhoto(E, 99)).toBe(true);
  });

  it('removes photos and ignores bad indexes', () => {
    const d = r(r(E, { type: 'addPhoto', uri: 'a', limit: 5 }), {
      type: 'addPhoto',
      uri: 'b',
      limit: 5,
    });
    expect(r(d, { type: 'removePhoto', index: 0 }).photos).toEqual(['b']);
    expect(r(d, { type: 'removePhoto', index: 2 })).toBe(d);
    expect(r(d, { type: 'removePhoto', index: -1 })).toBe(d);
  });

  it('sets text and keeps reference when unchanged', () => {
    const d = r(E, { type: 'setName', value: 'x' });
    expect(d.name).toBe('x');
    expect(r(d, { type: 'setName', value: 'x' })).toBe(d);
    const e = r(d, { type: 'setDescription', value: 'y' });
    expect(e.description).toBe('y');
    expect(r(e, { type: 'setDescription', value: 'y' })).toBe(e);
  });

  it('toggles origin, fat and tags', () => {
    const o = r(E, { type: 'toggleOrigin', value: 'home' });
    expect(o.origin).toBe('home');
    expect(r(o, { type: 'toggleOrigin', value: 'home' }).origin).toBeNull();
    expect(r(o, { type: 'toggleOrigin', value: 'packaged' }).origin).toBe('packaged');
    const f = r(E, { type: 'toggleAddedFat', value: 'lots' });
    expect(f.addedFat).toBe('lots');
    expect(r(f, { type: 'toggleAddedFat', value: 'lots' }).addedFat).toBeNull();
    const t = r(E, { type: 'toggleTag', value: 'vegan' });
    expect(t.tags).toEqual(['vegan']);
    expect(r(t, { type: 'toggleTag', value: 'vegan' }).tags).toEqual([]);
  });

  it('resets', () => {
    const d = r(E, { type: 'setName', value: 'x' });
    expect(r(d, { type: 'reset' })).toEqual(E);
  });
});

describe('hasDraftInput', () => {
  it('is false for empty and blank, true otherwise', () => {
    expect(hasDraftInput(E)).toBe(false);
    expect(hasDraftInput({ ...E, name: '  ', description: ' ' })).toBe(false);
    expect(hasDraftInput({ ...E, photos: ['a'] })).toBe(true);
    expect(hasDraftInput({ ...E, name: 'a' })).toBe(true);
    expect(hasDraftInput({ ...E, description: 'a' })).toBe(true);
    expect(hasDraftInput({ ...E, origin: 'home' })).toBe(true);
    expect(hasDraftInput({ ...E, addedFat: 'none' })).toBe(true);
    expect(hasDraftInput({ ...E, tags: ['t'] })).toBe(true);
  });
});

describe('photoLimit', () => {
  it('handles edge cases', () => {
    expect(photoLimit(undefined)).toBe(MAX_MEAL_PHOTOS);
    expect(photoLimit(null)).toBe(MAX_MEAL_PHOTOS);
    expect(photoLimit(3)).toBe(3);
    expect(photoLimit(3.9)).toBe(3);
    expect(photoLimit(100)).toBe(MAX_MEAL_PHOTOS);
    expect(photoLimit(0)).toBe(1);
    expect(photoLimit(-4)).toBe(1);
    expect(photoLimit(NaN)).toBe(1);
    expect(photoLimit(0.5)).toBe(1);
  });
});

describe('mealCameraControls', () => {
  const photos = (count: number) =>
    Array.from({ length: count }, (_, index) => `file:///photo-${index}.jpg`);

  it('quick flow is never adding to a draft and picks one image', () => {
    expect(
      mealCameraControls({
        detailedFlow: false,
        isMealPhotoMode: true,
        draft: { ...E, photos: photos(1) },
        limit: 5,
      })
    ).toEqual({ addingToDraft: false, gallerySelectionLimit: 1, canAddPhoto: true });
  });

  it('detailed flow in another mode is never adding to a draft and picks one image', () => {
    expect(
      mealCameraControls({
        detailedFlow: true,
        isMealPhotoMode: false,
        draft: { ...E, photos: photos(1) },
        limit: 5,
      })
    ).toEqual({ addingToDraft: false, gallerySelectionLimit: 1, canAddPhoto: true });
  });

  it('detailed meal mode with an empty draft offers the full limit but is not adding', () => {
    expect(
      mealCameraControls({ detailedFlow: true, isMealPhotoMode: true, draft: E, limit: 5 })
    ).toEqual({ addingToDraft: false, gallerySelectionLimit: 5, canAddPhoto: true });
  });

  it('one photo in the draft with limit 5 is adding and leaves 4 slots', () => {
    expect(
      mealCameraControls({
        detailedFlow: true,
        isMealPhotoMode: true,
        draft: { ...E, photos: photos(1) },
        limit: 5,
      })
    ).toEqual({ addingToDraft: true, gallerySelectionLimit: 4, canAddPhoto: true });
  });

  it('a name alone (no photos) is adding to the draft and leaves all 5 slots', () => {
    expect(
      mealCameraControls({
        detailedFlow: true,
        isMealPhotoMode: true,
        draft: { ...E, name: 'Oats' },
        limit: 5,
      })
    ).toEqual({ addingToDraft: true, gallerySelectionLimit: 5, canAddPhoto: true });
  });

  it('a full draft leaves no slots, so the pick is one image and nothing can be added', () => {
    expect(
      mealCameraControls({
        detailedFlow: true,
        isMealPhotoMode: true,
        draft: { ...E, photos: photos(5) },
        limit: 5,
      })
    ).toEqual({ addingToDraft: true, gallerySelectionLimit: 1, canAddPhoto: false });
  });

  it('a draft holding the provider limit cannot take another photo', () => {
    expect(
      mealCameraControls({
        detailedFlow: true,
        isMealPhotoMode: true,
        draft: { ...E, photos: photos(2) },
        limit: 2,
      }).canAddPhoto
    ).toBe(false);
  });

  it('a draft with room left can take a photo, and outside the detailed meal flow it always can', () => {
    expect(
      mealCameraControls({
        detailedFlow: true,
        isMealPhotoMode: true,
        draft: { ...E, photos: photos(1) },
        limit: 5,
      }).canAddPhoto
    ).toBe(true);
    expect(
      mealCameraControls({
        detailedFlow: false,
        isMealPhotoMode: true,
        draft: { ...E, photos: photos(5) },
        limit: 5,
      }).canAddPhoto
    ).toBe(true);
  });

  it('a provider limit of 2 with one photo leaves one slot', () => {
    expect(
      mealCameraControls({
        detailedFlow: true,
        isMealPhotoMode: true,
        draft: { ...E, photos: photos(1) },
        limit: 2,
      })
    ).toEqual({ addingToDraft: true, gallerySelectionLimit: 1, canAddPhoto: true });
  });
});
