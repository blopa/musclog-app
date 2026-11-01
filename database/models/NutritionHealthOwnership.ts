import { Model } from '@nozbe/watermelondb';
import { field } from '@nozbe/watermelondb/decorators';

export type NutritionHealthOwnershipKind = 'owned_log' | 'ignored_record';

/** Facts survive log deletion, so an old platform record can never resurrect it. */
export default class NutritionHealthOwnership extends Model {
  static table = 'nutrition_health_ownership';

  @field('kind') declare kind: NutritionHealthOwnershipKind;
  @field('record_id') declare recordId: string;
  @field('created_at') declare createdAt: number;
}
