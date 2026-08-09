# Optical Transfer

Move a Musclog profile between two phones using nothing but one screen and one camera. The
sending phone displays an endless stream of animated QR codes; the receiving phone points its
camera at it and reconstructs the export. No network, no cable, no account, no pairing.

Built on the LT-fountain protocol from
[decimen-optical-transfer](https://github.com/BashAlarmist/decimen-optical-transfer) (MIT), whose
`fountain.ts` and frame header we port **verbatim** — see "Frozen wire format" below.

## Why a fountain code

A screen-to-camera link is a pure erasure channel with **no back-channel**. The receiver cannot
ask for a retransmission, and it _will_ miss frames — motion blur, autofocus hunting, a capture
straddling a display refresh. Looping the payload's chunks in order is miserable: miss chunk 7 and
you wait a whole cycle, and the tail becomes a coupon-collector problem.

So the sender never transmits source blocks directly. Frame `seq` carries the XOR of a
pseudorandom subset of the payload's `k` blocks, with both the subset size and the block indices
derived deterministically from `(sessionId, seq)`. The receiver collects **any ~K×1.25 distinct
frames, in any order**, and peels the payload out. A dropped frame costs time, never correctness.

## Pipeline

```
dumpDatabase()  →  JSON string
      ↓  utf8Encode
      ↓  SHA-256                     (verifies the payload end to end)
      ↓  gzip                        (~9x on a real export)
      ↓  AES-256-CBC                 (optional passphrase; AFTER gzip — see below)
      ↓  container: magic + lengths + hash
      ↓  LT fountain  →  frame (20-byte header + block)
      ↓  base44        →  QR alphanumeric text
      ↓  QR v13–v33, ECC L, mask 4
      ↓  Skia canvas   ~~ light ~~   camera
      ↓  useCodeScanner → string
      ↓  base44Decode → parseFrame → LTDecoder → FNV check
      ↓  AES → gunzip → SHA-256 check
      ↓  restoreDatabase(json)
```

**gzip strictly before AES.** Ciphertext is incompressible, so encrypting first would cost ~9× the
transfer time. This is why the passphrase lives at our container layer and _not_ in
`dumpDatabase(phrase)`.

## Two constraints that shaped everything

### 1. The scanner returns strings, not bytes

`react-native-vision-camera`'s `Code` type is `{ type, value?: string }` — there is no byte array —
and frame processors are disabled in `app.json`. MLKit's `Barcode.rawValue` is additionally
_nullable_ and returns null when the payload is not valid text. Decimen's frames begin `0xD1 0x0C`,
an invalid UTF-8 lead byte followed by an illegal continuation, so binary frames cannot survive
that path at all.

Hence **base44** (`utils/optical/base44.ts`): the QR alphanumeric alphabet minus space, 2 bytes →
3 chars. That keeps symbols in ALPHANUMERIC mode at 5.5 bits/char, so armoring costs **3.1%**.
Base64 would force BYTE mode and cost 25%. Space is excluded so no whitespace trimming anywhere in
the scanner stack can silently eat a frame's head or tail.

### 2. Android's scan resolution is not ours to choose

`react-native-vision-camera` builds the code-scanner analyzer as a bare
`ImageAnalysis.Builder().build()` (`CameraSession+Configuration.kt`, "5. Code Scanner") — no
`ResolutionSelector`, unlike its frame-processor branch. So CameraX's default applies and the
`format` prop cannot raise it. **Measured on device: 640×480, exactly as predicted.** On iOS
`format` does matter, because `AVCaptureMetadataOutput` samples `device.activeFormat`.

At a 480 px short edge a code filling ~90% of the frame gets ~432 px:

| preset     | QR ver | modules+quiet | px/module | bytes/frame |
| ---------- | ------ | ------------- | --------- | ----------- |
| `micro`    | 13     | 77            | 5.61      | 412         |
| `tiny`     | 16     | 89            | 4.85      | 568         |
| `compact`  | 20     | 105           | 4.11      | 832         |
| `standard` | 24     | 121           | 3.57      | 1136        |
| `dense`    | 27     | 133           | 3.25      | 1420        |
| `max`      | 33     | 157           | 2.75      | 2006        |
| (rejected) | 40     | 185           | 2.34      | —           |

V40 — decimen's own default, fine browser-to-browser where the receiver controls its capture
resolution — is not viable here.

### Density: the sender cannot measure the thing that matters

**Automatic selection is capped at `tiny`** (`MAX_RECOMMENDED_OPTICAL_PRESET_ID`), _and_ the user
can override both density and frame rate from the send screen. Both halves are necessary, and the
reason is structural rather than a fixable modelling error.

`calibrateDevice()` runs on the **sending** phone. The binding constraint lives on the **receiving**
phone's camera — its sensor, its autofocus, the light in the room, how steady the hands are — none
of which the sender can observe. A frame that fails to decode still counts as sent, so no
sender-side measurement can even detect the failure, let alone optimise against it.

That blindness produced a concrete failure. Ranking presets on `bytes/frame × min(buildFps, cap)`
is right on a slow phone, where it lands somewhere sparse. But on a **fast** phone every preset
saturates the display-rate cap, so the ranking degenerates to "most bytes per frame" and picks the
densest option available. A 3.6 MB export sent at `dense` then took roughly **an hour**, with the
receiving camera hunting for focus and decoding almost nothing.

Two things make density much worse than px/module suggests:

- autofocus tolerance collapses faster than resolution does — a sparse code stays readable while
  slightly blurred, a dense one does not; and
- goodput is nearly density-invariant anyway (see the encode table below), so the denser frame was
  never buying much to begin with.

Hence the two-part answer: a conservative automatic ceiling, because a sender-side ranking that
lands on the densest option is wrong regardless; and a manual override, because the only party who
can actually see whether the codes are being read is the person holding both phones.

### The escape hatch (`components/optical/OpticalQualityControls.tsx`)

Collapsed by default behind "Not scanning? Adjust", and **reachable while streaming** — a stuck
transfer is discovered by watching the other phone sit at 0%, and making the user stop, back out
and start over is the moment they give up.

Two steppers, in a deliberate order:

1. **Speed** (fps) comes first because it is free: the display loop reads it from a ref, so nothing
   restarts. Slowing down gives a struggling camera longer to catch each code, which is often
   enough on its own.
2. **Code size** (density) comes second and says that it restarts the transfer. It genuinely does:
   every frame becomes a different QR version, so the receiver sees a new `streamIdentity`,
   rebuilds its decoder and loses whatever it had collected.

Changing density is instant despite that, because `useOpticalSender` retains the packed container
for the whole session and re-slices it. Re-deriving it would mean another dump + gzip + hash.

## Measured results

### Determinism on Hermes — PASS

The exhaustive `dlog` sweep hashes to `0x27b0f3cc` on Hermes, matching Node/V8 and decimen's
golden vector. This was the highest-severity risk in the design: sender and receiver derive every
frame's block subset independently and never compare notes, so a one-ulp disagreement would
desynchronise the streams _silently_ — the transfer would simply never complete. Re-run this from
the bench after any Hermes or Expo upgrade.

### Encode cost — Moto Z3 Play (2018, Snapdragon 636), release build

| preset     | ver | encode p90 | rasterize | bytes/frame | **bytes/sec** |
| ---------- | --- | ---------- | --------- | ----------- | ------------- |
| `tiny`     | 16  | 81 ms      | 0.5 ms    | 548         | **6716**      |
| `compact`  | 20  | 123 ms     | 0.8 ms    | 812         | **6553**      |
| `standard` | 24  | 175 ms     | 1.0 ms    | 1116        | **6352**      |
| `dense`    | 27  | 228 ms     | 1.3 ms    | 1400        | **6108**      |
| `max`      | 33  | 321 ms     | 1.8 ms    | 1986        | **6154**      |

**Density buys nothing when the sender is encode-bound** — it is marginally _worse_. A QR symbol's
data capacity and its encoding cost both scale with the module count squared, so they cancel. Since
lower density also buys decode margin, the least dense preset is strictly better on both axes.
`calibrateDevice()` ranks on `blockLen × min(buildFps, cap)` and breaks ties toward lower density,
within the density ceiling described above — the ceiling exists precisely because that ranking
stops being meaningful once the sender outruns the camera.

Rasterizing is negligible; this is ~99% QR encode. Hermes runs it ~35–40× slower than desktop V8
(`standard`: 175 ms vs 4.4 ms) — no optimising JIT, and Reed–Solomon is a tight numeric loop.

### Payload — a real database

|                  |                              |
| ---------------- | ---------------------------- |
| `dumpDatabase()` | 389 ms                       |
| JSON             | 664,718 chars / 649 KB UTF-8 |
| gzip L1          | 75.4 KB (8.6×) 633 ms        |
| gzip L6          | **70.2 KB (9.2×)** 802 ms    |
| gzip L9          | 69.7 KB (9.3×) 1174 ms       |

L6 is the right default: 7% smaller than L1 for 170 ms.

### End-to-end — Pixel 6 sending, Moto Z3 Play receiving, `dense` preset

| payload | time   | throughput | frames new / needed | dup | ignored | blocks  |
| ------- | ------ | ---------- | ------------------- | --- | ------- | ------- |
| 100 KB  | 34.5 s | 2.9 KB/s   | 102 / ~93           | 55  | 0       | 74/74   |
| 385 KB  | 99.8 s | 3.9 KB/s   | 370 / ~353          | 195 | 0       | 282/282 |

Both verified by FNV and recovered exactly. **`ignored 0`** in both runs: every code the camera
decoded was a well-formed frame of ours, so the base44 armoring survives the scanner path
losslessly. Actual frame overhead was 1.10× and 1.05× of `k`, comfortably inside the 1.25× the ETA
model assumes.

Extrapolating a real 70 KB export: **roughly 20–25 seconds.**

## Frozen wire format

`utils/optical/fountain.ts` and `utils/optical/frameProtocol.ts` are **compatibility contracts with
our own past releases**. The two phones in a transfer can be running app versions months apart —
that is the entire use case — and they derive frame contents independently with no handshake.

- Not one arithmetic change to `dlog`, `solitonCdf`, `frameSeed`, `frameIndices`, `splitmix32`.
  `dlog` exists because `Math.log` is implementation-approximated in ECMAScript; replacing it with
  `Math.log`, or shortening its 21-term series, silently breaks every future transfer.
- The 20-byte little-endian frame header, magic `0xD1 0x0C`, is fixed.
- All format evolution belongs in the **container**, whose version byte is checked _after_
  reassembly — so a mismatch can produce "update Musclog on one of these phones" instead of a
  stream that never completes.

`utils/__tests__/opticalFountain.test.ts` and `opticalFrameProtocol.test.ts` hold decimen's golden
vectors. If one fails you have not broken a test, you have broken compatibility; that needs a
header version bump, not a re-recorded constant. Jest runs on V8, so the on-device sweep in the
bench is the other half of that guarantee.

## Sender pacing

Two bugs found on real hardware, both worth not reintroducing:

- **Never drive the display loop with `setInterval`.** At 10 fps the interval fires every 100 ms;
  if a frame costs 175 ms the callbacks queue up and the event loop never catches up, so the rate
  collapses progressively after a few seconds. The loop self-schedules with `setTimeout` — the next
  tick is queued only once the current one finishes — so an unreachable target degrades gracefully.
  A 16 ms floor keeps the thread yielding so Stop stays responsive.
- **Dispose `SkImage`s.** Each frame allocates ~65 KB of _native_ memory that JS garbage collection
  does not account for; the collector sees only a small wrapper while native memory climbs. On a
  low-end device the stream starts fine and grinds to a halt.

**`reloadApp()` was silently a no-op in release.** `utils/app.ts` had its branch inverted against
its own comment — `if (isProduction()) DevSettings.reload()` — so release builds took the dev path,
which does nothing there. Every restore in the app (file import, Local Backups, optical transfer)
finished without reloading, leaving stale data on screen until the user killed the app by hand.
Fixed, but the receive screen still ships an explicit "Restart now" button rather than assuming a
reload works: nothing should leave the user with no way forward right after their database was
replaced.

**Frame cache.** A frame's contents depend only on its seq, so a frame generated once can be
replayed for free. The sender caches module matrices (1 byte per module, ~14 KB at v24 — not the
65 KB raster) and re-rasterizes on display for ~1 ms. The first pass pays the encode cost; every
pass after it loops with no encoding at all.

The cache is **all-or-nothing** (`planFrameCache`). A cache too small to cover the worst-case frame
count is worse than no cache: looping N frames when the receiver needs more than N is a hard
deadlock at ~98%, silent and unrecoverable without restarting the sender. So either it holds
2.5×k — clearing decimen's measured p90 overhead of ~2.2 at small k, which the ETA model's 1.6
clamp does not — or the sender generates live forever, which is slower but always correct.

## Files

| path                                              | role                                                    |
| ------------------------------------------------- | ------------------------------------------------------- |
| `utils/optical/fountain.ts`                       | LT encoder/decoder, `dlog`, soliton CDF. **Frozen.**    |
| `utils/optical/frameProtocol.ts`                  | 20-byte frame header, FNV-1a, splitmix32. **Frozen.**   |
| `utils/optical/base44.ts`                         | binary ⇄ QR-alphanumeric text                           |
| `utils/optical/presets.ts`                        | density table, derived from zxing's own capacity tables |
| `utils/optical/qrEncode.ts`                       | QR generation with version and mask pinned              |
| `utils/optical/qrRaster.ts`                       | module matrix → RGBA pixels                             |
| `utils/optical/senderSession.ts`                  | `OpticalStream` — seq → frame text                      |
| `utils/optical/receiverSession.ts`                | `OpticalReceiver` — scanned text → payload              |
| `utils/optical/progress.ts`                       | overhead model, progress and ETA                        |
| `utils/optical/noSignal.ts`                       | when to show the "nothing is decoding" hint             |
| `utils/optical/bench.ts`                          | device calibration and the Phase 0 measurements         |
| `components/optical/OpticalQrCanvas.tsx`          | Skia draw, integer module scaling                       |
| `components/optical/OpticalScannerCamera.tsx`     | receiving camera (vision-camera)                        |
| `components/SmartCameraFrame.tsx`                 | shared aiming frame + scrim, `portrait` variant here    |
| `components/optical/OpticalQrCanvas.web.tsx`      | Skia-free DOM canvas, same integer scaling              |
| `components/optical/OpticalScannerCamera.web.tsx` | getUserMedia + our own frame pump                       |
| `utils/optical/qrCanvasLayout.ts`                 | integer module scaling, shared by both canvases         |
| `utils/optical/webQrDecode.ts`                    | decoder selection and the wasm reader                   |
| `scripts/sync-web-wasm.js`                        | self-hosts the wasm into `public/`                      |
| `app/app/test/optical-bench.tsx`                  | the measurement harness (runs on both platforms)        |

### The aiming frame is decoration

Both scanner components overlay `SmartCameraFrameOverlay` (`components/SmartCameraFrame.tsx`,
`variant="portrait"` — the same frame the food camera uses, minus the barcode glyph and sweep). It
is **purely an aiming aid**: neither reader crops to it. MLKit scans the whole analysis frame on
native, and the web pump decodes the whole video frame, so a QR that sits outside the window still
decodes. Do not "optimize" by cropping the decode to the frame — the window is smaller than what
the camera can read, and on Android the analysis frame is only ~640×480 to begin with (see above),
so throwing pixels away would cost decodes for nothing.

Two placement rules: the overlay lives **inside** each scanner (not in `OpticalReceiveModal`), so
the permission and no-camera branches — which render text instead of a feed — never get a frame
drawn over them; and it must stay `pointerEvents="none"`, because tap-to-refocus on the native feed
underneath is the one thing a user can do about a stalled transfer. The scrim spills to the nearest
clipping ancestor, which is the receiver's `overflow-hidden` feed container, so the progress panel
below stays bright.

## Web

Both directions run in a browser, and web is a first-class end of a transfer rather than a
degraded one — a laptop screen is a better sender than a phone (bigger, brighter, steadier), and
a phone browser receiving from a desktop is a real case. Everything above the two device-facing
components is already platform-agnostic: `useOpticalSender` deliberately returns a plain
`QrRaster` rather than an `SkImage`, `useOpticalReceiver` only ever sees `Code[]`, and every
`utils/optical/` module is pure. So the platform split is exactly two files plus a decoder.

### The parts that differ

| concern            | native                              | web                                                  |
| ------------------ | ----------------------------------- | ---------------------------------------------------- |
| draw a frame       | Skia canvas (`OpticalQrCanvas.tsx`) | DOM `<canvas>` + `putImageData` (`.web.tsx`)         |
| camera             | vision-camera                       | `getUserMedia` + a `<video>` we pump ourselves       |
| decode             | MLKit, via the code scanner         | `BarcodeDetector` if present, else zxing-cpp in wasm |
| capture resolution | ~640×480, not ours to choose        | requested — `ideal: 1920×1080`                       |

`react-native-vision-camera` **throws at module init** on web
(`system/camera-module-not-found`), so anything that reaches it needs a counterpart even when the
feature is gated at runtime — that is why `hooks/useOpticalReceiver.ts` imports `Code` and
`CodeScannerFrame` with `import type` (a value import of type specifiers can survive as a
side-effect import) and why the web scanner declares its own props rather than importing them.
Skia needs no counterpart: `@shopify/react-native-skia` imports cleanly on web
(`hooks/useChartCapture.ts` already does), and the web canvas never touches it.

### Why the decoder is zxing-cpp in wasm, not the zxing already in the tree

`@zxing/library` is a direct dependency (`qrEncode.ts` uses its _encoder_ internals) and decoding
with it would have added nothing to install. It is not good enough. Measured on simulated camera
frames built from our own presets — area-sampled at a fractional scale, blurred, noisy,
off-centre, filling part of the frame; the harness is `utils/__tests__/opticalWebQrDecode.test.ts`
— the pure-JS reader decoded **5 of 18** frames at 10–280 ms each, failing even at 10 px/module,
while zxing-cpp compiled to wasm decoded **18 of 18** at 2–12 ms, including `max` at 2.6
px/module. Those failures do not produce a slow transfer, they produce a progress bar that never
moves: the fountain only advances on frames that decode.

The browser's own `BarcodeDetector` is tried first where it exists (Chrome/Edge on Android,
ChromeOS, macOS). It reads the `<video>` element directly — no pixel copy into JS, no wasm
download — and its QR support is confirmed with `getSupportedFormats()` before it is used, because
the spec allows an implementation to support any subset.

### The wasm is self-hosted, deliberately

`zxing-wasm` fetches its binary from jsdelivr by default. This feature promises "no internet, no
account, nothing leaves the room", and a receiver that quietly needs a CDN breaks that on exactly
the offline case it exists for — while telling a third party when a transfer happens.
`scripts/sync-web-wasm.js` copies the binary into `public/` (git-ignored, regenerated on
`postinstall` and on both web build scripts) and `OPTICAL_WASM_URL` points at our own origin via
`EXPO_BASE_URL`. There is **no CDN fallback**: `prepareZXingModule` is always awaited before the
first `readBarcodes`, so the packaged default never applies, and a missing copy surfaces as a
failure on the receive screen rather than as a silent network request.

### Verifying the web halves without two devices

A browser transfer can be driven end to end from a script, which is worth knowing because the
alternative is two machines and a lot of holding things still.

Chromium accepts `--use-file-for-fake-video-capture=<file.y4m>`, so `getUserMedia` returns a video
file instead of a camera. Generating that file from our own sender pipeline —
`packOpticalContainer` → `OpticalStream` → `encodeQrAlphanumericFixed` → `rasterizeQr`, each frame
scaled into a 640×480 Y plane on a dark background, wrapped in a raw y4m — gives a synthetic camera
pointed at a real stream. Emit about `2.2 × k` frames so the looping file carries enough distinct
seqs for the fountain to close.

Run against a production web export served over plain HTTP (`getUserMedia` needs a secure context,
and `localhost` counts), with `localStorage.onboardingCompleted = 'true'` set before navigating so
the app does not bounce to onboarding. Note the test routes — including the bench — `Redirect` to
`/app` in a production export (`app/app/test/_layout.tsx`), so drive the real UI: Settings → Local
Data Settings → Optical Transfer.

Done that way, the receiver reassembles the payload and lands on "Data received and verified"
without a camera being involved anywhere.

### Density on web

`MAX_RECOMMENDED_OPTICAL_PRESET_ID` still caps automatic selection at `tiny`, and that is still
right: calibration runs on the _sender_, which cannot know that the receiver is a browser
requesting 1080p rather than an Android phone pinned to 640×480. A web receiver can comfortably
handle denser codes — that is what the manual override in `OpticalQualityControls` is for.

### Why `qrEncode.ts` reimplements zxing's encoder

`@zxing/library` is already a dependency and exposes every public static piece of
`Encoder.encode`'s body, so this adds no package. Two reasons it does not just call `encode()`:

1. **`Encoder.encode` cannot produce a symbol filled to capacity.** `willFit` (`Encoder.js:262`)
   computes `(numInputBits + 7) / 8` where the Java original uses integer division; the float leaks
   through and a payload occupying the final partial codeword is rejected as "Data too big". The
   `standard`, `dense` and `max` presets all size frames to exactly that boundary.
2. Pinning the mask skips an 8-way search worth ~1.43× (measured). Note that is far less than the
   search's share of the _work_: Reed–Solomon dominates and both paths pay it once. If a sender is
   ever encode-bound, the lever is the RS step or a native encoder — not the mask.

### Progress semantics

The receiver's progress bar tracks **frames collected, never blocks solved**. LT peeling
back-loads: blocks-solved sits near zero and then hockey-sticks, while frame arrival is linear. A
bar driven by solved blocks looks stalled for most of the transfer and then teleports. Blocks
belong on a secondary line. The sender shows no progress bar at all and says so — a user staring
at an endless fountain expecting one is the likeliest support question.

**`estimateTransferProgress` never returns 1, and the hook must override it on completion.**
Mid-flight the curve cannot know how many more frames a particular stream will need, so it
asymptotes to 99% rather than promising a finish it might not keep. But that produced a visible
bug: the peeling cascade solves every remaining block in a single step, so the blocks-based term
never got a tick of its own, and the transfer jumped from wherever the frame curve happened to be
— reproducibly **95%** — straight to the verified screen. 100% was never displayed. `useOpticalReceiver`
therefore publishes `fraction: 1` (and clears the ETA) once the payload is out, because completion
is a fact rather than an estimate. Pinned by `hooks/__tests__/useOpticalReceiver.test.ts`.

The percentage is shown to **two decimals** alongside a KB pair — `8.23% (12.3 KB / 130.4 KB)`.
Two decimals because a slow transfer moves less than a whole percent per second and a frozen
number reads as a stall. The KB figures are derived from the same fraction, not from solved
blocks, for the back-loading reason above: a literal "bytes reconstructed" counter would sit at
0 KB for almost the whole transfer and then jump to the total.
