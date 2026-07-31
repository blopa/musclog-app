/**
 * Dispatches rep-counting classification to the model for a segment's mechanic
 * type, falling back to the pooled `general` model.
 *
 * Everything in this directory except this file and `models.d.ts` is generated
 * by `training-data/train.py` and copied here by `npm run sync-ml-model`:
 * `model_general.js`, a `model_<type>.js` per mechanic type that earned a
 * dedicated model, and `models.js` mapping the two together. Adding or
 * dropping a dedicated model is therefore a training-time decision only — no
 * code here changes.
 */
import { type MechanicType, normalizeMechanicType } from '@/utils/mechanicType';

import { MODEL_LOADERS, type SegmentClassifier } from './models';

/**
 * Forests are loaded lazily (see `models.js`) and memoized here, so a session
 * only pays to parse the one or two mechanic types it actually classifies.
 */
const loadedClassifiers = new Map<MechanicType, SegmentClassifier>();

function classifierFor(mechanicType: MechanicType): SegmentClassifier {
  const loaded = loadedClassifiers.get(mechanicType);
  if (loaded) {
    return loaded;
  }

  const classifier = (MODEL_LOADERS[mechanicType] ?? MODEL_LOADERS.general)();
  loadedClassifiers.set(mechanicType, classifier);

  return classifier;
}

/**
 * `classifySegment(features, mechanicType)[1] > 0.5` → is a real rep.
 *
 * `mechanicType` is normalized by `normalizeMechanicType`, the same rule
 * `train.py` applies when building the training set — so the segment's
 * `mechanic_*` one-hot features and the model that scores them always agree.
 */
export function classifySegment(input: number[], mechanicType?: string): [number, number] {
  return classifierFor(normalizeMechanicType(mechanicType))(input);
}
