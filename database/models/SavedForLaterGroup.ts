import { Model, Query } from '@nozbe/watermelondb';
import { children, field } from '@nozbe/watermelondb/decorators';

import { decryptOptionalString } from '@/database/encryptionHelpers';

import type SavedForLaterItem from './SavedForLaterItem';

export default class SavedForLaterGroup extends Model {
  static table = 'saved_for_later_groups';

  static associations = {
    saved_for_later_items: { type: 'has_many' as const, foreignKey: 'group_id' },
  };

  @field('name') declare name: string;
  @field('note') noteRaw?: string;
  @field('original_meal_type') declare originalMealType: string;
  @field('original_date') declare originalDate: number;
  @field('timezone') timezone?: string;

  @field('created_at') declare createdAt: number;
  @field('updated_at') declare updatedAt: number;
  @field('deleted_at') deletedAt?: number;

  @children('saved_for_later_items') declare items: Query<SavedForLaterItem>;

  async getNote(): Promise<string> {
    return decryptOptionalString(this.noteRaw);
  }
}
