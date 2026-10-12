import { Model } from '@nozbe/watermelondb';
import { field, writer } from '@nozbe/watermelondb/decorators';

/**
 * A named gym profile. The two list columns are raw JSON: read a gym through `snapshotFromGymRow`
 * (utils/gym.ts), which parses and validates them in one place, rather than parsing them here.
 */
export default class Gym extends Model {
  static table = 'gyms';

  @field('name') declare name: string;
  @field('bar_weight_kg') declare barWeightKg: number;
  @field('plates_json') declare platesJson: string;
  @field('weight_increment_kg') declare weightIncrementKg: number;
  @field('equipment_json') declare equipmentJson: string;
  @field('weight_unit') weightUnit?: string;
  @field('created_at') declare createdAt: number;
  @field('updated_at') declare updatedAt: number;
  @field('deleted_at') deletedAt?: number;

  @writer
  async markAsDeleted(): Promise<void> {
    const now = Date.now();
    await this.update((record) => {
      record.deletedAt = now;
      record.updatedAt = now;
    });
  }
}
