import { commitPrepared } from '@/database/commitPrepared';
import { encryptCyclePayload, primeCycleEncryption } from '@/database/cyclePayload';
import { database } from '@/database/database-instance';
import type CyclePeriod from '@/database/models/CyclePeriod';
import { prepareSoftDelete } from '@/database/prepareSoftDelete';
import { CycleRepository, readPeriods, toPeriodDto } from '@/database/repositories/CycleRepository';
import { localDayStartFromUtcMs } from '@/utils/calendarDate';
import { assertValidPeriod, isOpenPeriod, PeriodRuleViolation } from '@/utils/cycle/periodRules';
import type { CyclePeriodDto, PeriodEndKind } from '@/utils/cycle/types';
import { getCurrentTimezone } from '@/utils/timezone';

type PeriodPayload = Omit<CyclePeriodDto, 'id' | 'cycleId'>;

export interface NewPeriod {
  startDate: number;
  endDate?: number | null;
  endKind?: PeriodEndKind;
  note?: string;
}

export interface PeriodPatch {
  startDate?: number;
  endDate?: number | null;
  endKind?: PeriodEndKind;
  note?: string;
  excludedFromStats?: boolean;
  confirmedLongCycle?: boolean;
}

const payloadOf = (dto: CyclePeriodDto): PeriodPayload => ({
  startDate: dto.startDate,
  endDate: dto.endDate,
  endKind: dto.endKind,
  timezone: dto.timezone,
  excludedFromStats: dto.excludedFromStats,
  confirmedLongCycle: dto.confirmedLongCycle,
  note: dto.note,
});

/** An end date and its kind must agree: only `open` and `unknown` may have no end date. */
function normalizeEnd(endDate: number | null | undefined, endKind: PeriodEndKind | undefined) {
  if (endDate == null) {
    return {
      endDate: null,
      endKind: endKind === 'unknown' ? ('unknown' as const) : ('open' as const),
    };
  }

  return {
    endDate,
    endKind: endKind === 'estimated' ? ('estimated' as const) : ('logged' as const),
  };
}

/**
 * Period writes. Every method reads the cycle's periods INSIDE its own writer (so two concurrent
 * edits cannot both pass the overlap check against the same snapshot) and the encryption key is
 * resolved before the writer opens so a keystore read never sits on the write lock.
 */
export class CyclePeriodService {
  /** Create a period; a second request for the same start day returns the existing one. */
  static async create(cycleId: string, rawInput: NewPeriod): Promise<CyclePeriodDto> {
    await primeCycleEncryption();
    const input = { ...rawInput, startDate: localDayStartFromUtcMs(rawInput.startDate) };

    return database.write(async () => {
      const existing = await readPeriods(await CycleRepository.periods(cycleId).fetch());
      const same = existing.find((p) => p.startDate === input.startDate);
      if (same) {
        return same;
      }

      const end = normalizeEnd(input.endDate, input.endKind);
      assertValidPeriod(existing, { startDate: input.startDate, ...end });

      const now = Date.now();
      const payload: PeriodPayload = {
        startDate: input.startDate,
        ...end,
        timezone: getCurrentTimezone(),
        excludedFromStats: false,
        note: input.note ?? '',
      };
      const encrypted = await encryptCyclePayload(payload);
      const record = database.get<CyclePeriod>('cycle_periods').prepareCreate((r) => {
        r.cycleId = cycleId;
        r.payload = encrypted;
        r.createdAt = now;
        r.updatedAt = now;
        r.deletedAt = null;
      });
      await database.batch(record);

      return { ...payload, id: record.id, cycleId };
    });
  }

  /**
   * "My period started": closes whatever period was still open as `unknown` (the user never
   * said when it ended, so no end is invented) and opens a new one, in one batch.
   */
  static async start(cycleId: string, rawStartDate: number): Promise<CyclePeriodDto> {
    await primeCycleEncryption();
    const startDate = localDayStartFromUtcMs(rawStartDate);

    return database.write(async () => {
      const records = await CycleRepository.periods(cycleId).fetch();
      const existing = await readPeriods(records);
      const same = existing.find((p) => p.startDate === startDate);
      if (same) {
        return same;
      }

      const stillOpen = existing.filter((p) => isOpenPeriod(p) && p.startDate < startDate);
      const remaining = existing.filter((p) => !stillOpen.includes(p));
      assertValidPeriod(remaining, { startDate, endDate: null, endKind: 'open' });

      const now = Date.now();
      const closed = await Promise.all(
        stillOpen.map(async (open) => ({
          record: records.find((r) => r.id === open.id)!,
          cipher: await encryptCyclePayload(
            payloadOf({ ...open, endDate: null, endKind: 'unknown' })
          ),
        }))
      );

      const payload: PeriodPayload = {
        startDate,
        endDate: null,
        endKind: 'open',
        timezone: getCurrentTimezone(),
        excludedFromStats: false,
        note: '',
      };
      const createdCipher = await encryptCyclePayload(payload);
      let created!: CyclePeriod;
      await commitPrepared(
        database,
        closed.map(({ record }) => record),
        () => {
          created = database.get<CyclePeriod>('cycle_periods').prepareCreate((r) => {
            r.cycleId = cycleId;
            r.payload = createdCipher;
            r.createdAt = now;
            r.updatedAt = now;
            r.deletedAt = null;
          });
          return [
            ...closed.map(({ record, cipher }) =>
              record.prepareUpdate((r) => {
                r.payload = cipher;
                r.updatedAt = now;
              })
            ),
            created,
          ];
        }
      );
      return { ...payload, id: created.id, cycleId };
    });
  }

  /** "My period ended": ends the open period that started on or before `endDate`. */
  static async end(cycleId: string, endDate: number): Promise<void> {
    await primeCycleEncryption();

    await database.write(async () => {
      const records = await CycleRepository.periods(cycleId).fetch();
      const existing = await readPeriods(records);
      const open = existing
        .filter((p) => isOpenPeriod(p) && p.startDate <= endDate)
        .sort((a, b) => b.startDate - a.startDate)[0];
      if (!open) {
        return;
      }

      const next = { ...open, endDate, endKind: 'logged' as const };
      assertValidPeriod(existing, next, { ignoreIds: [open.id] });
      const encrypted = await encryptCyclePayload(payloadOf(next));
      const record = records.find((r) => r.id === open.id)!;
      await commitPrepared(database, [record], () => [
        record.prepareUpdate((r) => {
          r.payload = encrypted;
          r.updatedAt = Date.now();
        }),
      ]);
    });
  }

  static async update(id: string, patch: PeriodPatch): Promise<CyclePeriodDto> {
    await primeCycleEncryption();

    return database.write(async () => {
      const record = await database.get<CyclePeriod>('cycle_periods').find(id);
      const current = await toPeriodDto(record);
      if (!current || record.deletedAt != null) {
        throw new PeriodRuleViolation('period_end_before_start');
      }

      const siblings = await readPeriods(await CycleRepository.periods(record.cycleId).fetch());
      const startDate =
        patch.startDate != null ? localDayStartFromUtcMs(patch.startDate) : current.startDate;
      const endTouched = patch.endDate !== undefined || patch.endKind !== undefined;
      const end = endTouched
        ? normalizeEnd(patch.endDate ?? null, patch.endKind)
        : { endDate: current.endDate, endKind: current.endKind };
      const next: CyclePeriodDto = {
        ...current,
        startDate,
        ...end,
        note: patch.note ?? current.note,
        excludedFromStats: patch.excludedFromStats ?? current.excludedFromStats,
        confirmedLongCycle: patch.confirmedLongCycle ?? current.confirmedLongCycle,
      };
      assertValidPeriod(siblings, next, { ignoreIds: [id] });

      const encrypted = await encryptCyclePayload(payloadOf(next));
      await commitPrepared(database, [record], () => [
        record.prepareUpdate((r) => {
          r.payload = encrypted;
          r.updatedAt = Date.now();
        }),
      ]);

      return next;
    });
  }

  static async setExcluded(id: string, excluded: boolean): Promise<void> {
    await CyclePeriodService.update(id, { excludedFromStats: excluded });
  }

  static async remove(id: string): Promise<void> {
    await database.write(async () => {
      const record = await database.get<CyclePeriod>('cycle_periods').find(id);
      await commitPrepared(database, [record], () => [prepareSoftDelete(record, Date.now())]);
    });
  }

  /** Undo of `remove`. Refused (overlap) if the user has since logged something in its place. */
  static async restore(id: string): Promise<void> {
    await primeCycleEncryption();

    await database.write(async () => {
      const record = await database.get<CyclePeriod>('cycle_periods').find(id);
      const dto = await toPeriodDto(record);
      if (!dto) {
        return;
      }

      const siblings = await readPeriods(await CycleRepository.periods(record.cycleId).fetch());
      assertValidPeriod(siblings, dto, { ignoreIds: [id] });
      await commitPrepared(database, [record], () => [
        record.prepareUpdate((r) => {
          r.deletedAt = null;
          r.updatedAt = Date.now();
        }),
      ]);
    });
  }
}
