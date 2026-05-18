import { clearActiveWorkoutLogId, getActiveWorkoutLogId } from '@/utils/activeWorkoutStorage';

import {
  type DatabaseRepairResult,
  DatabaseRepairService,
  REPAIR_DESCRIPTORS,
} from './DatabaseRepairService';

export type WorkoutDatabaseRepairResult = DatabaseRepairResult & {
  /** Alias for deletedRootIds — kept for backward compatibility. */
  deletedWorkoutIds: string[];
};

export class WorkoutDatabaseRecoveryService {
  static async repairIfNeeded(error: unknown): Promise<WorkoutDatabaseRepairResult> {
    const result = await DatabaseRepairService.repairIfNeeded(
      error,
      REPAIR_DESCRIPTORS.workoutLogs
    );

    // Clear AsyncStorage if the active workout was among the deleted records.
    if (result.deletedRootIds.length > 0) {
      const activeId = await getActiveWorkoutLogId();
      if (activeId && result.deletedRootIds.includes(activeId)) {
        await clearActiveWorkoutLogId();
      }
    }

    return { ...result, deletedWorkoutIds: result.deletedRootIds };
  }
}
