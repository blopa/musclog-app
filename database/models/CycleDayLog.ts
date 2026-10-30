import { Model } from '@nozbe/watermelondb';
import { field, writer } from '@nozbe/watermelondb/decorators';

/**
 * Everything personal is in `payload` (encrypted JSON). Read it only through
 * `database/repositories/CycleRepository.ts`, which decrypts it into a typed DTO.
 */
export default class CycleDayLog extends Model {
  static table = 'cycle_day_logs';

  @field('payload') declare payload: string;
  @field('created_at') declare createdAt: number;
  @field('updated_at') declare updatedAt: number;
  @field('deleted_at') declare deletedAt: number | null;

  @writer
  async markAsDeleted(): Promise<void> {
    await this.update((record) => {
      record.deletedAt = Date.now();
      record.updatedAt = Date.now();
    });
  }
}
