import {
  base64DecodedBytes,
  DEFAULT_HOSTED_IMAGE,
  effectiveImageLimits,
  HOSTED_BODY_OVERHEAD_BYTES,
  HOSTED_REQUEST_BODY_CAP_BYTES,
  nextQuality,
  planResize,
} from '@/utils/premium/hostedImagePlan';

const LIMITS = { maxPx: 1024, maxBytes: 300 * 1024, quality: 0.7 };

describe('base64DecodedBytes', () => {
  it('counts decoded bytes, honouring padding', () => {
    expect(base64DecodedBytes('AAAA')).toBe(3);
    expect(base64DecodedBytes('AAA=')).toBe(2);
    expect(base64DecodedBytes('AA==')).toBe(1);
    expect(base64DecodedBytes('')).toBe(0);
  });
});

describe('planResize', () => {
  it('keeps the aspect ratio and scales the longest side to maxPx', () => {
    expect(planResize({ width: 4000, height: 3000, bytes: 1000 }, LIMITS)).toEqual({
      targetWidth: 1024,
      targetHeight: 768,
      needsWork: true,
    });
    expect(planResize({ width: 3000, height: 4000, bytes: 1000 }, LIMITS)).toEqual({
      targetWidth: 768,
      targetHeight: 1024,
      needsWork: true,
    });
  });

  it('never upscales a small image', () => {
    expect(planResize({ width: 800, height: 600, bytes: 1000 }, LIMITS)).toEqual({
      targetWidth: 800,
      targetHeight: 600,
      needsWork: false,
    });
  });

  it('needs work when the bytes are over the limit even if the size fits', () => {
    expect(
      planResize({ width: 800, height: 600, bytes: LIMITS.maxBytes + 1 }, LIMITS).needsWork
    ).toBe(true);
  });

  it('needs work when the longest side is over maxPx even if the bytes fit', () => {
    expect(planResize({ width: 1200, height: 900, bytes: 10 }, LIMITS).needsWork).toBe(true);
  });
});

describe('effectiveImageLimits', () => {
  it('uses the defaults when the config has no image', () => {
    expect(effectiveImageLimits(null)).toEqual(DEFAULT_HOSTED_IMAGE);
  });

  it('clamps maxBytes so the base64 body stays under the Worker cap', () => {
    const limits = effectiveImageLimits({ maxPx: 1024, maxBytes: 900 * 1024, quality: 0.7 });
    const base64Length = Math.ceil(limits.maxBytes / 3) * 4;

    expect(limits.maxBytes).toBeLessThan(900 * 1024);
    expect(base64Length + HOSTED_BODY_OVERHEAD_BYTES).toBeLessThanOrEqual(
      HOSTED_REQUEST_BODY_CAP_BYTES
    );
  });

  it('leaves a maxBytes under the cap alone', () => {
    expect(effectiveImageLimits({ maxPx: 1024, maxBytes: 200 * 1024, quality: 0.7 }).maxBytes).toBe(
      200 * 1024
    );
  });

  it('clamps quality and maxPx to their ranges', () => {
    expect(effectiveImageLimits({ maxPx: 10, maxBytes: 1, quality: 2 })).toEqual({
      maxPx: 256,
      maxBytes: 1,
      quality: 0.95,
    });
    expect(effectiveImageLimits({ maxPx: 99999, maxBytes: 1, quality: 0.01 })).toEqual({
      maxPx: 4096,
      maxBytes: 1,
      quality: 0.3,
    });
  });
});

describe('nextQuality', () => {
  it('steps down by 0.1 and stops at the 0.3 floor', () => {
    expect(nextQuality(0.7)).toBe(0.6);
    expect(nextQuality(0.4)).toBe(0.3);
    expect(nextQuality(0.3)).toBeNull();
    expect(nextQuality(0.2)).toBeNull();
  });
});
