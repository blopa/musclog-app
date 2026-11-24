import { MAX_MEAL_IMAGES } from './mealImages';

export const MAX_MEAL_PHOTOS = MAX_MEAL_IMAGES;

export type MealOrigin = 'home' | 'restaurant' | 'takeaway' | 'packaged';
export const MEAL_ORIGINS: readonly MealOrigin[] = ['home', 'restaurant', 'takeaway', 'packaged'];

export type AddedFat = 'none' | 'some' | 'lots';
export const ADDED_FAT_LEVELS: readonly AddedFat[] = ['none', 'some', 'lots'];

export type MealPhotoDraft = {
  photos: string[];
  name: string;
  description: string;
  origin: MealOrigin | null;
  addedFat: AddedFat | null;
  tags: string[];
};

export const EMPTY_MEAL_PHOTO_DRAFT: MealPhotoDraft = {
  photos: [],
  name: '',
  description: '',
  origin: null,
  addedFat: null,
  tags: [],
};

export type MealPhotoDraftAction =
  | { type: 'addPhoto'; uri: string; limit: number }
  | { type: 'removePhoto'; index: number }
  | { type: 'setName'; value: string }
  | { type: 'setDescription'; value: string }
  | { type: 'toggleOrigin'; value: MealOrigin }
  | { type: 'toggleAddedFat'; value: AddedFat }
  | { type: 'toggleTag'; value: string }
  | { type: 'reset' };

export function canAddMealPhoto(draft: MealPhotoDraft, limit: number): boolean {
  return draft.photos.length < Math.min(limit, MAX_MEAL_PHOTOS);
}

export function mealPhotoDraftReducer(
  draft: MealPhotoDraft,
  action: MealPhotoDraftAction
): MealPhotoDraft {
  switch (action.type) {
    case 'addPhoto':
      if (
        !action.uri ||
        draft.photos.includes(action.uri) ||
        !canAddMealPhoto(draft, action.limit)
      ) {
        return draft;
      }

      return { ...draft, photos: [...draft.photos, action.uri] };
    case 'removePhoto':
      if (
        !Number.isInteger(action.index) ||
        action.index < 0 ||
        action.index >= draft.photos.length
      ) {
        return draft;
      }

      return { ...draft, photos: draft.photos.filter((_, i) => i !== action.index) };
    case 'setName':
      return action.value === draft.name ? draft : { ...draft, name: action.value };
    case 'setDescription':
      return action.value === draft.description ? draft : { ...draft, description: action.value };
    case 'toggleOrigin':
      return { ...draft, origin: draft.origin === action.value ? null : action.value };
    case 'toggleAddedFat':
      return { ...draft, addedFat: draft.addedFat === action.value ? null : action.value };
    case 'toggleTag':
      return {
        ...draft,
        tags: draft.tags.includes(action.value)
          ? draft.tags.filter((tag) => tag !== action.value)
          : [...draft.tags, action.value],
      };
    case 'reset':
      return { ...EMPTY_MEAL_PHOTO_DRAFT, photos: [], tags: [] };
    default:
      return draft;
  }
}

export function hasDraftInput(draft: MealPhotoDraft): boolean {
  return (
    draft.photos.length > 0 ||
    draft.name.trim() !== '' ||
    draft.description.trim() !== '' ||
    draft.origin !== null ||
    draft.addedFat !== null ||
    draft.tags.length > 0
  );
}

export type MealCameraControls = {
  /**
   * The camera is open only to add to a draft started in the details sheet: the mode picker is
   * hidden (another mode would orphan the draft) and close/back returns to the sheet.
   */
  addingToDraft: boolean;
  /** How many images one gallery pick may return: the photo slots left in the draft, at least 1. */
  gallerySelectionLimit: number;
  /**
   * Whether the draft has a free photo slot. When false the shutter and gallery must not take a
   * photo (the reducer would drop it silently); the person goes back to the details sheet instead.
   */
  canAddPhoto: boolean;
};

/** What the smart camera offers while the detailed meal-photo flow is (or isn't) running. */
export function mealCameraControls({
  detailedFlow,
  isMealPhotoMode,
  draft,
  limit,
}: {
  detailedFlow: boolean;
  isMealPhotoMode: boolean;
  draft: MealPhotoDraft;
  /** Already `photoLimit(...)`. */
  limit: number;
}): MealCameraControls {
  if (!detailedFlow || !isMealPhotoMode) {
    return { addingToDraft: false, gallerySelectionLimit: 1, canAddPhoto: true };
  }

  const remaining = Math.min(limit, MAX_MEAL_PHOTOS) - draft.photos.length;

  return {
    addingToDraft: hasDraftInput(draft),
    gallerySelectionLimit: Math.max(1, remaining),
    canAddPhoto: remaining > 0,
  };
}

export function photoLimit(providerMax: number | null | undefined): number {
  if (providerMax === null || providerMax === undefined) {
    return MAX_MEAL_PHOTOS;
  }

  if (!Number.isFinite(providerMax)) {
    return providerMax === Infinity ? MAX_MEAL_PHOTOS : 1;
  }

  return Math.min(MAX_MEAL_PHOTOS, Math.max(1, Math.floor(providerMax)));
}
