import { Q } from '@nozbe/watermelondb';
import { database } from '../index';
import Supplement from '../models/Supplement';

export class SupplementService {
  /**
   * Get all active supplements.
   */
  static async getActiveSupplements(): Promise<Supplement[]> {
    return await database
      .get<Supplement>('supplements')
      .query(Q.where('deleted_at', Q.eq(null)), Q.sortBy('created_at', Q.asc))
      .fetch();
  }

  /**
   * Get a supplement by id.
   */
  static async getSupplementById(id: string): Promise<Supplement | null> {
    try {
      const supplement = await database.get<Supplement>('supplements').find(id);
      return supplement.deletedAt != null ? null : supplement;
    } catch {
      return null;
    }
  }

  /**
   * Create a new supplement.
   */
  static async createSupplement(data: {
    name: string;
    dosage?: string;
    hasReminder: boolean;
  }): Promise<Supplement> {
    return await database.write(async () => {
      return await database.get<Supplement>('supplements').create((record) => {
        record.name = data.name;
        record.dosage = data.dosage;
        record.hasReminder = data.hasReminder;
        record.createdAt = Date.now();
        record.updatedAt = Date.now();
      });
    });
  }

  /**
   * Update a supplement.
   */
  static async updateSupplement(
    id: string,
    data: { name?: string; dosage?: string; hasReminder?: boolean }
  ): Promise<Supplement> {
    const supplement = await database.get<Supplement>('supplements').find(id);
    await supplement.updateSupplement(data);
    return supplement;
  }

  /**
   * Delete a supplement (soft delete).
   */
  static async deleteSupplement(id: string): Promise<void> {
    const supplement = await database.get<Supplement>('supplements').find(id);
    await supplement.markAsDeleted();
  }
}
