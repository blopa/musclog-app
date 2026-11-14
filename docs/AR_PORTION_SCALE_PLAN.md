# Measured portion scale (ARKit, iOS)

Active plan. Work the phases in order, tick the status table as each ships, fold the lasting rules
into `AGENTS.md`, `docs/CURRENT_FEATURES.md` and `docs/RESEARCH.md`, then delete this file and its
line in `AGENTS.md`.

## Goal

When someone photographs a meal for an AI estimate on an iPhone, the food camera quietly measures
the table the food sits on. If the phone is held roughly over the plate and ARKit has found the
table, the photo carries a real-world scale: how high the camera was, how tilted, and how many
centimetres of table the (cropped) photo covers. That scale goes into the AI prompt as a measured
fact, so the model can size plates, bowls and portions from real dimensions instead of assuming a
"typical" plate.

Decisions already made:

- **iOS only.** Android (ARCore) is a `docs/FUTURE_FEATURES.md` entry, not part of this plan.
- **Silent.** The camera looks and behaves exactly as today. No mode, no badge, no "table found"
  chip, no new copy in the camera. A photo is measured when it can be and is an ordinary photo
  otherwise.
- **One setting** to opt out: Advanced → Nutrition, "Measure portions with AR", default on, shown
  only on devices that support it.
- **Only the meal photo mode** (`ai-meal-photo`). Label scan and barcode keep vision-camera: the
  label states its own grams, and barcode needs vision-camera's code scanner.
- **Gallery picks and coach chat photos are never measured** (no AR session behind them).

Non-goals: LiDAR depth for food height, a visible measuring UI, storing the measurement with the
nutrition log, Android.

## Status

| Phase | What                                                            | Status  |
| ----- | --------------------------------------------------------------- | ------- |
| 1     | Pure geometry + prompt section in TypeScript (no device)        | pending |
| 2     | Prompt wiring through `estimateNutritionFromPhoto`              | pending |
| 3     | Native `modules/portion-ar` (ARKit view, capture, raw geometry) | pending |
| 4     | Crop region from the cropper patch                              | pending |
| 5     | Camera integration in `SmartCameraModal` + capture flow         | pending |
| 6     | Setting, docs, tests, on-device QA                              | pending |
| 7     | (Optional) Close-up focus hand-off and tap to focus             | pending |

Phases 1 and 2 need no Mac and no device; they can land first and do nothing until phase 5 feeds
them a measurement.

## How the measurement works

ARKit tracks the camera's pose in world space and detects horizontal planes. With the camera pose,
the camera intrinsics and a point plus normal on the table plane, every pixel of the photo maps to a
point on the table by intersecting the pixel's viewing ray with the plane. That is ordinary pinhole
geometry; nothing here needs a model.

Notation (all in metres, ARKit world space):

- `C`: camera position (translation column of `ARCamera.transform`).
- `R`, `U`, `B`: the camera's right, up and back axes (columns 0, 1, 2 of the same transform).
  ARKit's camera looks along `-B`; image `y` grows downward, so image-down is `-U`.
- `fx`, `fy`, `cx`, `cy`: `ARCamera.intrinsics`, in pixels of `ARCamera.imageResolution` (the
  landscape sensor image).
- `P0`, `N`: a point on the table plane and its unit up normal.

For a sensor pixel `(u, v)`:

1. Ray direction `d = R·(u − cx)/fx − U·(v − cy)/fy − B`.
2. Camera height above the table `h = (C − P0)·N`. No measurement when `h ≤ 0`.
3. The ray must head down to the table: `k = d·N < 0`, otherwise no hit.
4. Hit point `X = C + d·(−h / k)`.

**Footprint of a region.** For any axis-aligned rectangle of the photo (the whole frame, or the
crop), intersect the rays through the midpoints of its four edges. Width = distance between the
left and right midpoint hits, height = distance between the top and bottom ones. Using the edge
midpoints instead of "frame size × metres per pixel" is what makes a tilted shot honest: a tilted
camera sees more table on its far side, and the midpoint distances measure the table actually in
the frame through its centre lines.

**Tilt** is the angle between the viewing direction `−B` and straight down `−N`.

**Usable** (product choices; write the reasons into `docs/RESEARCH.md` → a new "Measured portion
scale" section):

- `10 cm ≤ h ≤ 100 cm`. Closer, the wide lens cannot focus; farther, the plate is a few hundred
  pixels and the scale stops helping.
- Tilt `≤ 30°`. Beyond that the scale changes a lot across the frame, so a single "the photo covers
  W × L cm" sentence would mislead the model.
- All four edge rays hit the plane.
- Anything else: no measurement, and the photo is sent exactly as today.

### Why the crop matters (Musclog-specific)

Every capture goes through the cropper (`useCameraCaptureFlow.cropAndProcess`), so the image the
AI sees is usually a smaller part of the frame ARKit measured. A footprint computed for the full
frame would overstate the scene, sometimes by 2×. So the native side does **not** compute a
footprint. It returns the **raw geometry** of the shot, and TypeScript computes the footprint for
the region that survived the crop. This keeps the Swift small, puts all the arithmetic in Jest, and
handles crops correctly.

The cropper today returns only the output `width`/`height` (`OpenCropperResult`), not where the
crop was taken from. Phase 4 extends the existing patch so iOS also returns the crop region.

## Data shapes (TypeScript)

New file `utils/portionScale.ts`, pure (no React Native imports, Jest `node` project):

```ts
/** What the native AR camera reports about one shot. Raw ARKit values, nothing derived. */
export type PortionGeometry = {
  /** ARCamera.transform, column-major, 16 numbers. */
  cameraTransform: number[];
  /** fx, fy, cx, cy in pixels of `sensorWidth` × `sensorHeight`. */
  intrinsics: { fx: number; fy: number; cx: number; cy: number };
  sensorWidth: number;
  sensorHeight: number;
  /** A point on the table plane and its up normal, world space. */
  planePoint: [number, number, number];
  planeNormal: [number, number, number];
  /** Clockwise quarter turns applied to the landscape sensor image to make the saved JPEG upright. */
  uprightRotation: 0 | 1 | 2 | 3;
};

/** A rectangle of the upright photo in normalized coordinates (0–1, origin top-left). */
export type PhotoRegion = { x: number; y: number; width: number; height: number };

export type PortionScale = {
  cameraHeightCm: number;
  tiltDegrees: number;
  /** Table the region spans through its centre lines, across and top to bottom of the upright photo. */
  widthCm: number;
  heightCm: number;
};

export function measurePortionScale(
  geometry: PortionGeometry,
  region?: PhotoRegion
): PortionScale | null;

/** English, AI-facing, like every prompt in utils/prompts.ts. Null when there is nothing usable. */
export function portionScalePromptSection(scale: PortionScale | null): string | null;
```

`measurePortionScale` maps the region's edge midpoints from upright-normalized coordinates back to
sensor pixels through `uprightRotation` (the four cases are where bugs hide; test each), applies the
math above and the usable rules, and returns `null` for anything unusable. `region` defaults to the
whole frame.

Prompt section wording (write it in this spirit; whole centimetres; always metric, since the prompt
is AI-facing and never shown, so the display-unit rules don't apply):

> MEASURED SCALE (from the phone's AR camera): the photo was taken from about 34 cm above the
> table, looking nearly straight down. Through its centre the photo covers about 28 cm of table
> across and 37 cm from top to bottom. Use this to judge the real size of plates, bowls, cutlery
> and food instead of assuming typical sizes: estimate each food's footprint and visible height,
> then its weight from typical density. A readable kitchen scale or nutrition label in the photo
> still takes priority.

Say "straight down" under 10° and "nearly straight down" up to 30°.

## Phase 1: pure geometry and prompt section

Files: `utils/portionScale.ts`, `utils/__tests__/portionScale.test.ts`.

Tests (build camera poses in the test with a small helper: position plus tilt about the camera's
right axis, a table at `y = 0` with normal `(0, 1, 0)`, intrinsics for a known field of view):

- Overhead shot at 40 cm with a 60° × 45° field of view: footprint matches `2·h·tan(fov/2)` on both
  axes, tilt 0, height 40.
- Portrait vs landscape (`uprightRotation` 1 vs 0) swap width and height; rotations 2 and 3 give the
  same footprint as 0 and 1 (180° turns don't change spans).
- Tilted 20°: width through the centre is larger than overhead at the same height, tilt reads 20,
  still usable.
- Tilted 35°: `null` (or a scale your caller rejects; pick one and test it).
- Height 5 cm and 150 cm: `null`.
- Camera below the plane, a ray parallel to the plane, a ray pointing up, a zero-length axis: `null`
  without throwing.
- Region: a centred half-width, half-height region of an overhead shot gives half the footprint; an
  off-centre region of a tilted shot gives a different answer than naive scaling (proves the edge
  midpoints are used).
- Region outside 0–1, zero-sized, or `NaN` values in the geometry: `null`.
- `portionScalePromptSection(null)` is `null`; a usable scale rounds to whole cm and switches between
  "straight down" and "nearly straight down" at 10°.

Check: `npx jest --selectProjects node --runTestsByPath utils/__tests__/portionScale.test.ts`.

## Phase 2: prompt wiring

The measurement is an app-measured fact, not user text, so it must not go through
`wrapUserContent`/the user description suffix. Today:

- `estimateNutritionFromPhoto(config, base64Image, context)` (`utils/coachAI.ts`) has two branches:
  thinking mode (`trackMealWithThinking` → `extractRecipe` → `generateWithImageStructured` with the
  user message as the suffix) and normal mode (`getMealAnalysisPrompt` +
  `generateWithImageStructured` with description/tags as the suffix).
- `generateWithImageStructured` builds the user text as
  `'Analyze this image and return the structured data.'` + the sanitized suffix, then dispatches to
  Gemini (`inlineData`), Claude (base64 image block), and OpenAI/gateway/local (`image_url`).
- On-device returns `null` for images, so it needs nothing.

Change:

- `estimateNutritionFromPhoto(config, base64Image, context, portionScale?: PortionScale | null)`.
- `generateWithImageStructured(..., userMessageSuffix?, measuredContext?: string)`: append
  `measuredContext` to the user text **after** the sanitized suffix, unsanitized and unwrapped (it is
  our own string). Every provider branch already reads the same `userText`; confirm that while
  editing.
- Thread it through `trackMealWithThinking` and `extractRecipe` as an optional trailing argument so
  the thinking branch gets it too.
- `estimateNutritionFromPhoto` builds the string with `portionScalePromptSection` once and passes it
  to whichever branch runs. Nothing else calls it with a scale (chat `trackMeal` stays as is).

Tests: there is no test of `estimateNutritionFromPhoto` today, so add
`utils/__tests__/coachAIPortionScale.test.ts` (mock the provider clients the way
`coachAIClaude.test.ts` does): with a scale, both branches' request text contains the section after
the user description; without one, the request text is byte-identical to today's; a description
containing prompt-like text is still sanitized while the measured section is untouched.

## Phase 3: native module `modules/portion-ar` (Mac)

A local Expo module, iOS only, laid out like `modules/theme-app-icon` (picked up by autolinking
from `modules/`, imported as `@/modules/portion-ar`):

- `expo-module.config.json` with `"platforms": ["apple"]` (or `"ios"`, whichever this Expo version
  expects) so Android autolinking skips it entirely.
- `package.json` (private, `main: index.ts`), `ios/PortionAr.podspec`, `ios/PortionArModule.swift`,
  `ios/PortionArCameraView.swift`.
- `index.ts`: `requireOptionalNativeModule('PortionAr')`; exports `isPortionArSupported()`
  (`Platform.OS === 'ios'`, module present, and the native `isSupported()` =
  `ARWorldTrackingConfiguration.isSupported`). It returns `false` on Android and web, so nothing
  else needs a platform branch. Resolve the native view (`requireNativeView`) lazily inside the
  component, never at module scope: on Android and web the view manager doesn't exist and the call
  would throw at import.

The view (an Expo `View` definition wrapping an `ARSCNView` or `ARView`; nothing is rendered into
the scene):

- **Session**: `ARWorldTrackingConfiguration`, `planeDetection = [.horizontal]`, `videoFormat =
recommendedVideoFormatForHighResolutionFrameCapturing` when available. Run on `active = true`
  with `[.resetTracking, .removeExistingAnchors]`, pause on `active = false`, unmount and app
  background. No debug overlays.
- **Layout**: the same 4:3 frame the vision-camera preview shows today, so the preview matches the
  saved photo. Check `SmartCameraShell`'s camera slot sizing and match it.
- **Props**: `active: boolean`, `torch: boolean` (set `torchMode` on
  `ARWorldTrackingConfiguration.configurableCaptureDeviceForPrimaryCamera` under
  `lockForConfiguration`; ignore if the device has no torch).
- **Events**: `onReady`, `onSessionFailed({ message })` (from `session(_:didFailWithError:)`, camera
  denied, or no frame within a few seconds).
- **Async function `capture()`** → `{ uri, width, height, geometry | null }`:
  1. Read `session.currentFrame`; compute a fallback measurement input from it.
  2. `session.captureHighResolutionFrame` (iOS 16+; the app targets 17). Prefer the high-resolution
     frame and its own intrinsics and resolution; fall back to the current frame.
  3. Geometry only when `camera.trackingState == .normal` and a raycast from the frame centre
     (normalized `0.5, 0.5`, `alignment: .horizontal`) hits a plane, trying `.existingPlaneGeometry`
     first and then `.existingPlaneInfinite` (the food itself often hides the table under the
     centre, so the detected plane needs extending). Skip hits whose `ARPlaneAnchor.classification`
     is `.floor` (only when `ARPlaneAnchor.isClassificationSupported`; otherwise accept). Do not use
     `.estimatedPlane`: it is too unreliable for a number the AI will trust.
  4. Plane point = the hit's `worldTransform` translation; normal = its column 1 (the plane's up).
  5. Turn `frame.capturedImage` upright for the current interface orientation with Core Image
     (portrait = one clockwise quarter turn of the landscape-right buffer), write a JPEG
     (quality 0.95; the cropper re-encodes at `AI_PHOTO_QUALITY` anyway) to the caches directory,
     return its `file://` URI, the upright pixel size, and `uprightRotation` in the geometry.
  6. Ignore a capture that completes after the view was unmounted (resolve with an error the JS side
     treats like a cancelled shot).
- Return raw numbers only (column-major transform, intrinsics, sensor size, plane point and normal).
  No footprint, no thresholds in Swift: those live in `utils/portionScale.ts`.

Do **not** add `arkit` to `UIRequiredDeviceCapabilities` (it would remove the app from the store
for every device without ARKit). No new permission: ARKit uses the camera permission the app already
asks for.

Write `components/PortionArCameraView.tsx` as the React wrapper with the same ref shape as
`CameraViewRef`, widened: `takePictureAsync(): Promise<{ uri: string; portionGeometry?: PortionGeometry }>`.
Validate the geometry coming over the bridge (finite numbers, right lengths) before passing it on;
invalid geometry means "no measurement", never a thrown capture.

AGENTS.md says all native camera work goes through vision-camera. That rule exists because a second
CameraX library breaks Android. ARKit is iOS-only and not CameraX, so add an explicit exception to
the Camera bullet in the same change ("the iOS meal photo camera may run ARKit through
`modules/portion-ar`; everything else stays on vision-camera").

## Phase 4: crop region from the cropper (Mac)

`patches/@bsky.app+expo-image-crop-tool+0.5.1.patch` already patches this package. Extend it on iOS:
in `Cropper.swift`, `cropViewControllerDidCrop(_:cropped:transformation:cropInfo:)` receives Mantis'
`CropInfo`. Add to `OpenCropperResult` (Swift `CropperTypes.swift` and the TS
`ExpoImageCropTool.types.d.ts` in the same patch):

- `cropRegion`: the crop rectangle in normalized source-image coordinates (from
  `cropInfo.cropRegion`'s corners; check the field names in the Mantis version CocoaPods resolves),
- `rotationDegrees` (from `cropInfo.rotation`, and include flips from `transformation` if Mantis
  reports them).

Then in TS: a region is usable only when rotation is 0, there is no flip and the four corners form an
axis-aligned rectangle. Otherwise the shot gets no measurement (a rotated crop no longer lines up
with the camera axes; don't try to correct it).

If Mantis on the resolved version doesn't expose the region, fall back to `width`/`height` of the
result divided by the source size and assume a centred crop, and say so in `docs/RESEARCH.md`
(approximate on tilted shots, exact on overhead ones). Prefer the real region.

Android keeps returning no region; it never has a measurement to apply it to.

Run `npx patch-package @bsky.app/expo-image-crop-tool` to regenerate the patch, and keep the
existing `Queues.MAIN` change in it (AGENTS.md → Camera).

## Phase 5: camera integration

`hooks/useCameraCaptureFlow.ts`:

- `process` becomes `(fileUri: string, meta?: { portionScale?: PortionScale | null }) => Promise<void>`
  (the barcode processor ignores the second argument).
- `takePicture` keeps `photo.portionGeometry` and hands it to `cropAndProcess`.
- `cropAndProcess(imageUri, geometry?)`: after the crop, when there is geometry and a usable region,
  `portionScale = measurePortionScale(geometry, region)`; pass it as `meta`. Gallery picks pass no
  geometry. A cancelled crop still ends silently.

`components/modals/SmartCameraModal.tsx`:

- Use the AR view in the camera slot when all hold: `Platform.OS === 'ios'`,
  `isPortionArSupported()`, the setting is on, `cameraMode === 'ai-meal-photo'`, and the AR session
  hasn't failed during this opening of the modal. Otherwise render today's `CameraView` unchanged.
- `onSessionFailed` sets a state flag that switches to `CameraView` for the rest of this opening
  (no error shown; the user gets the normal camera).
- Mode switches (photo ↔ label ↔ barcode) unmount one camera and mount the other. ARKit can hold the
  camera for a moment after pausing, so the vision-camera side may fail its first start: retry once
  after a short delay (around 300 ms) before showing the camera error. Make sure the vision-camera
  warm-up capture (`runCameraWarmUp` in `CameraView`) never runs against the AR view.
- Flash: pass `flashEnabled` as `torch`.
- `processAiPhoto(fileUri, meta)` passes `meta?.portionScale` to `estimateNutritionFromPhoto` (phase
  2). No UI change. In development builds, log the measurement once (`console.log`) so QA can read it.

Tests:

- `hooks/__tests__/useCameraCaptureFlow.test.ts`: geometry from `takePictureAsync` plus a cropper
  result with a region reaches `process` as a `portionScale`; a rotated crop gives `undefined`;
  gallery gives `undefined`; cancel still calls nothing; the barcode quality constant is unchanged.
- A small test that the AR view is chosen only for `ai-meal-photo` with the setting on and support
  reported, and falls back after `onSessionFailed` (extract the choice into a pure function such as
  `shouldUsePortionArCamera(...)` in `components/` so it can be tested without rendering the camera).

## Phase 6: setting, docs, QA

Setting:

- `constants/settings.ts`: `MEASURE_PORTIONS_WITH_AR_SETTING_TYPE = 'measure_portions_with_ar'`.
- `constants/settingDefinitions.ts`: `measurePortionsWithAr: booleanSetting(..., true)`.
- `context/SettingsContext.tsx`: add the name to `REGISTERED_SETTINGS` (a boolean primitive).
- `components/modals/AdvancedSettingsModal.tsx`: a `ToggleInput` row in the Nutrition section,
  present only when `isPortionArSupported()` and `isAiConfigured` (it only affects AI photo
  estimates). Label "Measure portions with AR", description along the lines of "When you photograph
  a meal on a table, the camera measures the table so the AI can judge portion sizes. Nothing is
  saved." Keys in all five `lang/locales/*`, then `npm run generate-lang`,
  `npm run check-translations`, `npm run check-locale-consistency`.

Docs (same change as the code they describe):

- `AGENTS.md`: the Camera exception above, plus one feature bullet: native returns raw geometry,
  `utils/portionScale.ts` owns every number, the crop region is what gets measured, the section is
  appended outside the sanitized user text, iOS only, silent, the setting, no
  `UIRequiredDeviceCapabilities`.
- `docs/CURRENT_FEATURES.md`: one line under food photo estimation.
- `docs/RESEARCH.md`: the thresholds and why, the edge-midpoint footprint, why the crop region, the
  measured accuracy from QA below.
- `docs/FUTURE_FEATURES.md`: Android with ARCore (the TS half is reusable as is), LiDAR depth for
  food height on Pro models, measuring photos taken from the coach chat.

On-device QA (iPhone, then a Release build, since this repo's camera latency problems only showed in
release builds):

- **The A4 check.** Lay a sheet of A4 (21.0 × 29.7 cm) flat on a table, photograph it from about
  30–40 cm straight down, crop exactly to the paper. The logged measurement should read close to
  21 × 30 cm. Repeat at 20° tilt and record the error in `docs/RESEARCH.md`.
- A real plate: measured, and the estimate is sensible.
- Over 30° tilt, under 10 cm, over 1 m, pointing at the floor, before the table is found: photo
  works, no measurement.
- Setting off, and a simulated session failure: the normal camera, same behaviour as today.
- Photo → barcode → photo mode switches, flash on and off, backgrounding mid-session, camera
  permission denied, crop with rotation (no measurement).
- Shutter latency stays in line with today's camera.

Final validation (orchestrator): the new and touched Jest suites, `npm run typecheck`,
`npm run lint:eslint`, `npx prettier --check` on changed files, translation checks, then
`npm run prebuild:ios` and a build in Xcode.

## Phase 7 (optional): close-up focus and tap to focus

ARKit only streams the wide camera, which can't focus as close as the ultra-wide macro lens the
system camera switches to. Measured photos need at least 10 cm of height anyway, so close-ups are
never measured. Only do this phase if QA shows blurry close-ups:

- **Tap to focus** through `configurableCaptureDeviceForPrimaryCamera` (`focusPointOfInterest`,
  `.autoFocus`), converting the view point through `frame.displayTransform`.
- **Close-up hand-off**: sample every ~150 ms; when, after a ~0.6 s warm-up, the lens sits at its
  near limit or the raycast distance to the surface is below the device's `minimumFocusDistance`
  for ~0.5 s, and the phone has a lens that focuses closer, emit `onCloseUp`. `SmartCameraModal`
  then swaps to vision-camera's `CameraView` for that shot (unmeasured), with the same retry as a
  mode switch.

## Suggested split (for the Mac session)

Per `AGENTS.md` → Orchestration: phase 1 (with the test list above) and the locale and settings
edits in phase 6 are well specified and can go to workers; the native module (3), the patch (4) and
the camera integration (5) need judgment and a device, so keep them or give them to `worker` one at a
time.
