import {
  AI_IMAGE_TIER_ORDER,
  AI_IMAGE_TIERS,
  base64DecodedBytes,
  DEFAULT_AI_IMAGE_TIER,
  limitsForImageCount,
  limitsForTier,
  MULTI_IMAGE_MIN_SHARE_BYTES,
  nextQuality,
  OWN_KEY_IMAGE_CEILING,
  parseAiImageTier,
  planResize,
} from '@/utils/aiImagePlan';
import {
  DEFAULT_HOSTED_IMAGE,
  effectiveImageLimits,
  HOSTED_BODY_OVERHEAD_BYTES,
  HOSTED_REQUEST_BODY_CAP_BYTES,
} from '@/utils/premium/hostedImagePlan';

describe('AI image tiers', () => {
  it('has four tiers whose size and quality only go up', () => {
    expect(AI_IMAGE_TIER_ORDER).toEqual(['low', 'medium', 'high', 'max']);

    for (let i = 1; i < AI_IMAGE_TIER_ORDER.length; i += 1) {
      const lower = AI_IMAGE_TIERS[AI_IMAGE_TIER_ORDER[i - 1]];
      const higher = AI_IMAGE_TIERS[AI_IMAGE_TIER_ORDER[i]];

      expect(higher.maxPx).toBeGreaterThan(lower.maxPx);
      expect(higher.quality).toBeGreaterThan(lower.quality);
    }
  });

  it('defaults to the second lowest tier', () => {
    expect(DEFAULT_AI_IMAGE_TIER).toBe(AI_IMAGE_TIER_ORDER[1]);
    expect(DEFAULT_AI_IMAGE_TIER).toBe('medium');
  });

  it('reads only a known tier and treats anything else as the default', () => {
    expect(parseAiImageTier('low')).toBe('low');
    expect(parseAiImageTier('max')).toBe('max');
    expect(parseAiImageTier('')).toBe('medium');
    expect(parseAiImageTier('ultra')).toBe('medium');
    expect(parseAiImageTier(null)).toBe('medium');
    expect(parseAiImageTier(undefined)).toBe('medium');
  });
});

describe('limitsForTier', () => {
  it('never lowers a tier for a provider the person pays for directly', () => {
    for (const tier of AI_IMAGE_TIER_ORDER) {
      expect(limitsForTier(tier, OWN_KEY_IMAGE_CEILING)).toEqual({
        maxPx: AI_IMAGE_TIERS[tier].maxPx,
        maxBytes: OWN_KEY_IMAGE_CEILING.maxBytes,
        quality: AI_IMAGE_TIERS[tier].quality,
      });
    }
  });

  it('keeps an own-key photo under the 5 MB per-image limit of the strictest provider', () => {
    expect(OWN_KEY_IMAGE_CEILING.maxBytes).toBeLessThan(5 * 1024 * 1024);
  });

  it("holds a tier to the Worker's limits, so lowering the config shrinks every tier", () => {
    const strict = { maxPx: 640, maxBytes: 100_000, quality: 0.6 };

    expect(limitsForTier('max', strict)).toEqual({ maxPx: 640, maxBytes: 100_000, quality: 0.6 });
    expect(limitsForTier('high', strict).maxPx).toBe(640);
    // A tier below the ceiling keeps its own, smaller size.
    expect(limitsForTier('low', strict).maxPx).toBe(512);
  });

  it('keeps the whole Iron request under the Worker body cap whatever the config says', () => {
    const huge = effectiveImageLimits({ maxPx: 4096, maxBytes: 10_000_000, quality: 0.95 });
    const limits = limitsForTier('max', huge);

    expect((limits.maxBytes * 4) / 3 + HOSTED_BODY_OVERHEAD_BYTES).toBeLessThanOrEqual(
      HOSTED_REQUEST_BODY_CAP_BYTES
    );
  });

  it('uses the built-in Iron limits as the ceiling when the Worker config could not be read', () => {
    const limits = limitsForTier('max', effectiveImageLimits(DEFAULT_HOSTED_IMAGE));

    expect(limits.maxPx).toBe(DEFAULT_HOSTED_IMAGE.maxPx);
    expect(limits.quality).toBe(DEFAULT_HOSTED_IMAGE.quality);
    expect(limitsForTier('low', effectiveImageLimits(DEFAULT_HOSTED_IMAGE)).maxPx).toBe(512);
  });
});

describe('limitsForImageCount', () => {
  const base = { maxPx: 1568, maxBytes: 480 * 1024, quality: 0.8 };

  it('returns equal limits for one photo and clamps bad counts to one', () => {
    expect(limitsForImageCount(base, 1)).toEqual(base);
    expect(limitsForImageCount(base, 0)).toEqual(base);
    expect(limitsForImageCount(base, Number.NaN)).toEqual(base);
  });

  it('splits the byte budget and floors the count', () => {
    expect(limitsForImageCount(base, 2).maxBytes).toBe(240 * 1024);
    expect(limitsForImageCount(base, 2.9).maxBytes).toBe(240 * 1024);
    expect(limitsForImageCount(base, 2).maxPx).toBe(1568);
  });

  it('caps the pixel size when the share is below 120 KB, never raising it', () => {
    expect(MULTI_IMAGE_MIN_SHARE_BYTES).toBe(120 * 1024);
    expect(limitsForImageCount(base, 5).maxPx).toBe(768);
    expect(limitsForImageCount({ ...base, maxPx: 512 }, 5).maxPx).toBe(512);
  });
});

describe('base64DecodedBytes', () => {
  it('counts decoded bytes, honouring padding', () => {
    expect(base64DecodedBytes('AAAA')).toBe(3);
    expect(base64DecodedBytes('AAA=')).toBe(2);
    expect(base64DecodedBytes('AA==')).toBe(1);
    expect(base64DecodedBytes('')).toBe(0);
  });
});

describe('planResize', () => {
  const LIMITS = { maxPx: 1024, maxBytes: 300 * 1024, quality: 0.7 };

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

describe('nextQuality', () => {
  it('steps down by 0.1 and stops at the 0.3 floor', () => {
    expect(nextQuality(0.7)).toBe(0.6);
    expect(nextQuality(0.4)).toBe(0.3);
    expect(nextQuality(0.3)).toBeNull();
    expect(nextQuality(0.2)).toBeNull();
  });
});
