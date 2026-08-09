/**
 * The sender/receiver session pair — everything the two phones do except the light itself.
 *
 * These drive `OpticalStream` straight into `OpticalReceiver`, so they cover the full chain:
 * fountain encode → frame header → base44 → base44 → frame parse → fountain decode → FNV. The
 * only untested links are the QR symbol (covered by opticalQrEncode.test.ts, including a real
 * decoder round trip) and the camera.
 */

import { fnv1a } from '@/utils/optical/frameProtocol';
import { getOpticalPreset, OPTICAL_PRESETS } from '@/utils/optical/presets';
import { OpticalReceiver } from '@/utils/optical/receiverSession';
import { newOpticalSessionId, OpticalStream } from '@/utils/optical/senderSession';

function payloadOf(byteLength: number, salt = 0): Uint8Array {
  const payload = new Uint8Array(byteLength);
  for (let i = 0; i < byteLength; i++) {
    payload[i] = (i * 37 + (i >> 8) * 11 + salt) & 0xff;
  }
  return payload;
}

/** Run a transfer, optionally dropping frames, and return what the receiver ended up with. */
function transfer(
  payload: Uint8Array,
  presetId = 'standard',
  options: { dropEvery?: number; maxFrames?: number } = {}
) {
  const preset = getOpticalPreset(presetId);
  const stream = new OpticalStream(payload, preset, 4242);
  const receiver = new OpticalReceiver();
  const { dropEvery = 0, maxFrames = stream.k * 40 + 500 } = options;

  let sent = 0;
  let result = 'ignored';
  while (sent < maxFrames) {
    const text = stream.next();
    sent++;
    if (dropEvery > 0 && sent % dropEvery === 0) {
      continue;
    }
    result = receiver.accept(text, sent * 100);
    if (result === 'complete' || result === 'checksum-failed') {
      break;
    }
  }

  return { receiver, result, sent, k: stream.k, stream };
}

describe('OpticalStream', () => {
  it('derives k and the payload checksum from the payload', () => {
    const payload = payloadOf(50_000);
    const preset = getOpticalPreset('standard');
    const stream = new OpticalStream(payload, preset, 7);

    expect(stream.k).toBe(Math.ceil(payload.length / preset.blockLen));
    expect(stream.totalLen).toBe(payload.length);
    expect(stream.payloadFnv).toBe(fnv1a(payload));
  });

  it('emits a constant-length frame for every seq', () => {
    // The QR version is pinned per preset, so a short frame would produce a symbol of a
    // different version mid-stream and the receiver would stop decoding.
    const stream = new OpticalStream(payloadOf(9_000), getOpticalPreset('compact'), 3);
    const lengths = new Set<number>();
    for (let i = 0; i < 300; i++) {
      lengths.add(stream.next().length);
    }
    expect(lengths.size).toBe(1);
  });

  it('advances seq and is reproducible at an explicit seq', () => {
    const stream = new OpticalStream(payloadOf(5_000), getOpticalPreset('standard'), 11);
    const first = stream.frameText(0);

    expect(stream.seq).toBe(0);
    expect(stream.next()).toBe(first);
    expect(stream.seq).toBe(1);
    // Same seq must always give the same frame — the receiver dedupes on seq.
    expect(stream.frameText(0)).toBe(first);
  });

  it('draws session ids inside the header’s u16, never zero', () => {
    for (let i = 0; i < 2000; i++) {
      const id = newOpticalSessionId();
      expect(Number.isInteger(id)).toBe(true);
      expect(id).toBeGreaterThanOrEqual(1);
      expect(id).toBeLessThanOrEqual(0xffff);
    }
  });
});

describe('end-to-end transfer', () => {
  it('recovers the payload exactly on every preset', () => {
    for (const preset of OPTICAL_PRESETS) {
      const payload = payloadOf(preset.blockLen * 7 + 13);
      const { receiver, result } = transfer(payload, preset.id);

      expect(result).toBe('complete');
      expect(receiver.takeContainer()).toEqual(payload);
    }
  });

  it('recovers a payload that is not a whole number of blocks', () => {
    const payload = payloadOf(50_001);
    const { receiver, result } = transfer(payload);

    expect(result).toBe('complete');
    expect(receiver.takeContainer()).toEqual(payload);
  });

  it('recovers a single-block payload', () => {
    const payload = payloadOf(200);
    const { receiver, result, k } = transfer(payload);

    expect(k).toBe(1);
    expect(result).toBe('complete');
    expect(receiver.takeContainer()).toEqual(payload);
  });

  it('treats dropped frames as a time cost, not a correctness one', () => {
    // The whole reason for a fountain: no back-channel, so loss must only slow things down.
    const payload = payloadOf(120_000);
    const clean = transfer(payload);
    const lossy = transfer(payload, 'standard', { dropEvery: 3 });

    expect(lossy.result).toBe('complete');
    expect(lossy.receiver.takeContainer()).toEqual(payload);
    expect(lossy.sent).toBeGreaterThan(clean.sent);
    // Distinct frames needed must not inflate; only their arrival is slower.
    expect(lossy.receiver.stats.framesNew).toBeLessThan(clean.receiver.stats.framesNew * 1.3);
  });

  it('reports overhead in the range the ETA model assumes', () => {
    // progress.ts predicts frames-needed from expectedFountainOverhead(); if reality drifts far
    // from it the receiver's ETA becomes fiction.
    const { receiver, k } = transfer(payloadOf(300_000));
    const overhead = receiver.stats.framesNew / k;

    expect(overhead).toBeGreaterThanOrEqual(1);
    expect(overhead).toBeLessThan(1.6);
  });
});

describe('OpticalReceiver robustness', () => {
  it('ignores anything that is not one of our frames, without throwing', () => {
    const receiver = new OpticalReceiver();
    const junk = ['https://example.com', '5901234123457', '', 'ABC', 'hello world', '::::::::::::'];

    for (const text of junk) {
      expect(receiver.accept(text, 0)).toBe('ignored');
    }
    expect(receiver.stats.framesNew).toBe(0);
    expect(receiver.stats.streamKey).toBeNull();
  });

  it('counts a re-read of the same on-screen code as a duplicate', () => {
    // The common case: the camera runs faster than the sender's frame rate.
    const stream = new OpticalStream(payloadOf(60_000), getOpticalPreset('standard'), 5);
    const receiver = new OpticalReceiver();
    const text = stream.next();

    expect(receiver.accept(text, 0)).toBe('reset');
    for (let i = 0; i < 5; i++) {
      expect(receiver.accept(text, i)).toBe('duplicate');
    }

    expect(receiver.stats.framesNew).toBe(1);
    // Must be exactly 5 — an accumulating counter would report 15 here.
    expect(receiver.stats.framesDup).toBe(5);
  });

  it('rebuilds its decoder when the stream changes, even on the same session id', () => {
    // Session ids are 16 random bits, so a collision across a sender restart is rare but real.
    // Feeding a mismatched frame into the surviving decoder corrupts it silently.
    const preset = getOpticalPreset('standard');
    const first = new OpticalStream(payloadOf(60_000, 1), preset, 777);
    const second = new OpticalStream(payloadOf(90_000, 2), preset, 777);
    const receiver = new OpticalReceiver();

    expect(receiver.accept(first.next(), 0)).toBe('reset');
    expect(receiver.accept(first.next(), 1)).toBe('accepted');
    expect(receiver.stats.framesNew).toBe(2);

    // Same session id, different payload — must start over, not accumulate.
    expect(receiver.accept(second.next(), 2)).toBe('reset');
    expect(receiver.stats.framesNew).toBe(1);
    expect(receiver.stats.totalLen).toBe(90_000);
  });

  it('completes a restarted sender on the same payload without restarting the decode', () => {
    // streamIdentity includes payloadFnv, so an identical payload resumes into the same decoder.
    // Identical k/sessionId/seq produce an identical frame, so this is correct.
    const preset = getOpticalPreset('standard');
    const payload = payloadOf(60_000);
    const receiver = new OpticalReceiver();

    const first = new OpticalStream(payload, preset, 31);
    for (let i = 0; i < 10; i++) {
      receiver.accept(first.frameText(i), i);
    }
    const before = receiver.stats.framesNew;

    const restarted = new OpticalStream(payload, preset, 31);
    expect(receiver.accept(restarted.frameText(10), 100)).toBe('accepted');
    expect(receiver.stats.framesNew).toBe(before + 1);
  });

  it('reports checksum-failed rather than handing back corrupt bytes', () => {
    // The gate that stops a corrupted stream from ever reaching restoreDatabase().
    const preset = getOpticalPreset('standard');
    const payload = payloadOf(preset.blockLen);
    const stream = new OpticalStream(payload, preset, 9);
    const receiver = new OpticalReceiver();

    // k=1, so frame 0 alone completes it. Corrupt one payload character, leaving the header
    // (and so the declared FNV) intact.
    const text = stream.frameText(0);
    const headerChars = 30;
    const corrupted =
      text.slice(0, headerChars) +
      (text[headerChars] === 'A' ? 'B' : 'A') +
      text.slice(headerChars + 1);

    expect(receiver.accept(corrupted, 0)).toBe('checksum-failed');
    expect(receiver.takeContainer()).toBeNull();
  });

  it('ignores further frames once complete, and reset() clears everything', () => {
    const payload = payloadOf(20_000);
    const { receiver, stream } = transfer(payload);

    expect(receiver.isComplete).toBe(true);
    expect(receiver.accept(stream.frameText(9999), 0)).toBe('ignored');
    expect(receiver.takeContainer()).toEqual(payload);

    receiver.reset();
    expect(receiver.isComplete).toBe(false);
    expect(receiver.takeContainer()).toBeNull();
    expect(receiver.stats).toEqual({
      streamKey: null,
      k: 0,
      blockLen: 0,
      totalLen: 0,
      framesNew: 0,
      framesDup: 0,
      framesIgnored: 0,
      solvedBlocks: 0,
      startedAtMs: 0,
      lastFrameAtMs: 0,
    });
  });
});
