import { base44Encode } from '@/utils/optical/base44';
import {
  OPTICAL_PROBE_MIN_FRAMES,
  OpticalFrameProbe,
  readOpticalStreamIdentity,
} from '@/utils/optical/frameProbe';
import { type FrameHeader, packFrame } from '@/utils/optical/frameProtocol';

const header = (overrides: Partial<FrameHeader> = {}): FrameHeader => ({
  blockLen: 8,
  k: 4,
  payloadFnv: 0x1234_5678,
  seq: 0,
  sessionId: 0xabcd,
  totalLen: 32,
  ...overrides,
});

const frameText = (overrides: Partial<FrameHeader> = {}): string =>
  base44Encode(packFrame(header(overrides), new Uint8Array(header(overrides).blockLen).fill(7)));

describe('readOpticalStreamIdentity', () => {
  it('identifies a frame and holds the identity across seq', () => {
    const first = readOpticalStreamIdentity(frameText({ seq: 0 }));
    expect(first).not.toBeNull();
    // `seq` is the one header field that varies inside a stream, so it must not be part of the key.
    expect(readOpticalStreamIdentity(frameText({ seq: 91 }))).toBe(first);
    expect(readOpticalStreamIdentity(frameText({ sessionId: 0x1111 }))).not.toBe(first);
  });

  it.each([
    ['an EAN-13 barcode', '5901234123457'],
    ['a URL, which base44 cannot even decode', 'https://example.com/product/12345'],
    ['in-alphabet text that carries no frame magic', 'ABCDEF0123456789'],
    ['empty', ''],
  ])('ignores %s', (_label, text) => {
    expect(readOpticalStreamIdentity(text)).toBeNull();
  });
});

describe('OpticalFrameProbe', () => {
  it('swallows the first frame but only prompts on the second', () => {
    const probe = new OpticalFrameProbe();
    expect(OPTICAL_PROBE_MIN_FRAMES).toBe(2);

    // The first frame must already be reported as ours. If it fell through to the barcode lookup
    // the camera would tear down for a "food not found" sheet and the second frame — the one that
    // triggers the prompt — would never arrive.
    expect(probe.observe(frameText({ seq: 1 }))).toBe('frame');
    expect(probe.observe(frameText({ seq: 2 }))).toBe('detected');
  });

  it('prompts at most once per stream', () => {
    const probe = new OpticalFrameProbe();
    probe.observe(frameText({ seq: 1 }));
    probe.observe(frameText({ seq: 2 }));

    // MLKit fires 15–30×/s; re-announcing on every one of them would restart the prompt forever.
    expect(probe.observe(frameText({ seq: 3 }))).toBe('frame');
    expect(probe.observe(frameText({ seq: 4 }))).toBe('frame');
  });

  it('keeps swallowing frames after a dismissal, and prompts again for a different stream', () => {
    const probe = new OpticalFrameProbe();
    probe.observe(frameText({ seq: 1 }));
    expect(probe.observe(frameText({ seq: 2 }))).toBe('detected');

    probe.dismiss();
    // Still not a food barcode just because the user waved the prompt away.
    expect(probe.observe(frameText({ seq: 3 }))).toBe('frame');
    expect(probe.observe(frameText({ seq: 4 }))).toBe('frame');

    // A restarted sender on a different payload is a new offer, not the dismissed one.
    probe.observe(frameText({ sessionId: 0x4321, seq: 1 }));
    expect(probe.observe(frameText({ sessionId: 0x4321, seq: 2 }))).toBe('detected');
  });

  it('never reports a real barcode as a frame', () => {
    const probe = new OpticalFrameProbe();
    expect(probe.observe('5901234123457')).toBe('ignored');
    expect(probe.observe('5901234123457')).toBe('ignored');
  });

  it('forgets everything on reset, dismissal included', () => {
    const probe = new OpticalFrameProbe();
    probe.observe(frameText({ seq: 1 }));
    probe.observe(frameText({ seq: 2 }));
    probe.dismiss();

    probe.reset();

    expect(probe.observe(frameText({ seq: 3 }))).toBe('frame');
    expect(probe.observe(frameText({ seq: 4 }))).toBe('detected');
  });
});
