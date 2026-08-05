import { Model } from '@nozbe/watermelondb';
import { field, writer } from '@nozbe/watermelondb/decorators';

export default class Note extends Model {
  static table = 'notes';

  @field('title') title?: string;
  @field('body') declare body: string;
  @field('created_at') declare createdAt: number;
  @field('updated_at') declare updatedAt: number;
  @field('deleted_at') deletedAt?: number;

  @writer
  async updateNote(data: { title?: null | string; body?: string }): Promise<void> {
    // The deleted check lives inside the writer so it shares the write transaction with the
    // update it guards — reading it outside would leave a TOCTOU window (see AGENTS.md).
    if (this.deletedAt != null) {
      throw new Error('Cannot update a deleted note');
    }

    await this.update((record) => {
      if (data.title !== undefined) {
        record.title = data.title?.trim() || undefined;
      }

      if (data.body !== undefined) {
        record.body = data.body.trim();
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
