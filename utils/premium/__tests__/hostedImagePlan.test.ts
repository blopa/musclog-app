import {
  DEFAULT_HOSTED_IMAGE,
  effectiveImageLimits,
  hostedDecodedBytesLimit,
  HOSTED_BODY_OVERHEAD_BYTES,
  HOSTED_REQUEST_BODY_CAP_BYTES,
} from '@/utils/premium/hostedImagePlan';

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

describe('hostedDecodedBytesLimit', () => {
  it('matches the single-photo limit by default', () => {
    expect(hostedDecodedBytesLimit()).toBe(
      Math.floor(((HOSTED_REQUEST_BODY_CAP_BYTES - HOSTED_BODY_OVERHEAD_BYTES) * 3) / 4)
    );
  });

  it('shares a 1 MiB body between five photos, counting the overhead once', () => {
    expect(hostedDecodedBytesLimit(1024 * 1024, 5)).toBe(
      Math.floor(((1024 * 1024 - HOSTED_BODY_OVERHEAD_BYTES) * 3) / 4 / 5)
    );
  });

  it('feeds effectiveImageLimits through count and bodyMaxBytes', () => {
    const config = { maxPx: 1024, maxBytes: 900 * 1024, quality: 0.7 };

    expect(effectiveImageLimits(config, { count: 5, bodyMaxBytes: 1024 * 1024 }).maxBytes).toBe(
      hostedDecodedBytesLimit(1024 * 1024, 5)
    );
    expect(effectiveImageLimits(config, { count: 1, bodyMaxBytes: null })).toEqual(
      effectiveImageLimits(config)
    );
  });
});
