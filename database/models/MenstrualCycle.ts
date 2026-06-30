import { Model } from '@nozbe/watermelondb';
import { field, writer } from '@nozbe/watermelondb/decorators';

export type BirthControlType = 'pill' | 'iud' | 'implant' | 'patch' | 'ring' | 'shot' | 'other';
export type SyncGoal = 'performance' | 'symptoms' | 'energy';
export type LifeStage = 'regular' | 'pcos' | 'perimenopause' | 'postpartum' | 'post_pill';

export interface MenstrualCycleUpdate {
  avgCycleLength?: number;
  avgPeriodDuration?: number;
  useHormonalBirthControl?: boolean;
  birthControlType?: BirthControlType | null;
  // lastPeriodStartDate is maintained exclusively by PeriodLogRepository as a
  // denormalized cache. Never set it directly through updateCycle().
  syncGoal?: SyncGoal | null;
  lifeStage?: LifeStage | null;
  isActive?: boolean;
}

export default class MenstrualCycle extends Model {
  static table = 'menstrual_cycles';

  @field('avg_cycle_length') declare avgCycleLength: number;
  @field('avg_period_duration') declare avgPeriodDuration: number;
  @field('use_hormonal_birth_control') declare useHormonalBirthControl: boolean;
  @field('birth_control_type') declare birthControlType: BirthControlType | null;
  @field('last_period_start_date') declare lastPeriodStartDate: number;
  @field('timezone') declare timezone: string | null;
  @field('sync_goal') declare syncGoal: SyncGoal | null;
  @field('life_stage') declare lifeStage: LifeStage | null;
  @field('is_active') declare isActive: boolean;
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
        cycle.birthControlType = data.birthControlType ?? null;
      }

      if (data.syncGoal !== undefined) {
        cycle.syncGoal = data.syncGoal ?? null;
      }

      if (data.lifeStage !== undefined) {
        cycle.lifeStage = data.lifeStage ?? null;
      }

      if (data.isActive !== undefined) {
        cycle.isActive = data.isActive;
      }

      cycle.updatedAt = Date.now();
    });
  }
}
