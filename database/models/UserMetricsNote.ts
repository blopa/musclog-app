import { Model } from '@nozbe/watermelondb';
import { field, relation, writer } from '@nozbe/watermelondb/decorators';

export default class UserMetricsNote extends Model {
  static table = 'user_metrics_notes';

  @field('user_metric_id') declare userMetricId: string;
  @field('note') declare note: string;
  @field('created_at') declare createdAt: number;
  @field('updated_at') declare updatedAt: number;
  @field('deleted_at') deletedAt?: number;

  // Relation to the parent UserMetric
  @relation('user_metrics', 'user_metric_id') declare userMetric: any;

  @writer
  async markAsDeleted(): Promise<void> {
    await this.update((record) => {
      record.deletedAt = Date.now();
      record.updatedAt = Date.now();
    });
  }

  @writer
  async updateNote(newNote: string): Promise<void> {
    await this.update((record) => {
      record.note = newNote;
      record.updatedAt = Date.now();
    });
  }
}
