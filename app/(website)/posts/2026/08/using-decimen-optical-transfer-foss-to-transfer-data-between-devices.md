---
title: 'Using Decimen Optical Transfer FOSS to transfer data between devices'
date: '2026-08-03'
category: 'development'
description: 'I saw a repo that sends files between two devices using only a screen and a camera, and I could not stop thinking about it. So I built it into Musclog — here is how fountain-coded QR streams actually work.'
tags: ['Open Source', 'QR Codes', 'Privacy', 'React Native', 'TypeScript']
---

Last week I ran into [decimen-optical-transfer](https://github.com/bashalarmistalt/decimen-optical-transfer) and lost an evening to it. The pitch is one sentence: _send a file between two devices using nothing but a screen and a camera._ One device animates QR codes, the other points its camera at them, and the file arrives. No network. No pairing. No account. No cable. No server in the middle that has to be trusted, or funded, or kept alive.

I sat there thinking about it for way too long, and then I realised Musclog had exactly the problem it solves.

## The problem I actually had

Musclog stores everything on your device. That is the whole point — your weight, your food, your cycle data, your training history never leave the phone unless you explicitly export them. It is the feature I care most about.

It is also the feature that makes "I got a new phone" genuinely annoying.

Every option I had shipped was some flavour of _put your data somewhere else, temporarily_. Export a JSON file and email it to yourself. Drop it in a cloud folder. Plug in a cable and hope the file manager cooperates. Each of those quietly undoes the promise: to move your data between two devices you own, you first have to hand it to something you do not.

Optical transfer has no such step. The data goes from one screen into one camera, as light, in the same room, and that is the entire path.

## Why you cannot just loop the chunks

The obvious version of this is: split the file into `k` chunks, show them as QR codes one after another, loop forever, receiver collects them.

This is miserable in practice, and it is worth understanding why, because it is the thing the clever part fixes.

A screen-to-camera link is a pure **erasure channel with no back-channel**. The receiver cannot ask for a retransmission — there is no path back. And it _will_ miss frames: motion blur, autofocus hunting, a capture landing straight across a display refresh. So if you send chunks in order and the receiver misses chunk 7, it waits an entire cycle to see chunk 7 again. Worse, the tail of the transfer becomes a coupon-collector problem: once you have 99 of 100 chunks, every frame you see is almost certainly one you already have, and you sit there waiting for the one you need.

Decimen's answer, which I ported wholesale, is a **fountain code** — specifically an LT (Luby transform) code.

The sender never transmits a source chunk directly. Frame `seq` carries the XOR of a pseudorandom subset of the payload's blocks, where both the size of that subset and which blocks are in it are derived deterministically from `(sessionId, seq)`. The receiver collects **any ~K×1.15 distinct frames, in any order**, and peels the payload back out.

A dropped frame costs a bit of time. It never costs correctness. There is no tail problem, because there is no "last chunk" to wait for — every frame is a fresh, useful combination.

## Both ends have to agree, and they never talk

Here is the part that makes this delicate, and the part that made me most nervous about shipping it.

The sender and receiver both compute which blocks belong in frame `seq`. They compute it independently. They never compare notes — there is no handshake, because there is no back-channel to handshake over. Both sides just have to arrive at bit-identical answers, forever.

Which means the degree distribution has to be reproducible down to the last bit. Every operation in that path is exactly specified by IEEE-754 — `+ - * /`, `Math.imul`, `Math.sqrt`, the shifts — with exactly one exception:

`Math.log` is **implementation-approximated** in ECMAScript. The spec permits engines to disagree.

A one-ulp disagreement shifts a boundary in the soliton CDF, flips a sampled degree, and desynchronises the two streams. The failure mode is not an error. It is a progress bar that goes up for a while and then stops, forever, with no explanation.

So decimen ships its own deterministic natural log, and I copied it character for character:

```ts
/**
 * Deterministic natural log: exact-ops range reduction + atanh series.
 *
 * This is wire format, not a utility: it differs from `Math.log` by up to 1 ulp on
 * roughly a quarter of the inputs `solitonCdf()` feeds it, which is enough to shift a
 * CDF entry and flip a sampled degree.
 */
export function dlog(x: number): number {
  let e = 0;
  let m = x;
  while (m >= 1.5) {
    m /= 2;
    e++;
  }
  while (m < 0.75) {
    m *= 2;
    e--;
  }

  const z = (m - 1) / (m + 1);
  const z2 = z * z;
  let term = z;
  let sum = 0;
  for (let n = 1; n <= 21; n += 2) {
    sum += term / n;
    term *= z2;
  }

  return 2 * sum + e * LN2;
}
```

Shortening that series from 21 terms to 19 changes about 0.2% of outputs. Spot checks miss it. A real transfer eventually hits it. So `fountain.ts` and `frameProtocol.ts` are marked **frozen** in the codebase, and the test suite pins them against decimen's golden vectors — a failing test there does not mean I broke a test, it means I broke compatibility with every copy of Musclog already installed.

That last point is worth dwelling on, because it is stricter for me than it was for decimen. Their two ends are two browser tabs loading the same build. My two ends are two _app versions_, potentially months apart. The phone you are migrating from might be running something I shipped last winter.

The tests run on Node, which is V8. The app runs on Hermes. So there is also an on-device sweep that hashes every `dlog` output and checks it against `0x27b0f3cc`. It passes — Hermes, V8 and decimen's vector all agree.

## The frame

Every frame is fully self-describing, so there is no handshake and no session setup. The receiver can lock onto a stream mid-flight, and a new session id simply starts a fresh transfer:

```
Layout (little-endian), 20 bytes, followed by `blockLen` payload bytes:
  0  u8   magic 0xD1
  1  u8   magic 0x0C
  2  u16  sessionId   random per sender start
  4  u32  seq         drives the fountain PRNG
  8  u16  k           source block count
 10  u16  blockLen    payload bytes per frame
 12  u32  totalLen    container length in bytes
 16  u32  payloadFnv  FNV-1a of the whole container — verified on completion
```

The sender side ends up being almost boringly small, which I think is a good sign:

```ts
const stream = new OpticalStream(packedContainer, preset, newOpticalSessionId());

// ...and then, forever, at whatever frame rate the device can sustain:
const text = stream.next();
```

And the receiver is a loop of "here is a string the camera saw":

```ts
const receiver = new OpticalReceiver();

// from the camera callback, 15–30 times a second:
receiver.accept(text, Date.now()); // 'new' | 'duplicate' | 'ignored'

if (receiver.isComplete) {
  // FNV verified, container ready to unpack
}
```

## Two things I had to solve that decimen did not

Porting the protocol was the easy half. The two ends being a phone camera rather than a browser changed the constraints underneath it.

### The scanner hands you a string, never bytes

`react-native-vision-camera`'s `Code` type is `{ type, value?: string }`. There is no byte array on it. And on Android the backend is MLKit, whose `Barcode.rawValue` is _nullable_ and returns null when the payload is not valid text.

Our frames start `0xD1 0x0C` — an invalid UTF-8 lead byte followed by an illegal continuation. Binary frames would not merely be mangled on that path, they would be silently dropped.

The fix is to armor the bytes into text. Base64 is the reflex, and it is the wrong answer here: base64 uses characters outside QR's ALPHANUMERIC set, which forces the encoder into BYTE mode at 8 bits per character — a 25% tax on every single frame.

So instead: **base44**, the QR alphanumeric alphabet minus the space.

```ts
/** QR alphanumeric charset (ISO/IEC 18004 Table 5) minus the space at index 36. */
export const BASE44_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ$%*+-./:';
```

Two bytes become three characters, the encoder stays in ALPHANUMERIC mode at 5.5 bits per character, and armoring costs **3.1%** instead of 25%.

The space is dropped deliberately, and that detail is my favourite one in the whole feature. QR's alphanumeric set has 45 characters, and 45³ ≥ 2¹⁶ would work fine — that is essentially RFC 9285 base45. But space is the one character that whitespace-trimming _anywhere_ in the scanner stack could silently eat off the head or tail of a frame, and a truncated frame is indistinguishable from a corrupt payload three layers downstream. 44³ = 85,184, still comfortably ≥ 65,536, so losing it costs nothing.

### Denser QR codes are not faster

This one cost me an actual hour of my life, watching a progress bar not move.

The intuition is that a denser QR code carries more bytes, so it should transfer faster. I built automatic device calibration on exactly that assumption, ranking presets by `bytes per frame × achievable frame rate`.

Then I measured it:

| preset     | QR ver | encode p90 | bytes/frame | **bytes/sec** |
| ---------- | ------ | ---------- | ----------- | ------------- |
| `tiny`     | 16     | 81 ms      | 548         | **6716**      |
| `compact`  | 20     | 123 ms     | 812         | **6553**      |
| `standard` | 24     | 175 ms     | 1116        | **6352**      |
| `dense`    | 27     | 228 ms     | 1400        | **6108**      |
| `max`      | 33     | 321 ms     | 1986        | **6154**      |

Goodput is essentially **flat**, and if anything it gets slightly worse. A QR symbol's data capacity scales with the module count squared — and so does the cost of encoding it. They cancel almost exactly.

Meanwhile autofocus tolerance does _not_ scale gracefully. A sparse code stays readable while slightly blurred; a dense one does not.

So density buys nothing and costs reliability. But my calibration could not see that, for a structural reason rather than a modelling bug: **calibration runs on the sending phone, and the binding constraint lives on the receiving phone's camera.** Its sensor, its autofocus, the light in the room, how steady someone's hands are. None of it is observable from the sender. And an undecoded frame still counts as sent — so no sender-side measurement can even detect the failure, let alone optimise against it.

On a slow phone the ranking worked. On a fast phone every preset saturated the display cap, the ranking degenerated to "most bytes per frame", and it confidently picked the densest option. A 3.6 MB export at `dense` took roughly an hour while the receiving camera hunted for focus and decoded almost nothing.

The fix is two-part, and both halves are necessary. Automatic selection is now capped well below the maximum. And the send screen exposes speed and code size as manual controls **that work while the stream is running** — because a stuck transfer is discovered by watching the _other_ phone sit at 0%, and making someone stop, back out and start over is exactly the moment they give up.

## The pipeline, end to end

```
dumpDatabase()  →  JSON string
      ↓  utf8Encode
      ↓  SHA-256                     (verifies the payload end to end)
      ↓  gzip                        (~9x on a real export)
      ↓  AES-256-CBC                 (optional passphrase; AFTER gzip)
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

The ordering of gzip and AES is load-bearing. Ciphertext is incompressible, so encrypting before compressing would make the payload roughly nine times larger — and therefore the transfer roughly nine times longer. That is why the passphrase lives at the container layer rather than being passed down into the database dump.

Real numbers from a real database: a 649 KB JSON export compresses to **70.2 KB**, a 9.2× reduction. Measured end to end, Pixel 6 sending and a 2018 Moto Z3 Play receiving, 385 KB took 99.8 seconds and recovered exactly — with `ignored: 0`, meaning every single code the camera decoded was a well-formed frame. The armoring survives the scanner path losslessly.

A typical 70 KB export lands around **20–25 seconds**.

## It also carries one meal

Moving an entire profile is the headline use case, but it is not the common one. You migrate phones every few years. You want to send your girlfriend the curry recipe you just logged on Tuesday.

So the same pipeline carries a single meal and the food and portion rows it depends on. Everything below the container is byte-identical — one previously-reserved byte in the container header became a `payloadKind` field, and a database container still writes zero there, so it is indistinguishable from one produced before shares existed.

The size difference is dramatic. A five-ingredient meal is about 2.5 KB of JSON, roughly 1 KB after gzip, which is `k ≈ 2` — it completes in under a second. Attaching the photo is optional and off by default, because a 60 KB JPEG dominates everything else and pushes the transfer to about 17 seconds.

The two directions behave completely differently on arrival, deliberately:

- A **database** transfer replaces the receiving device's data. It is destructive, it is gated, and it asks first.
- A **meal** share previews what it is about to add, and then adds it. Nothing existing is touched.

Getting that separation right was most of the work. `restoreDatabase()` wipes the receiver, and its validation is deliberately permissive so it can still read old exports — so a share must be structurally incapable of being mistaken for a database dump by a build that has never heard of shares. Two independent guards handle that, and an old app rejects a share before it gets anywhere near the destructive path.

**Workouts are next.** Adding a share kind means adding a registry entry, a builder, a preview and some translations — not touching fountain frames. Sending someone a workout template you built, with no account and no link, feels like it should have always worked that way.

## It runs in the browser too

Both ends work on the web, and not as a degraded fallback. A laptop screen is a _better_ sender than a phone: bigger, brighter, and it does not wobble.

That came almost free, because everything above the two device-facing components is platform-agnostic — the sender hook returns a plain raster rather than a Skia image, the receiver only ever sees decoded strings, and every module under `utils/optical/` is pure. The platform split is two files and a decoder.

One deliberate decision there: the wasm QR decoder is **self-hosted**. Its library fetches the binary from a CDN by default, and a feature whose entire promise is "no internet, nothing leaves the room" cannot quietly require a CDN on exactly the offline case it exists for — while also telling a third party when a transfer is happening. The binary is copied into our own origin at build time, and there is no CDN fallback.

## Credit where it is due

The idea, the protocol, the fountain implementation and several of the shared helpers are [Evan Crawley's](https://github.com/bashalarmistalt/decimen-optical-transfer) work, not mine. I ported them. The parts I built are the phone-specific plumbing around them: the camera path, the text armoring, the density controls, the container format, and everything about meals.

One note for anyone else thinking of doing this: Musclog's port is from decimen's **MIT-licensed releases, v0.3.0 and earlier**. The project has since moved to AGPL-3.0-or-later, with those earlier releases remaining available under their original terms. Check which licence applies to the version you are looking at before you copy anything out of it.

Go and look at the project anyway. It is a genuinely great idea, executed carefully, and the web version works in any browser with a camera.

## Try it

In Musclog, it lives in **Settings → Data → Optical Transfer**, and meals are shared from the meal list. Point one phone at the other. That is the whole interaction.

- [Download Musclog for Android](https://play.google.com/store/apps/details?id=com.werules.logger)
- [Join the iOS TestFlight](https://testflight.apple.com/join/mq3QMSHU)
- [Read the source on GitHub](https://github.com/blopa/musclog-app) — the optical code is under `utils/optical/`
- [decimen-optical-transfer](https://github.com/bashalarmistalt/decimen-optical-transfer), the project this is built on

If you find a device combination where it stalls, please open an issue with both phone models. That is exactly the failure the sender cannot see.
