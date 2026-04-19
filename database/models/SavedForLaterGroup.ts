import { Model, Query } from '@nozbe/watermelondb';
import { children, field } from '@nozbe/watermelondb/decorators';

import type SavedForLaterItem from './SavedForLaterItem';

export default class SavedForLaterGroup extends Model {
  static table = 'saved_for_later_groups';

  static associations = {
    saved_for_later_items: { type: 'has_many' as const, foreignKey: 'group_id' },
  };

  @field('name') name!: string;
  @field('original_meal_type') originalMealType!: string;
  @field('original_date') originalDate!: number;

  @field('created_at') createdAt!: number;
  @field('updated_at') updatedAt!: number;
  @field('deleted_at') deletedAt?: number;

  @children('saved_for_later_items') items!: Query<SavedForLaterItem>;
}
