import { Model } from '@nozbe/watermelondb';
import { field, writer } from '@nozbe/watermelondb/decorators';

export interface FastedDayCreate {
  /** Consumed-datetime style instant on the fasted day (see consumedDateTimeOnDay). */
  date: number;
  timezone?: string;
}

export default class FastedDay extends Model {
  static table = 'fasted_days';

  @field('date') declare date: number;
  @field('timezone') declare timezone: string | null;
  @field('created_at') declare createdAt: number;
  @field('updated_at') declare updatedAt: number;
  @field('deleted_at') declare deletedAt: number | null;

  @writer
  async restore(date: number, timezone: string | null): Promise<void> {
    await this.update((row) => {
      row.date = date;
      row.timezone = timezone;
      row.deletedAt = null;
      row.updatedAt = Date.now();
    });
  }
}
