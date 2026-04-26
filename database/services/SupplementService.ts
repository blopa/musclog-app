import { Q } from '@nozbe/watermelondb';

import { database } from '@/database/database-instance';
import Supplement from '@/database/models/Supplement';

export class SupplementService {
  static async getActiveSupplements(): Promise<Supplement[]> {
    return database
      .get<Supplement>('supplements')
      .query(Q.where('deleted_at', Q.eq(null)), Q.sortBy('created_at', Q.asc))
      .fetch();
  }

  static async createSupplement(data: { name: string; hasReminder: boolean }): Promise<Supplement> {
    const now = Date.now();

    return database.write(async () =>
      database.get<Supplement>('supplements').create((record) => {
        record.name = data.name.trim();
        record.hasReminder = data.hasReminder;
        record.createdAt = now;
        record.updatedAt = now;
      })
    );
  }

  static async updateSupplement(
    id: string,
    data: { name?: string; hasReminder?: boolean }
  ): Promise<Supplement> {
    const supplement = await database.get<Supplement>('supplements').find(id);

    if (supplement.deletedAt != null) {
      throw new Error('Cannot update deleted supplement');
    }

    await supplement.updateSupplement(data);
    return supplement;
  }

  static async deleteSupplement(id: string): Promise<void> {
    const supplement = await database.get<Supplement>('supplements').find(id);
    await supplement.markAsDeleted();
  }
}
