import { randomId } from '@nozbe/watermelondb/utils/common';

import { SHARE_ASSET_REF_PREFIX, type ShareRow } from '@/utils/share/shareEnvelope';
import { type ShareForeignKeyTarget, type ShareKindSpec } from '@/utils/share/shareKinds';

export type ShareImportResolutions = Record<string, Record<string, string>>;

export interface PlannedShareRow {
  table: string;
  sourceId: string;
  localId: string;
  row: ShareRow;
}

export interface ReusedShareRow {
  table: string;
  sourceId: string;
  localId: string;
}

export interface ShareImportPlan {
  creates: PlannedShareRow[];
  reused: ReusedShareRow[];
  idMap: Record<string, Record<string, string>>;
  rootId: string;
}

export interface PlanShareImportOptions {
  resolutions?: ShareImportResolutions;
  assets?: Record<string, string | undefined>;
  nowMs: number;
  generateId?: () => string;
  rootId?: string;
}

interface WorkingRow {
  table: string;
  sourceId: string;
  localId: string;
  reused: boolean;
  row: ShareRow;
}

function isPresentForeignKey(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function resolveTargetTable(target: ShareForeignKeyTarget, row: ShareRow): string | undefined {
  if (typeof target === 'string') {
    return target;
  }
  const type = row[target.polymorphic.typeColumn];
  return typeof type === 'string' ? target.polymorphic.typeToTable[type] : undefined;
}

/**
 * Reduces an incoming row to `id` plus the columns its table declares in `ShareKindSpec.columns`.
 *
 * An allowlist rather than a denylist of control fields: the row comes from another phone over a
 * camera, and everything that survives here is eventually handed to `assignRawColumns`, which
 * assigns each key onto a WatermelonDB model instance. A denylist would have to anticipate every
 * property worth shadowing (`collection`, `markAsDeleted`, `_raw`, …); an allowlist only has to
 * know what the table legitimately holds.
 */
function sanitizeRow(row: ShareRow, allowedColumns: readonly string[]): ShareRow | undefined {
  if (row.deleted_at != null || row._status === 'deleted') {
    return undefined;
  }

  const allowed = new Set<string>([...allowedColumns, 'id']);
  return Object.fromEntries(Object.entries(row).filter(([key]) => allowed.has(key)));
}

/**
 * The composite key identifying one row across tables. A single helper on purpose: the referenced
 * set and the lookup that consults it must agree exactly, and two separately-written template
 * literals are one typo away from silently never matching (which prunes rows that ARE referenced
 * and then fails the whole import on the dangling foreign key).
 */
function referenceKey(table: string, sourceId: string): string {
  return `${table}::${sourceId}`;
}

/**
 * Every row that some other row points at, as {@link referenceKey} strings.
 *
 * Built once per prune pass instead of re-scanning every row's foreign keys for every candidate:
 * the pruning loop repeats until it reaches a fixpoint, so the naive form was a scan inside a
 * filter inside a loop against a 2000-row ceiling.
 */
function referencedKeys(spec: ShareKindSpec, rows: WorkingRow[]): Set<string> {
  const referenced = new Set<string>();
  for (const candidate of rows) {
    for (const [column, target] of Object.entries(spec.foreignKeys[candidate.table] ?? {})) {
      const value = candidate.row[column];
      if (!isPresentForeignKey(value)) {
        continue;
      }
      const targetTable = resolveTargetTable(target, candidate.row);
      if (targetTable) {
        referenced.add(referenceKey(targetTable, value));
      }
    }
  }
  return referenced;
}

export function planShareImport(
  spec: ShareKindSpec,
  records: Record<string, ShareRow[]>,
  options: PlanShareImportOptions
): ShareImportPlan {
  const { assets = {}, generateId = randomId, nowMs, resolutions = {} } = options;
  const idMap: Record<string, Record<string, string>> = {};
  const usedLocalIds = new Set<string>();
  for (const tableResolutions of Object.values(resolutions)) {
    for (const localId of Object.values(tableResolutions)) {
      usedLocalIds.add(localId);
    }
  }
  let rows: WorkingRow[] = [];

  for (const table of spec.tables) {
    idMap[table] = {};
    for (const input of records[table] ?? []) {
      const sanitized = sanitizeRow(input, spec.columns[table] ?? []);
      if (!sanitized) {
        continue;
      }
      const sourceId = sanitized.id;
      if (typeof sourceId !== 'string' || !sourceId) {
        throw new Error(`Share row in ${table} has no id`);
      }

      const resolvedId = resolutions[table]?.[sourceId];
      let localId = resolvedId;
      if (!localId) {
        do {
          localId = generateId();
        } while (!localId || usedLocalIds.has(localId));
      }
      usedLocalIds.add(localId);
      idMap[table][sourceId] = localId;
      rows.push({
        localId,
        reused: Boolean(resolvedId),
        row: sanitized,
        sourceId,
        table,
      });
    }
  }

  for (const [table, parentColumn] of Object.entries(spec.dropWhenParentReused)) {
    const target = spec.foreignKeys[table]?.[parentColumn];
    rows = rows.filter((row) => {
      if (row.table !== table || !target || !isPresentForeignKey(row.row[parentColumn])) {
        return true;
      }

      const targetTable = resolveTargetTable(target, row.row);
      const targetSourceId = String(row.row[parentColumn]);
      return !rows.some(
        (candidate) =>
          candidate.table === targetTable &&
          candidate.sourceId === targetSourceId &&
          candidate.reused
      );
    });
  }

  // Dropping an unreferenced row can orphan the row IT pointed at, so this repeats to a fixpoint.
  let pruned = true;
  while (pruned) {
    pruned = false;
    const referenced = referencedKeys(spec, rows);
    rows = rows.filter((row) => {
      if (
        spec.pruneUnreferenced.includes(row.table) &&
        !row.reused &&
        !referenced.has(referenceKey(row.table, row.sourceId))
      ) {
        delete idMap[row.table][row.sourceId];
        pruned = true;
        return false;
      }
      return true;
    });
  }

  const reused: ReusedShareRow[] = [];
  const creates: PlannedShareRow[] = [];
  for (const working of rows) {
    if (working.reused) {
      reused.push({
        localId: working.localId,
        sourceId: working.sourceId,
        table: working.table,
      });
      continue;
    }

    const rewritten: ShareRow = { ...working.row, id: working.localId };
    for (const [column, target] of Object.entries(spec.foreignKeys[working.table] ?? {})) {
      const sourceTargetId = rewritten[column];
      if (!isPresentForeignKey(sourceTargetId)) {
        continue;
      }
      const targetTable = resolveTargetTable(target, rewritten);
      const localTargetId = targetTable ? idMap[targetTable]?.[sourceTargetId] : undefined;
      if (!targetTable || !localTargetId) {
        throw new Error(
          `Share row ${working.table}:${working.sourceId} references missing ${column}:${sourceTargetId}`
        );
      }
      rewritten[column] = localTargetId;
    }

    for (const column of spec.assetColumns[working.table] ?? []) {
      const value = rewritten[column];
      if (typeof value !== 'string' || !value.startsWith(SHARE_ASSET_REF_PREFIX)) {
        continue;
      }
      const assetId = value.slice(SHARE_ASSET_REF_PREFIX.length);
      const localUri = assets[assetId];
      if (localUri) {
        rewritten[column] = localUri;
      } else {
        delete rewritten[column];
      }
    }

    Object.assign(rewritten, spec.forcedColumns[working.table] ?? {});
    rewritten.created_at = nowMs;
    rewritten.updated_at = nowMs;
    creates.push({
      localId: working.localId,
      row: rewritten,
      sourceId: working.sourceId,
      table: working.table,
    });
  }

  const rootSourceId = options.rootId ?? records[spec.rootTable]?.[0]?.id;
  const rootId =
    typeof rootSourceId === 'string' ? idMap[spec.rootTable]?.[rootSourceId] : undefined;
  if (!rootId) {
    throw new Error('Share root row is missing from the import plan');
  }

  return { creates, idMap, reused, rootId };
}
