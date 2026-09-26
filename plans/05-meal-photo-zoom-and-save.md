# Pinch-zoom meal photos and optionally save them to the gallery

## Goal

1. Tap any meal/food photo to open it full screen, with pinch-zoom, pan and double-tap-to-zoom.
2. An opt-in setting to save the photo of an AI-scanned meal to the device gallery after it's
   logged, plus a "Save" action in the viewer.

## What already exists

- Photos are only shown as small thumbnails:
  [components/cards/MealGroupCard.tsx](../components/cards/MealGroupCard.tsx) (64×64),
  [components/nutrition/MealSectionsList.tsx](../components/nutrition/MealSectionsList.tsx),
  [components/cards/FoodSearchItemCard.tsx](../components/cards/FoodSearchItemCard.tsx),
  [components/modals/FoodSearchModal.tsx](../components/modals/FoodSearchModal.tsx) (meal image),
  chat bubbles in [components/modals/CoachModal.tsx](../components/modals/CoachModal.tsx) (150×100)
  and the attachment preview, and `MealEstimationScreen`.
- There is no full-screen image viewer anywhere.
- `react-native-gesture-handler` 2.32 and `react-native-reanimated` 4.5 are installed. There are no
  zoom libraries.
- AI photo logs persist the cropped image with `copyImageToDocumentDirectory(aiPhotoUri)` in
  `SmartCameraModal.handleLogMeal`.
- `expo-media-library` is **not** installed. `app.json` sets `NSPhotoLibraryUsageDescription`
  (read), but there's no "add only" string.
- `AGENTS.md` requires gallery **picking** to go through the permissionless system Photo Picker.
  Saving is a separate, write-only concern, and nothing here should add read access.

## Design

### Viewer

1. New `components/ZoomableImageModal.tsx`:
   - A full-screen modal with a black background, a close button, and an optional "Save to gallery"
     button.
   - Gestures: `Gesture.Simultaneous(pinch, pan)` + `Gesture.Exclusive(doubleTap, singleTap)` using
     reanimated shared values. Limit scale to 1–5×, and limit panning to the scaled image bounds
     so the image can't be dragged off screen. Double-tap toggles 1× ↔ 2.5× centered on the tap
     point. Swipe down at 1× closes the viewer.
   - Put the math (clamping, focal-point zoom) in pure functions
     (`components/zoomableImageMath.ts`) so it can be tested in the Jest `node` project.
   - Web: gesture-handler supports web, but also add wheel zoom (Ctrl+wheel) to make trackpads
     usable. If it's too fiddly, a simple 1×/2× toggle on web is acceptable.
2. Add a small wrapper, `ZoomableThumbnail`, that renders the existing `Image` inside a `Pressable`
   and owns the viewer's `visible` state. Call sites then change by one line.
3. **Modal hierarchy** (`FIXES.md`): the viewer opens while its host stays visible, so it must be
   rendered **inside** the host's children, never as a sibling. Having each thumbnail own its viewer
   gives that automatically. Make sure `local/no-sibling-modals` passes.
4. Wire it into: MealGroupCard, MealSectionsList, FoodSearchModal meal image, CoachModal chat image
   and attachment preview, and MealEstimationScreen. Leave FoodSearchItemCard thumbnails alone for
   now; tapping the row already opens the food.

### Save to gallery

5. `npx expo install expo-media-library`. Configure its plugin in `app.json` with
   `savePhotosPermission` (iOS `NSPhotoLibraryAddUsageDescription`) and **no** read permission,
   and disable any media-location permission. Run prebuild. `android/` and `ios/` are committed, so
   check the manifest diff and make sure no `READ_MEDIA_IMAGES` / `READ_EXTERNAL_STORAGE` got added.
   If the plugin adds them, strip them with `tools:node="remove"` in a small config plugin.
6. `utils/saveImageToGallery.ts`: `requestPermissionsAsync(true /* writeOnly */)` →
   `saveToLibraryAsync(uri)`. Return `'saved' | 'denied' | 'failed'`; never throw into the logging
   flow. Web: trigger a download (`<a download>`) instead.
7. Setting `SAVE_MEAL_PHOTOS_TO_GALLERY_SETTING_TYPE` (default **off**) under Advanced settings →
   Nutrition.
8. In `SmartCameraModal.handleLogMeal`, **after** `logCustomMeal` succeeds and only when the setting
   is on, call `saveImageToGallery(persistedImageUri ?? aiPhotoUri)` without awaiting the snackbar
   flow. If saving fails, show a secondary info snackbar; the meal log still counts as a success.
9. The viewer's Save button uses the same helper regardless of the setting.

## Tests

- `components/__tests__/zoomableImageMath.test.ts`: scale clamping, pan bounds at different scales,
  focal-point zoom keeps the tapped point fixed.
- `utils/__tests__/saveImageToGallery.test.ts`: denied → `'denied'` with no save call; write-only
  flag passed; web path.
- `SmartCameraModal` log test: the setting off → never called; on → called after, not before, a
  successful log; a save failure doesn't turn the log into an error.
- Keep `utils/__tests__/galleryImagePickerArchitecture.test.ts` passing (no read-permission calls
  added).

## Docs and translations

- Strings: viewer close/save, save success/denied/failure, the setting label + subtitle, in all
  locales.
- `AGENTS.md` gallery section: add one line saying saving uses `expo-media-library` write-only
  through `utils/saveImageToGallery.ts`, and that this doesn't change the "no read permission"
  rule for picking.
- `CURRENT_FEATURES.md` → Nutrition.
