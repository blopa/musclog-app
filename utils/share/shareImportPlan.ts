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

function sanitizeRow(row: ShareRow): ShareRow | undefined {
  if (row.deleted_at != null || row._status === 'deleted') {
    return undefined;
  }

  return Object.fromEntries(
    Object.entries(row).filter(
      ([key]) => !['_changed', '_decrypted', '_status', 'deleted_at'].includes(key)
    )
  );
}

function parentForeignKey(spec: ShareKindSpec, table: string): string | undefined {
  return Object.keys(spec.foreignKeys[table] ?? {})[0];
}

function isReferenced(
  spec: ShareKindSpec,
  rows: WorkingRow[],
  targetTable: string,
  sourceId: string
): boolean {
  return rows.some((candidate) =>
    Object.entries(spec.foreignKeys[candidate.table] ?? {}).some(([column, target]) => {
      if (candidate.row[column] !== sourceId) {
        return false;
      }
      return resolveTargetTable(target, candidate.row) === targetTable;
    })
  );
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
      const sanitized = sanitizeRow(input);
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

  for (const table of spec.dropWhenParentReused) {
    const parentColumn = parentForeignKey(spec, table);
    if (!parentColumn) {
      continue;
    }
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

  let pruned = true;
  while (pruned) {
    pruned = false;
    rows = rows.filter((row) => {
      if (
        spec.pruneUnreferenced.includes(row.table) &&
        !row.reused &&
        !isReferenced(spec, rows, row.table, row.sourceId)
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
