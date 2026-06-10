import { Q } from '@nozbe/watermelondb';

import { database } from '@/database';
import { encryptOptionalString } from '@/database/encryptionHelpers';
import NutritionLog, { MealType } from '@/database/models/NutritionLog';
import SavedForLaterGroup from '@/database/models/SavedForLaterGroup';
import SavedForLaterItem from '@/database/models/SavedForLaterItem';
import { consumedDateTimeOnDay } from '@/utils/calendarDate';
import { getCurrentTimezone } from '@/utils/timezone';
import { widgetEvents } from '@/utils/widgetEvents';

import { REPAIR_DESCRIPTORS, retryAfterRepair } from './DatabaseRepairService';

function triggerWidgetUpdate(): void {
  widgetEvents.emitNutritionWidgetUpdate();
}

export class SavedForLaterService {
  /**
   * Snapshot a list of nutrition logs and save them as a group for later.
   * Then deletes the original nutrition logs.
   */
  static async saveGroupForLater(
    logs: NutritionLog[],
    name: string,
    originalMealType: MealType,
    originalDate: number,
    percentage: number = 100,
    note?: string
  ): Promise<SavedForLaterGroup> {
    return this.saveGroupForLaterInternal(
      logs,
      name,
      originalMealType,
      originalDate,
      percentage,
      note
    );
  }

  private static async saveGroupForLaterInternal(
    logs: NutritionLog[],
    name: string,
    originalMealType: MealType,
    originalDate: number,
    percentage: number = 100,
    note?: string,
    repairAttempted = false
  ): Promise<SavedForLaterGroup> {
    try {
      const encryptedNote = await encryptOptionalString(note);

      return await database.write(async () => {
        const now = Date.now();
        const saveFactor = Math.min(percentage, 100) / 100;
        const remainFactor = 1 - saveFactor;

        // 1. Prepare the group
        const group = database
          .get<SavedForLaterGroup>('saved_for_later_groups')
          .prepareCreate((record) => {
            record.name = name;
            record.noteRaw = encryptedNote || undefined;
            record.originalMealType = originalMealType;
            record.originalDate = originalDate;
            record.timezone = getCurrentTimezone();
            record.createdAt = now;
            record.updatedAt = now;
          });

        // 2. Create items for each log, scaled to the saved percentage
        const itemsPrepared = logs.map((log) =>
          database.get<SavedForLaterItem>('saved_for_later_items').prepareCreate((item) => {
            item.groupId = group.id;
            item.foodId = log.foodId;
            item.amount = log.amount * saveFactor;
            item.portionId = log.portionId || undefined;
            item.loggedFoodNameRaw = log.loggedFoodNameRaw || undefined;
            item.loggedCaloriesRaw = log.loggedCaloriesRaw || '';
            item.loggedProteinRaw = log.loggedProteinRaw || '';
            item.loggedCarbsRaw = log.loggedCarbsRaw || '';
            item.loggedFatRaw = log.loggedFatRaw || '';
            item.loggedFiberRaw = log.loggedFiberRaw || '';
            item.loggedMicrosRaw = log.loggedMicrosRaw || undefined;
            item.loggedMealName = log.loggedMealName || undefined;
            item.originalGroupId = log.groupId || undefined;
            item.createdAt = now;
            item.updatedAt = now;
          })
        );

        // 3. For a full save (100%), delete originals; for partial, reduce their amounts
        const logsToProcess =
          remainFactor <= 0
            ? logs.map((log) =>
                log.prepareUpdate((record) => {
                  record.deletedAt = now;
                  record.updatedAt = now;
                })
              )
            : logs.map((log) =>
                log.prepareUpdate((record) => {
                  record.amount = log.amount * remainFactor;
                  record.updatedAt = now;
                })
              );

        await database.batch(group, ...itemsPrepared, ...logsToProcess);

        triggerWidgetUpdate();
        return group;
      });
    } catch (error) {
      if (!repairAttempted) {
        const repaired = await retryAfterRepair(error, REPAIR_DESCRIPTORS.savedForLater, () =>
          this.saveGroupForLaterInternal(
            logs,
            name,
            originalMealType,
            originalDate,
            percentage,
            note,
            true
          )
        );

        if (repaired) {
          return repaired;
        }
      }
      throw error;
    }
  }

  /**
   * Get all saved for later groups, ordered by creation date (newest first).
   */
  static async getAllGroups(): Promise<SavedForLaterGroup[]> {
    return this.getAllGroupsInternal();
  }

  private static async getAllGroupsInternal(
    repairAttempted = false
  ): Promise<SavedForLaterGroup[]> {
    try {
      return await database
        .get<SavedForLaterGroup>('saved_for_later_groups')
        .query(Q.where('deleted_at', Q.eq(null)), Q.sortBy('created_at', Q.desc))
        .fetch();
    } catch (error) {
      if (!repairAttempted) {
        const repaired = await retryAfterRepair(error, REPAIR_DESCRIPTORS.savedForLater, () =>
          this.getAllGroupsInternal(true)
        );

        if (repaired) {
          return repaired;
        }
      }
      throw error;
    }
  }

  /**
   * Get a group with its items.
   */
  static async getGroupWithItems(groupId: string): Promise<{
    group: SavedForLaterGroup;
    items: SavedForLaterItem[];
  }> {
    return this.getGroupWithItemsInternal(groupId);
  }

  private static async getGroupWithItemsInternal(
    groupId: string,
    repairAttempted = false
  ): Promise<{ group: SavedForLaterGroup; items: SavedForLaterItem[] }> {
    try {
      const group = await database.get<SavedForLaterGroup>('saved_for_later_groups').find(groupId);
      const items = await database
        .get<SavedForLaterItem>('saved_for_later_items')
        .query(Q.where('group_id', groupId), Q.where('deleted_at', Q.eq(null)))
        .fetch();
      return { group, items };
    } catch (error) {
      if (!repairAttempted) {
        const repaired = await retryAfterRepair(error, REPAIR_DESCRIPTORS.savedForLater, () =>
          this.getGroupWithItemsInternal(groupId, true)
        );

        if (repaired) {
          return repaired;
        }
      }
      throw error;
    }
  }

  /**
   * Checks if there are any saved meals.
   */
  static async hasAnyGroups(): Promise<boolean> {
    const groups = await database
      .get<SavedForLaterGroup>('saved_for_later_groups')
      .query(Q.where('deleted_at', Q.eq(null)))
      .fetch();
    return groups.length > 0;
  }

  /**
   * Restore a saved group to the nutrition logs for a target date and meal type.
   * Then deletes the saved group and its items.
   */
  static async trackGroup(
    groupId: string,
    targetDate: Date,
    targetMealType: MealType
  ): Promise<void> {
    const consumed = consumedDateTimeOnDay(targetDate);
    const { group, items } = await this.getGroupWithItems(groupId);

    await database.write(async () => {
      const now = Date.now();

      // 1. Recreate nutrition logs
      const logsPrepared = items.map((item) =>
        database.get<NutritionLog>('nutrition_logs').prepareCreate((log) => {
          log.foodId = item.foodId!;
          log.date = consumed.timestamp;
          log.timezone = consumed.timezone;
          log.type = targetMealType;
          log.amount = item.amount;
          log.portionId = item.portionId;
          log.loggedFoodNameRaw = item.loggedFoodNameRaw;
          log.loggedCaloriesRaw = item.loggedCaloriesRaw;
          log.loggedProteinRaw = item.loggedProteinRaw;
          log.loggedCarbsRaw = item.loggedCarbsRaw;
          log.loggedFatRaw = item.loggedFatRaw;
          log.loggedFiberRaw = item.loggedFiberRaw;
          log.loggedMicrosRaw = item.loggedMicrosRaw;
          log.groupId = item.originalGroupId || undefined;
          log.loggedMealName = item.loggedMealName || undefined;
          log.createdAt = now;
          log.updatedAt = now;
        })
      );

      // 2. Delete the saved group and items
      const groupToDelete = group.prepareUpdate((record) => {
        record.deletedAt = now;
        record.updatedAt = now;
      });

      const itemsToDelete = items.map((item) =>
        item.prepareUpdate((record) => {
          record.deletedAt = now;
          record.updatedAt = now;
        })
      );

      await database.batch(...logsPrepared, groupToDelete, ...itemsToDelete);
    });

    triggerWidgetUpdate();
  }

  /**
   * Delete a saved group and its items.
   */
  static async deleteGroup(groupId: string): Promise<void> {
    const { group, items } = await this.getGroupWithItems(groupId);

    await database.write(async () => {
      const now = Date.now();

      const groupToDelete = group.prepareUpdate((record) => {
        record.deletedAt = now;
        record.updatedAt = now;
      });

      const itemsToDelete = items.map((item) =>
        item.prepareUpdate((record) => {
          record.deletedAt = now;
          record.updatedAt = now;
        })
      );

      await database.batch(groupToDelete, ...itemsToDelete);
    });
  }
}
