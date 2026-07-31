import type { MechanicType } from '@/utils/mechanicType';

/** `classifySegment(features)` → `[prob_noise, prob_rep]`. */
export type SegmentClassifier = (input: number[]) => [number, number];

/**
 * Hand-written declaration for the generated `./models.js` — the only
 * hand-maintained type in this directory. The shape is deliberately asymmetric
 * because that is the real invariant: `train.py` always exports a pooled
 * `general` model, and adds an entry per mechanic type only when a dedicated
 * model beat `general` on that type's held-out recordings. Anything absent
 * here is a mechanic type that falls back to `general`.
 */
export declare const MODEL_LOADERS: Partial<Record<MechanicType, () => SegmentClassifier>> & {
  general: () => SegmentClassifier;
};
