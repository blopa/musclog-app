import { Model } from '@nozbe/watermelondb';
import { field, writer } from '@nozbe/watermelondb/decorators';

import { decryptNumber, decryptOptionalString } from '../encryptionHelpers';

export interface DecryptedUserMetricFields {
  value: number;
  unit?: string;
  date: number;
}

export type UserMetricType =
  | 'weight'
  | 'body_fat'
  | 'muscle_mass'
  | 'lean_body_mass'
  | 'basal_metabolic_rate'
  | 'total_calories_burned'
  | 'active_calories_burned'
  | 'bmi'
  | 'height'
  | 'chest'
  | 'waist'
  | 'hips'
  | 'arms'
  | 'thighs'
  | 'calves'
  | 'neck'
  | 'shoulders'
  | 'mood'
  | 'ffmi'
  | 'nutrition'
  | 'exercise'
  | 'other';

export default class UserMetric extends Model {
  static table = 'user_metrics';

  @field('type') type!: UserMetricType;
  @field('value') valueRaw!: string;
  @field('unit') unitRaw?: string;
  @field('date') date!: number;
  @field('timezone') timezone!: string;
  @field('created_at') createdAt!: number;
  @field('updated_at') updatedAt!: number;
  @field('deleted_at') deletedAt?: number;

  @writer
  async markAsDeleted(): Promise<void> {
    await this.update((record) => {
      record.deletedAt = Date.now();
      record.updatedAt = Date.now();
    });
  }

  /** Decrypt value and unit. Date is stored plain. Use for display and calculations. */
  async getDecrypted(): Promise<DecryptedUserMetricFields> {
    const [value, unit] = await Promise.all([
      decryptNumber(this.valueRaw),
      decryptOptionalString(this.unitRaw),
    ]);
    return { value, unit: unit || undefined, date: this.date };
  }
}
