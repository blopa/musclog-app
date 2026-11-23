import {
  AI_IMAGE_TIER_ORDER,
  AI_IMAGE_TIERS,
  DEFAULT_AI_IMAGE_TIER,
  limitsForTier,
  OWN_KEY_IMAGE_CEILING,
  parseAiImageTier,
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
