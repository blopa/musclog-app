import { Q } from '@nozbe/watermelondb';

import { database } from '@/database';
import NutritionLog, { MealType } from '@/database/models/NutritionLog';
import SavedForLaterGroup from '@/database/models/SavedForLaterGroup';
import SavedForLaterItem from '@/database/models/SavedForLaterItem';
import { localDayStartMs } from '@/utils/calendarDate';
import { widgetEvents } from '@/utils/widgetEvents';

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
    originalDate: number
  ): Promise<SavedForLaterGroup> {
    return await database.write(async () => {
      const now = Date.now();

      // 1. Create the group
      const group = await database.get<SavedForLaterGroup>('saved_for_later_groups').create((record) => {
        record.name = name;
        record.originalMealType = originalMealType;
        record.originalDate = originalDate;
        record.createdAt = now;
        record.updatedAt = now;
      });

      // 2. Create items for each log
      const itemsPrepared = logs.map((log) =>
        database.get<SavedForLaterItem>('saved_for_later_items').prepareCreate((item) => {
          item.groupId = group.id;
          item.foodId = log.foodId;
          item.amount = log.amount;
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

      // 3. Prepare deletion of original logs
      const logsToDelete = logs.map((log) =>
        log.prepareUpdate((record) => {
          record.deletedAt = now;
          record.updatedAt = now;
        })
      );

      await database.batch(group, ...itemsPrepared, ...logsToDelete);

      triggerWidgetUpdate();
      return group;
    });
  }

  /**
   * Get all saved for later groups, ordered by creation date (newest first).
   */
  static async getAllGroups(): Promise<SavedForLaterGroup[]> {
    return await database
      .get<SavedForLaterGroup>('saved_for_later_groups')
      .query(Q.where('deleted_at', Q.eq(null)), Q.sortBy('created_at', Q.desc))
      .fetch();
  }

  /**
   * Get a group with its items.
   */
  static async getGroupWithItems(groupId: string): Promise<{
    group: SavedForLaterGroup;
    items: SavedForLaterItem[];
  }> {
    const group = await database.get<SavedForLaterGroup>('saved_for_later_groups').find(groupId);
    const items = await database
      .get<SavedForLaterItem>('saved_for_later_items')
      .query(Q.where('group_id', groupId), Q.where('deleted_at', Q.eq(null)))
      .fetch();

    return { group, items };
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
    const dateTimestamp = localDayStartMs(targetDate);
    const { group, items } = await this.getGroupWithItems(groupId);

    await database.write(async () => {
      const now = Date.now();

      // 1. Recreate nutrition logs
      const logsPrepared = items.map((item) =>
        database.get<NutritionLog>('nutrition_logs').prepareCreate((log) => {
          log.foodId = item.foodId!;
          log.date = dateTimestamp;
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
