import { Model } from '@nozbe/watermelondb';
import { field, relation, writer } from '@nozbe/watermelondb/decorators';

export default class UserMetricsNote extends Model {
  static table = 'user_metrics_notes';

  @field('user_metric_id') userMetricId!: string;
  @field('note') note!: string;
  @field('created_at') createdAt!: number;
  @field('updated_at') updatedAt!: number;
  @field('deleted_at') deletedAt?: number;

  // Relation to the parent UserMetric
  @relation('user_metrics', 'user_metric_id') userMetric!: any;

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
