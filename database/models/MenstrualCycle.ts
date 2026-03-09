import { Model } from '@nozbe/watermelondb';
import { field, writer } from '@nozbe/watermelondb/decorators';

export type BirthControlType = 'pill' | 'iud' | 'implant' | 'patch' | 'ring' | 'shot' | 'other';
export type SyncGoal = 'performance' | 'symptoms' | 'energy';

export interface MenstrualCycleUpdate {
  avgCycleLength?: number;
  avgPeriodDuration?: number;
  useHormonalBirthControl?: boolean;
  birthControlType?: BirthControlType | null;
  lastPeriodStartDate?: number;
  syncGoal?: SyncGoal | null;
  isActive?: boolean;
}

export default class MenstrualCycle extends Model {
  static table = 'menstrual_cycles';

  @field('avg_cycle_length') avgCycleLength!: number;
  @field('avg_period_duration') avgPeriodDuration!: number;
  @field('use_hormonal_birth_control') useHormonalBirthControl!: boolean;
  @field('birth_control_type') birthControlType?: BirthControlType;
  @field('last_period_start_date') lastPeriodStartDate!: number;
  @field('sync_goal') syncGoal?: SyncGoal;
  @field('is_active') isActive!: boolean;
  @field('created_at') createdAt!: number;
  @field('updated_at') updatedAt!: number;
  @field('deleted_at') deletedAt?: number;

  @writer
  async markAsDeleted(): Promise<void> {
    await this.update((record) => {
      record.deletedAt = Date.now();
      record.updatedAt = Date.now();
    });
  }

  @writer
  async updateCycle(data: MenstrualCycleUpdate): Promise<void> {
    await this.update((cycle) => {
      if (data.avgCycleLength !== undefined) {
        cycle.avgCycleLength = data.avgCycleLength;
      }

      if (data.avgPeriodDuration !== undefined) {
        cycle.avgPeriodDuration = data.avgPeriodDuration;
      }

      if (data.useHormonalBirthControl !== undefined) {
        cycle.useHormonalBirthControl = data.useHormonalBirthControl;
      }

      if (data.birthControlType !== undefined) {
        cycle.birthControlType = data.birthControlType ?? undefined;
      }

      if (data.lastPeriodStartDate !== undefined) {
        cycle.lastPeriodStartDate = data.lastPeriodStartDate;
      }

      if (data.syncGoal !== undefined) {
        cycle.syncGoal = data.syncGoal ?? undefined;
      }

      if (data.isActive !== undefined) {
        cycle.isActive = data.isActive;
      }
      cycle.updatedAt = Date.now();
    });
  }

  /**
   * Calculate predicted next period start date
   */
  getNextPeriodDate(): Date {
    const lastPeriod = new Date(this.lastPeriodStartDate);
    const cycleLengthMs = this.avgCycleLength * 24 * 60 * 60 * 1000;
    return new Date(lastPeriod.getTime() + cycleLengthMs);
  }

  /**
   * Calculate predicted fertile window (typically 5 days before ovulation)
   */
  getFertileWindow(): { start: Date; end: Date } {
    const cycleLengthMs = this.avgCycleLength * 24 * 60 * 60 * 1000;
    const ovulationDay = new Date(this.lastPeriodStartDate + cycleLengthMs * 0.5); // Mid-cycle
    const fertileStart = new Date(ovulationDay.getTime() - 5 * 24 * 60 * 60 * 1000); // 5 days before ovulation
    const fertileEnd = new Date(ovulationDay.getTime() + 24 * 60 * 60 * 1000); // 1 day after ovulation

    return { start: fertileStart, end: fertileEnd };
  }

  /**
   * Check if user is currently in their period
   */
  isCurrentlyInPeriod(): boolean {
    const now = Date.now();
    const periodDurationMs = this.avgPeriodDuration * 24 * 60 * 60 * 1000;
    const periodEnd = this.lastPeriodStartDate + periodDurationMs;
    return now >= this.lastPeriodStartDate && now <= periodEnd;
  }

  /**
   * Check if user is currently in fertile window
   */
  isCurrentlyInFertileWindow(): boolean {
    const now = Date.now();
    const fertileWindow = this.getFertileWindow();
    return now >= fertileWindow.start.getTime() && now <= fertileWindow.end.getTime();
  }
}
