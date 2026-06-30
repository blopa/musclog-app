import { Model } from '@nozbe/watermelondb';
import { field, writer } from '@nozbe/watermelondb/decorators';

import { MS_PER_SOLAR_DAY } from '@/utils/calendarDate';

export interface PeriodLogCreate {
  menstrualCycleId: string;
  startDate: number;
  endDate?: number | null;
  notes?: string;
  timezone?: string;
}

export interface PeriodLogUpdate {
  endDate?: number | null;
  notes?: string;
}

export default class PeriodLog extends Model {
  static table = 'period_logs';

  @field('menstrual_cycle_id') declare menstrualCycleId: string;
  @field('start_date') declare startDate: number;
  @field('end_date') declare endDate: number | null;
  @field('notes') declare notes: string | null;
  @field('timezone') declare timezone: string | null;
  @field('created_at') declare createdAt: number;
  @field('updated_at') declare updatedAt: number;
  @field('deleted_at') declare deletedAt: number | null;

  get isActive(): boolean {
    return this.endDate == null && this.deletedAt == null;
  }

  getDurationDays(): number | null {
    if (this.endDate == null) {
      return null;
    }

    return Math.max(1, Math.round((this.endDate - this.startDate) / MS_PER_SOLAR_DAY) + 1);
  }

  @writer
  async endPeriod(endDate: number): Promise<void> {
    await this.update((log) => {
      log.endDate = endDate;
      log.updatedAt = Date.now();
    });
  }

  @writer
  async updateLog(data: PeriodLogUpdate): Promise<void> {
    await this.update((log) => {
      if (data.endDate !== undefined) {
        log.endDate = data.endDate ?? null;
      }

      if (data.notes !== undefined) {
        log.notes = data.notes ?? null;
      }

      log.updatedAt = Date.now();
    });
  }

  @writer
  async markAsDeleted(): Promise<void> {
    await this.update((log) => {
      log.deletedAt = Date.now();
      log.updatedAt = Date.now();
    });
  }
}
