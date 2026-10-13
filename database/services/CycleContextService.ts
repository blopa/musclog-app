import { database } from '@/database/database-instance';
import { encryptCyclePayload, primeCycleEncryption } from '@/database/cyclePayload';
import type CycleContext from '@/database/models/CycleContext';
import { prepareSoftDelete } from '@/database/prepareSoftDelete';
import { CycleRepository, readContexts } from '@/database/repositories/CycleRepository';
import { localDayStartFromUtcMs } from '@/utils/calendarDate';
import type { ContraceptionMethod, CycleContextDto, CycleLifeStage } from '@/utils/cycle/types';
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
      const payload: Omit<CycleContextDto, 'id' | 'cycleId'> = {
        effectiveFrom,
        timezone: getCurrentTimezone(),
        lifeStage: input.lifeStage,
        contraception: input.contraception,
        note: input.note?.trim() ?? '',
      };
      const encrypted = await encryptCyclePayload(payload);
      const now = Date.now();

      if (sameDay) {
        await sameDay.update((r) => {
          r.payload = encrypted;
          r.updatedAt = now;
        });

        return;
      }

      await database.batch(
        database.get<CycleContext>('cycle_contexts').prepareCreate((r) => {
          r.cycleId = cycleId;
          r.payload = encrypted;
          r.createdAt = now;
          r.updatedAt = now;
          r.deletedAt = null;
        })
      );
    });
  }

  static async remove(id: string): Promise<void> {
    await database.write(async () => {
      const record = await database.get<CycleContext>('cycle_contexts').find(id);
      await database.batch(prepareSoftDelete(record, Date.now()));
    });
  }
}
