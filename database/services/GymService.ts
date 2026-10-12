import { Q, type Query } from '@nozbe/watermelondb';

import { database } from '@/database/database-instance';
import type { EquipmentType } from '@/database/models/Exercise';
import type Gym from '@/database/models/Gym';
import { SettingsService } from '@/database/services/SettingsService';
import {
  type GymPlate,
  type GymSnapshot,
  parseEquipment,
  serializeEquipment,
  serializePlates,
  snapshotFromGymRow,
} from '@/utils/gym';

export interface GymInput {
  name: string;
  barWeightKg: number;
  plates: readonly GymPlate[];
  weightIncrementKg: number;
  equipment: readonly EquipmentType[];
  weightUnit?: 'kg' | 'lbs';
}

const DEFAULT_GYM_NAME = 'Gym';

function normalizedName(name: string): string {
  return name.trim().slice(0, 60) || DEFAULT_GYM_NAME;
}

/**
 * Gym profiles. The "which one am I training in" choice is a setting, not a column, so it stays a
 * primitive in `SettingsState`; every method here that changes both writes the gym first and the
 * setting after, never nesting the two write blocks.
 */
export class GymService {
  /** The live gyms, oldest first. Observe this with `observeWithColumns` — it is sorted. */
  static gymsQuery(): Query<Gym> {
    return database
      .get<Gym>('gyms')
      .query(Q.where('deleted_at', Q.eq(null)), Q.sortBy('created_at', Q.asc));
  }

  static async getGyms(): Promise<GymSnapshot[]> {
    return (await GymService.gymsQuery().fetch()).map(snapshotFromGymRow);
  }

  static async getGymById(id: string): Promise<GymSnapshot | null> {
    try {
      const gym = await database.get<Gym>('gyms').find(id);
      return gym.deletedAt ? null : snapshotFromGymRow(gym);
    } catch {
      return null;
    }
  }

  /** The gym being trained in, or null when none is selected (or the selected one was deleted). */
  static async getActiveGym(): Promise<GymSnapshot | null> {
    const id = await SettingsService.getActiveGymId();
    return id ? await GymService.getGymById(id) : null;
  }

  static async createGym(
    input: GymInput,
    options: { makeActive?: boolean } = {}
  ): Promise<GymSnapshot> {
    const created = await database.write(async () => {
      const now = Date.now();
      return await database.get<Gym>('gyms').create((gym) => {
        applyInput(gym, input);
        gym.createdAt = now;
        gym.updatedAt = now;
      });
    });

    if (options.makeActive) {
      await SettingsService.setActiveGymId(created.id);
    }
    return snapshotFromGymRow(created);
  }

  static async updateGym(id: string, input: GymInput): Promise<void> {
    await database.write(async () => {
      const gym = await database.get<Gym>('gyms').find(id);
      if (gym.deletedAt) {
        throw new Error('Cannot update a deleted gym');
      }
      await gym.update((record) => {
        applyInput(record, input);
        record.updatedAt = Date.now();
      });
    });
  }

  /** Soft-deletes the gym, and stops using it if it was the active one. */
  static async deleteGym(id: string): Promise<void> {
    const gym = await database.get<Gym>('gyms').find(id);
    // markAsDeleted is a @writer and opens its own write; it must not be called inside one.
    await gym.markAsDeleted();

    if ((await SettingsService.getActiveGymId()) === id) {
      await SettingsService.setActiveGymId(null);
    }
  }

  static async setActiveGym(id: string | null): Promise<void> {
    await SettingsService.setActiveGymId(id);
  }

  /** Remove one equipment type from a gym — the "equipment unavailable" follow-up of a swap. */
  static async removeEquipment(gymId: string, equipment: EquipmentType): Promise<void> {
    await database.write(async () => {
      const gym = await database.get<Gym>('gyms').find(gymId);
      const remaining = parseEquipment(gym.equipmentJson).filter((type) => type !== equipment);
      await gym.update((record) => {
        record.equipmentJson = serializeEquipment(remaining);
        record.updatedAt = Date.now();
      });
    });
  }
}

function applyInput(gym: Gym, input: GymInput) {
  gym.name = normalizedName(input.name);
  gym.barWeightKg = Math.max(0, input.barWeightKg);
  gym.platesJson = serializePlates(input.plates);
  gym.weightIncrementKg = input.weightIncrementKg > 0 ? input.weightIncrementKg : 2.5;
  gym.equipmentJson = serializeEquipment(input.equipment);
  gym.weightUnit = input.weightUnit;
}
