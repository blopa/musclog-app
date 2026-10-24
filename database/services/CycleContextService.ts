import { commitPrepared } from '@/database/commitPrepared';
import { encryptCyclePayload, primeCycleEncryption } from '@/database/cyclePayload';
import { database } from '@/database/database-instance';
import type CycleContext from '@/database/models/CycleContext';
import {
  type ContextPayload,
  CycleRepository,
  readContexts,
} from '@/database/repositories/CycleRepository';
import { localDayStartFromUtcMs } from '@/utils/calendarDate';
import type { ContraceptionMethod, CycleLifeStage } from '@/utils/cycle/types';
import { getCurrentTimezone } from '@/utils/timezone';

export interface ContextInput {
  effectiveFrom: number;
  lifeStage: CycleLifeStage;
  contraception: ContraceptionMethod;
  note?: string;
}

export class CycleContextService {
  /**
   * Records a change of life stage or contraception from a date on. History is kept (each change
   * is a row); a second change for the same day replaces the first rather than stacking.
   */
  static async set(cycleId: string, input: ContextInput): Promise<void> {
    await primeCycleEncryption();
    const effectiveFrom = localDayStartFromUtcMs(input.effectiveFrom);

    await database.write(async () => {
      const records = await CycleRepository.contexts(cycleId).fetch();
      const dtos = await readContexts(records);
      const sameDay = records.find((r) =>
        dtos.some((d) => d.id === r.id && d.effectiveFrom === effectiveFrom)
      );
      const payload: ContextPayload = {
        effectiveFrom,
        timezone: getCurrentTimezone(),
        lifeStage: input.lifeStage,
        contraception: input.contraception,
        note: input.note?.trim() ?? '',
      };
      const encrypted = await encryptCyclePayload(payload);
      const now = Date.now();

      await commitPrepared(database, sameDay ? [sameDay] : [], () => [
        sameDay
          ? sameDay.prepareUpdate((r) => {
              r.payload = encrypted;
              r.updatedAt = now;
            })
          : database.get<CycleContext>('cycle_contexts').prepareCreate((r) => {
              r.cycleId = cycleId;
              r.payload = encrypted;
              r.createdAt = now;
              r.updatedAt = now;
              r.deletedAt = null;
            }),
      ]);
    });
  }

  /** Destroyed, not soft-deleted: there is no undo, and a tombstone would keep the text. */
  static async remove(id: string): Promise<void> {
    await database.write(async () => {
      const record = await database.get<CycleContext>('cycle_contexts').find(id);
      await commitPrepared(database, [record], () => [record.prepareDestroyPermanently()]);
    });
  }
}
