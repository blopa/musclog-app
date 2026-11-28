import { useCallback, useEffect, useReducer, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useCameraAiProcessing } from '@/components/camera/useCameraAiProcessing';
import { type MealReview, useMealPhotoEstimate } from '@/components/camera/useMealPhotoEstimate';
import type { LogMealData } from '@/components/modals/LogMealModal';
import type { CameraMode } from '@/constants/camera';
import { useMealPhotoLimit } from '@/hooks/useMealPhotoLimit';
import { useSettings } from '@/hooks/useSettings';
import { logTrackedMeal } from '@/services/trackedMealLogging';
import { copyImageToDocumentDirectory, deleteFoodImage } from '@/utils/file';
import { mealPhotoContextFromDraft } from '@/utils/mealPhotoContext';
import {
  EMPTY_MEAL_PHOTO_DRAFT,
  mealCameraControls,
  mealPhotoDraftReducer,
} from '@/utils/mealPhotoDraft';

/** What the person said about the next photo before taking it (the quick flow and label scans). */
export type PhotoNote = { description: string; tags: string[] };

const EMPTY_NOTE: PhotoNote = { description: '', tags: [] };

/**
 * One meal from camera to diary: the photos collected, the estimate in flight, the review waiting to
 * be confirmed, and the one decision between the two flows (`ai_meal_camera_flow`). `detailed`
 * collects photos into a draft and estimates from its sheet; `quick` estimates each shutter press.
 * Closing the camera forgets all of it.
 */
export function useMealCameraSession({
  visible,
  cameraMode,
}: {
  visible: boolean;
  cameraMode: CameraMode;
}) {
  const { t } = useTranslation();
  const { aiMealCameraFlow, aiProvider } = useSettings();
  const detailed = aiMealCameraFlow === 'detailed';
  const isMealPhotoMode = cameraMode === 'ai-meal-photo';

  const ai = useCameraAiProcessing();
  const estimate = useMealPhotoEstimate(ai);
  const photoLimit = useMealPhotoLimit(visible && detailed, aiProvider);

  const [draft, dispatch] = useReducer(mealPhotoDraftReducer, EMPTY_MEAL_PHOTO_DRAFT);
  const [isSheetVisible, setIsSheetVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [review, setReview] = useState<MealReview | null>(null);
  const [note, setNote] = useState<PhotoNote | null>(null);
  const [typedNote, setTypedNote] = useState<PhotoNote>(EMPTY_NOTE);

  const { abandon } = ai;
  useEffect(() => {
    if (visible) {
      return;
    }

    abandon();
    const reset = () => {
      setIsSheetVisible(false);
      dispatch({ type: 'reset' });
      setError(null);
      setReview(null);
    };

    reset();
  }, [visible, abandon]);

  const controls = mealCameraControls({
    detailedFlow: detailed,
    isMealPhotoMode,
    draft,
    limit: photoLimit,
  });

  const openSheet = useCallback(() => setIsSheetVisible(true), []);
  const hideSheet = useCallback(() => setIsSheetVisible(false), []);
  const clearError = useCallback(() => setError(null), []);

  const showReview = useCallback((next: MealReview) => {
    setReview(next);
    dispatch({ type: 'reset' });
  }, []);

  /** A photo taken or picked in meal-photo mode. */
  const takePhoto = useCallback(
    async (uri: string) => {
      setError(null);
      if (detailed) {
        // The detailed flow collects photos first; the estimate runs from the sheet.
        dispatch({ type: 'addPhoto', uri, limit: photoLimit });
        setIsSheetVisible(true);

        return;
      }

      await estimate({
        photos: [uri],
        context: note ?? undefined,
        onEstimate: showReview,
        onError: setError,
      });
    },
    [detailed, photoLimit, note, estimate, showReview]
  );

  const estimateDraft = () => {
    if (ai.isBusy() || draft.photos.length === 0) {
      return;
    }

    setError(null);
    setIsSheetVisible(false);
    void estimate({
      photos: draft.photos,
      context: mealPhotoContextFromDraft(draft),
      name: draft.name,
      onEstimate: showReview,
      onError: setError,
      onFailure: openSheet,
    });
  };

  const discardDraft = () => {
    setIsSheetVisible(false);
    dispatch({ type: 'reset' });
    setError(null);
  };

  const applyNote = useCallback((next: PhotoNote) => {
    setNote(next);
    setTypedNote(next);
  }, []);

  const dismissReview = useCallback(() => setReview(null), []);

  /** Writes the reviewed meal to the diary. Throws when it cannot, leaving no photo behind. */
  const logReview = useCallback(
    async ({ date, time, mealType, portionGrams }: LogMealData) => {
      if (!review) {
        throw new Error(t('food.aiCamera.mealLoggingFailed'));
      }

      const imageUrl = await copyImageToDocumentDirectory(review.photoUri).catch(() => undefined);
      try {
        // An estimate is logged food by food, through the same logger the coach chat uses.
        await logTrackedMeal({
          ingredients: review.ingredients,
          date,
          mealType,
          portionGrams,
          mealName: review.meal.name,
          imageUrl,
          consumedTime: time,
        });
      } catch (error) {
        if (imageUrl) {
          await deleteFoodImage(imageUrl);
        }

        throw error;
      }

      setReview(null);
      dispatch({ type: 'reset' });
    },
    [review, t]
  );

  return {
    ai,
    /** Meal photos are collected into a draft (the slot beside the shutter shows it). */
    collectsPhotos: detailed && isMealPhotoMode,
    draft,
    dispatch,
    photoLimit,
    controls,
    /** A draft being added to has no slot left: a photo taken now would be dropped. */
    isDraftFull: controls.addingToDraft && !controls.canAddPhoto,
    isSheetVisible,
    openSheet,
    hideSheet,
    error,
    clearError,
    takePhoto,
    estimateDraft,
    discardDraft,
    note,
    typedNote,
    setTypedNote,
    applyNote,
    review,
    dismissReview,
    logReview,
  };
}
