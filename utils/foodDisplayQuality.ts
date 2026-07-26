import type { FoodLabels } from '@/database/models/Food';

/**
 * The quality badges shown for a food (Nutri-Score / Eco-Score / NOVA / labels), normalized
 * away from any one provider's field names and casing. Every food source maps into this shape
 * exactly once, at its own mapper — see `getOffDisplayQuality` (Open Food Facts),
 * `getMusclogDisplayQuality` (Musclog API), and the `getExternalProductDisplayQuality`
 * dispatcher that picks between them.
 */
export type FoodDisplayQuality = {
  nutriScore?: string;
  ecoScore?: string;
  novaGroup?: number;
  labels?: FoodLabels;
};

/** The quality columns of a `Food` record, as written on the save path. */
export type FoodQualityRecord = {
  nutriscore?: string;
  ecoscore?: string;
  novaGroup?: number;
  labels?: FoodLabels;
};

/**
 * Reads quality badges back off a stored food record (or anything else already shaped like one,
 * e.g. a mapped search result) into the display shape. Returns undefined when the record carries
 * no quality data at all, so callers can skip rendering the section entirely.
 */
export function foodRecordDisplayQuality(
  record: FoodQualityRecord | null | undefined
): FoodDisplayQuality | undefined {
  if (!record) {
    return undefined;
  }

  const quality: FoodDisplayQuality = {
    nutriScore: record.nutriscore || undefined,
    ecoScore: record.ecoscore || undefined,
    novaGroup: record.novaGroup ?? undefined,
    labels: record.labels ?? undefined,
  };

  const isEmpty =
    quality.nutriScore == null &&
    quality.ecoScore == null &&
    quality.novaGroup == null &&
    quality.labels == null;

  return isEmpty ? undefined : quality;
}

/**
 * Writes normalized quality badges onto a food record. Absent fields are left untouched rather
 * than cleared, so re-saving a product from a source that carries fewer badges never wipes
 * badges an earlier save recorded.
 */
export function applyDisplayQualityToFoodRecord(
  record: FoodQualityRecord,
  quality: FoodDisplayQuality | undefined
): void {
  if (!quality) {
    return;
  }

  if (quality.nutriScore != null) {
    record.nutriscore = quality.nutriScore;
  }

  if (quality.ecoScore != null) {
    record.ecoscore = quality.ecoScore;
  }

  if (quality.novaGroup != null) {
    record.novaGroup = quality.novaGroup;
  }

  if (quality.labels != null) {
    record.labels = quality.labels;
  }
}
