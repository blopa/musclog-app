---
title: 'My camera took 25 seconds to take a photo'
date: '2026-08-24'
category: 'engineering'
description: 'A shutter stall that only existed in release builds, survived eight versions and four wrong root causes, and turned out to be one background thread shared by every Expo module in the app.'
tags:
  ['Musclog', 'React Native', 'Expo', 'Android', 'CameraX', 'Kotlin', 'Performance', 'Debugging']
---

You open the camera in Musclog, point it at a nutrition label, and tap the shutter. Twenty-five seconds later, the photo appears.

Not 25 seconds of spinner with something happening behind it. Twenty-five seconds of a frozen-looking app while the preview kept streaming happily, because the camera was fine. Everything was fine. It just did not give me the picture.

This is the story of chasing that number through two completely different bugs, four root causes I was wrong about, one workaround I shipped and later had to delete, and the actual culprit, which was not the camera, not the crop tool, not the image picker, and not even in the same neighbourhood as any of them.

The camera matters more in this app than it sounds like it should. It is the fastest way to log food: point it at a barcode and the product resolves, or snap the label and OCR reads the macros off it, or photograph the plate and the AI estimates it. Every one of those starts with the same shutter button. A shutter that takes 25 seconds is not a slow feature, it is a dead one.

## It only happened in production

The first thing that made this miserable: I could not reproduce it. On a development build the shutter was instant. On a release APK, on the same phone, same code, it was 25 seconds.

That asymmetry is the whole reason this took eight version bumps (2.9.13 through 2.9.20, most of them in a single day) instead of one afternoon. Everything I could iterate on quickly was healthy, and the only build that showed the bug was the one that takes minutes to produce and cannot be debugged with a JS console.

So the loop became: form a theory, build a release APK, install it, tap the shutter, watch `adb logcat`. If you ever wondered why this codebase has always-on camera telemetry in shipped builds, that is why.

## Wrong cause #1: it's the processing step

The first theory was the boring one. The capture returns a huge image, we recompress it, that costs seconds. Turning off post-capture processing did make things faster, and I briefly thought I had it.

I did not have it. Removing the recompression just uncovered the real delay that had been hiding underneath it, which is a pattern that repeated all the way through this: every fix I made revealed that the thing I fixed had been masking the actual problem.

## Wrong cause #2: the session is cold

Next theory, and this one is at least partly true. Android's CameraX only fully converges autofocus, exposure and white balance on the _first_ still capture of a session. The first photo you take after opening the camera pays a one-off cost that later photos do not.

So I made the app pay it in the background: as soon as the camera session reports ready, fire one silent capture and throw the result away, while the user is still framing their shot. That code is still in the app today, in [`components/cameraWarmUp.ts`](https://github.com/blopa/musclog-app/blob/main/components/cameraWarmUp.ts), because it is genuinely a good idea — a snapshot of a preview that has not converged yet is a blurry, badly exposed snapshot.

But as the commit that introduced it admits, it is a workaround that masks a delay which should not exist in the first place. It made the first shot faster. It did not make it fast.

## Wrong cause #3: zero-shutter lag

CameraX has a real answer to "the first capture is slow", and it is `CAPTURE_MODE_ZERO_SHUTTER_LAG`: keep a ring buffer of recent sensor frames continuously topped up, and when the shutter is pressed, hand back the frame nearest the press instead of running a fresh capture. It is roughly what the stock Pixel camera does to feel instant.

`expo-camera` did not expose it, so I patched `ExpoCameraView.kt` through patch-package to call `setCaptureMode(CAPTURE_MODE_ZERO_SHUTTER_LAG)` right after the camera binds, gated on `isZslSupported()`. The patch was written straight from the CameraX documentation without an Android SDK available to compile it, which is a sentence I include because it is exactly the kind of thing that should make you suspicious, and because the patch's own commit message says so.

It survived about a day. Not because it was wrong, but because I then replaced `expo-camera` with [`react-native-vision-camera`](https://github.com/mrousavy/react-native-vision-camera), which exposes the same fast-capture path natively as `photoQualityBalance="balanced"` — no source patching required.

That migration had its own trap worth writing down, because it cost me a release-build boot crash. Two CameraX-based camera libraries in one app is not a neutral choice: vision-camera 4.7.3 compiles against CameraX 1.5.0-alpha03 and links to internal classes like `Camera2CameraInfoImpl`, while expo-camera SDK 57 asks for CameraX 1.6.0, where that class no longer exists. Gradle resolves each artifact to the highest requested version, so the APK shipped 1.6.0 and vision-camera died with `NoClassDefFoundError` the moment its native module initialised. I wrote a config plugin to pin every `androidx.camera` artifact to vision-camera's exact version, used it for exactly as long as it took to delete `expo-camera` entirely, and then deleted the plugin too. The rule that replaced it lives in `AGENTS.md`: do not add a second CameraX-based library.

And after all of that, the shutter was still slow.

## What was actually happening

Here is the shape of it, and it is nastier than any of my theories.

`takePhoto()` runs a real capture through CameraX's still-image pipeline. `takeSnapshot()` does not: on Android it reads the already-composited preview `View`'s bitmap directly, no capture request, no round trip to the camera HAL. It is near-instant regardless of how warm the session is, because the frame is already on screen. That is what a shutter button in a food-logging app actually wants — it does not need a 108-megapixel sensor read, it needs the thing the user is currently looking at.

So the shutter became a snapshot. And here is where the two halves of the bug meet:

`PreviewView.getBitmap()` on Android returns null until the preview has painted its first frame, and with the default `SurfaceView` preview type, the underlying `PixelCopy` read has device-specific failures where it returns null or a black bitmap even after that. When the snapshot failed, the code did the reasonable-looking thing and fell back to a real `takePhoto()`. Which, in `photoQualityBalance="balanced"` — that is CameraX's zero-shutter-lag mode, the thing I had gone out of my way to enable — has documented device-specific stalls that run into _tens of seconds_.

That is the 25 seconds. A silent fallback into the exact capture mode I had added on purpose to make things fast.

And the dev/prod asymmetry finally made sense too: ZSL silently degrades to a normal capture mode on hardware that does not properly support it, including the emulator and the dev-build path I had been testing on all day. The mode that stalls was only ever fully active in the builds I could not attach a debugger to.

The fix is two props, which is an infuriating ratio of effort to diff size:

```typescript
// components/CameraView.tsx — both of these are load-bearing
androidPreviewViewType = 'texture-view'; // snapshot needs a reliable getBitmap()
photoQualityBalance = 'speed'; // never "balanced": that is ZSL, which stalls
```

`texture-view` gives the snapshot path a bitmap it can actually read, and `speed` keeps the fallback out of ZSL if it ever runs at all.

I still do not know which of the two was decisive, because I shipped them together and then the bug was gone. Both are cheap. Both stay.

## 131 milliseconds

Verified on a release APK on a Pixel 6:

```text
[CameraView] shutter outcome: {"path":"snapshot","previewWaitMs":11,"totalMs":131}
[CameraView] warm-up capture took 352ms
```

131 milliseconds, down from roughly 25,000. The `path` field is there because the whole incident was caused by a fallback nobody could see, so now every single shutter press says out loud which route it took.

The other thing that came out of it is the capture ladder itself, pulled into [`components/cameraShutter.ts`](https://github.com/blopa/musclog-app/blob/main/components/cameraShutter.ts) so its incident-shaped control flow can be unit tested away from a camera: wait (bounded) for the preview's first-frame signal, take a snapshot, and only if that fails fall back to a real capture — bounded too, because an uncancellable capture that hangs for 40 seconds is strictly worse than an error the user can retry.

```typescript
const snapshot = await takeSnapshot();
reportShutterOutcome({ path: 'snapshot', previewWaitMs, totalMs: Date.now() - startedAt });
return snapshot;
```

Slow or fallback shots go to Sentry as events rather than breadcrumbs, for the deeply unglamorous reason that this app's Sentry config sets `maxBreadcrumbs: 0`, so a breadcrumb here would have been written to nowhere.

## Then the crop took 24 seconds

With the shutter fixed, I opened the camera on a Pixel 10, took a photo, and waited 24 seconds for the crop UI.

Different phone, different step, same number. This is the part of the post where I would like to tell you I stayed calm.

The measurements were unambiguous and completely unhelpful. Shutter: 106ms, snapshot path, clean. Then `openCropperAsync` was called, and 23.1 seconds later `ActivityTaskManager` logged the crop activity starting, and the activity itself rendered in 48ms. So the delay was entirely inside the native module call, _before_ it launched anything. During those 23 seconds the app logged nothing at all — no ANR, no dex2oat, no network, no binder block. One garbage collection freeing about 68MB, and silence.

Theories, in order, each killed by a measurement:

- **CameraX dynamic range negotiation on Android 17.** Disproven: the resolver settles on SDR immediately, and the camera HAL keeps streaming preview at ~15fps through the entire stall. The camera was innocent the whole time.
- **kotlin-reflect converting the options object.** Expo logs an "Introspectable data is missing, falling back to reflection-based conversion" warning right at the start of the gap, which looked like a smoking gun. I patched the crop module to pass a plain `Map` in both directions, confirmed on a fresh release build that the warning was gone, and measured the delay again: unchanged. I had over-attributed a warning that merely happened to be logged nearby.
- **No ahead-of-time compilation.** `ProfileInstaller: Skipping profile installation` appears in the logs, so nothing was precompiled and the first run would be interpreted. Plausible, and testable: `adb shell cmd package compile -m speed -f com.werules.logger`, force-stop, try again. No change.
- **First-time class loading of the cropper's class graph.** My leading suspect at maybe 70% confidence, and the reason I nearly shipped a background pre-warm at boot to hide it.

Then I ran the experiment I should have run first. Take two photos in one session and time both crops:

```text
crop #1 (fresh process): 24.65s
crop #2 (same session):  9ms
```

One-time per process, cached after. Which fit the class-loading theory beautifully, and also fit several other theories, and — crucially — I could not tell which. I had a shape, not a cause.

## The workaround I did not like

At that point I made a call: stop chasing it and route around it. The crop tool came off the camera path entirely. Shutter photos went straight to the barcode reader / OCR / AI without a crop step, so the common flow never called the function that stalled. Gallery picks still cropped, and could still pay the 24 seconds once per session.

I shipped that, updated the comments, updated the tests, and was quietly unhappy about it, because "we removed the feature that triggers the bug" is not a diagnosis. I also refused to ship the boot pre-warm, because paying 24 seconds of background CPU on every cold start to hide something I could not name is not a fix, it is a bribe.

## The clue was doing nothing

The thing that finally cracked it was an observation I almost did not bother writing down: if you booted the app, waited about 25 seconds doing absolutely nothing, and _then_ picked from the gallery, it was instant.

Read that against the theory. A lazy one-time initialisation inside the crop module cannot be cleared by waiting, because waiting does not initialise anything. If sitting idle fixes it, the cost was never inside the thing being called. Something else was busy, and my call was standing in a queue behind it.

Which reframes every symptom at once. It is not the cropper. It is not the picker — that is why swapping to the legacy picker had done nothing, and why the crop and the picker both showed the same ~25 seconds. They were not two bugs. They were two things waiting on the same thread.

## One thread, shared by everything

Every Expo `AsyncFunction` and `Coroutine` on the default queue runs on **one** shared background thread: `expo.modules.AsyncFunctionQueue`, a single `HandlerThread` owned by the app context. Every module. One thread.

`expo-secure-store` 57.0.1's `getValueWithKeyAsync` and `setValueWithKeyAsync` are coroutines that do no dispatcher switch, so their Android Keystore and SharedPreferences work runs directly on that shared thread. Cold Keystore initialisation plus RSA/AES key generation is slow — many seconds slow, on first access after boot.

And Musclog reads SecureStore during boot, for the database encryption key and an API-key migration. So the sequence is:

1. App boots, asks SecureStore for the encryption key.
2. SecureStore starts cold Keystore work **on the shared modules thread**.
3. Every other Expo async function in the app is now stuck behind it.
4. The user opens the camera and taps something that needs the picker or the cropper.
5. That call sits in the queue for as long as the Keystore takes.
6. The user sees 25 seconds of nothing.

Head-of-line blocking, in a queue I did not know I was using, caused by a module that has nothing to do with cameras. This is corroborated by [expo/expo#34531](https://github.com/expo/expo/issues/34531), which I found only after I knew what I was looking for — as usual, the search that finds the answer is the one you can only write once you already have it.

The fix is a patch that gives SecureStore its own serial lane:

```kotlin
private val moduleCoroutineScope = CoroutineScope(
  Dispatchers.IO.limitedParallelism(1) + SupervisorJob()
)

(AsyncFunction("getValueWithKeyAsync") Coroutine { key: String, options: SecureStoreOptions ->
    return@Coroutine getItemImpl(key, options)
  }).runOnQueue(moduleCoroutineScope)
```

The Keystore still takes as long as it takes. It just no longer takes everything else with it.

There is one more trap sitting behind that patch, and it is the kind that makes you doubt a correct fix: SDK 57 ships `expo-secure-store` as a **prebuilt AAR**, so a patched `.kt` file is simply ignored unless the project also asks for that package to be built from source. Both halves are load-bearing:

```json
"expo": {
  "autolinking": {
    "android": { "buildFromSource": ["expo-secure-store"] }
  }
}
```

Two supporting changes went in alongside it, both aimed at asking the Keystore for less: `getEncryptionKey()` now coalesces concurrent reads per storage key instead of firing several in parallel (which also closed a latent fresh-install race that could generate and persist two different keys, and therefore data that could not be decrypted), and the API-key migration became a run-once boot migration instead of something that ran on every start.

The crop module keeps its own patch too — running `openCropperAsync` on the main queue, since all it does is `startActivityForResult`, which is a main-thread operation anyway. That one is now cheap defence in depth rather than the fix.

## Putting the workaround back in the box

Two weeks later, the crop step went back onto the camera path. Every capture is cropped again, whether it came from the shutter or the gallery, because the reason it had been removed no longer existed.

That is the part of this I am happiest about. Not the 131 milliseconds — undoing the workaround. A workaround you can delete is the receipt that says you actually found the cause, and every one of my earlier "fixes" would have had to stay in the codebase forever, quietly making things weirder, because none of them could ever be proven unnecessary.

## What stayed behind

Nothing about this is defended by remembering it. So:

- Both camera props are documented as load-bearing, with the failure mode spelled out, so a future cleanup pass cannot quietly "optimise" `photoQualityBalance` back to `balanced`.
- Every shutter press reports its path and phase timings to logcat on release builds, and slow or fallback shots raise Sentry events. If the fallback ever fires again on somebody's device, I find out from telemetry rather than from a review.
- The SecureStore patch is paired in the docs with the `buildFromSource` requirement, because either one alone is a silent no-op, and both must be re-verified on every Expo upgrade.
- Camera changes must be verified on a **release** build. The incident never once reproduced in development, and a fix verified in dev would have been verified against a bug that was not there.

## What I would tell myself

Two things, and I do not think either is specific to cameras.

**A silent fallback is a bug that hides bugs.** The snapshot failing and quietly rerouting into a slow capture is what turned a clear failure into a mystery. If the shutter had thrown the first time `PixelCopy` returned null, this would have been an afternoon. The `path` field in that telemetry line exists so the app can never again do something slow and expensive without saying which route it took.

**A theory that explains the symptom is not the same as the cause.** Every single wrong answer here explained the 24 seconds perfectly. Cold initialisation, missing AOT, class loading — all of them predicted "slow the first time, fast after that", and all of them were wrong. The one observation that mattered was the one none of them could survive: waiting around doing nothing also fixed it. Chasing the theory that fits is easy. The useful move, every time, was finding the measurement that kills it.

Musclog is at [musclog.app](https://musclog.app/), the code is on [GitHub](https://github.com/blopa/musclog-app), and the shutter is fast now. On both phones.
