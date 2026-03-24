import { Model } from '@nozbe/watermelondb';
import { field, writer } from '@nozbe/watermelondb/decorators';

export default class Supplement extends Model {
  static table = 'supplements';

  @field('name') name!: string;
  @field('dosage') dosage?: string;
  @field('has_reminder') hasReminder!: boolean;
  @field('created_at') createdAt!: number;
  @field('updated_at') updatedAt!: number;
  @field('deleted_at') deletedAt?: number;

  @writer
  async updateSupplement(data: { name?: string; dosage?: string; hasReminder?: boolean }): Promise<void> {
    await this.update((record) => {
      if (data.name !== undefined) {
        record.name = data.name;
      }
      if (data.dosage !== undefined) {
        record.dosage = data.dosage;
      }
      if (data.hasReminder !== undefined) {
        record.hasReminder = data.hasReminder;
      }
      record.updatedAt = Date.now();
    });
  }

  @writer
  async markAsDeleted(): Promise<void> {
    await this.update((record) => {
      record.deletedAt = Date.now();
      record.updatedAt = Date.now();
    });
  }
}
