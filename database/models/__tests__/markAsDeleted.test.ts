import fs from 'node:fs';
import path from 'node:path';

import { schema } from '@/database/schema';

/**
 * Every table in this app soft-deletes by stamping `deleted_at`, and every model is expected
 * to expose that as `markAsDeleted()`. WatermelonDB ships a base `Model.markAsDeleted` that
 * does something entirely different — it tombstones the record for Sync (`_status = 'deleted'`)
 * and never touches `deleted_at` — and it is **not** a `@writer`, it merely asserts it is
 * running inside one. So a model that forgets the override inherits three failure modes, none
 * of which is a type error:
 *
 *  - called through `writer.callWriter(...)` (the only correct way from inside an open write
 *    block) it throws `callReader/callWriter call must call a reader/writer synchronously`,
 *    because the callback never re-enters the work queue. Shipped in 2.10.5 for `WorkoutLog`:
 *    every workout-log delete failed *after* the log had already been tombstoned, orphaning
 *    its exercises and sets;
 *  - called bare from inside a write block it "works" but writes the wrong thing — a row
 *    hidden from WatermelonDB queries while `deleted_at` stays null, so raw SQL reads and the
 *    DB export still consider it live;
 *  - called outside a write block it throws `can only be called from inside of a Writer`.
 *
 * Scanned from source rather than by importing the models: `@writer` is erased into a plain
 * method by the decorator, so a loaded class cannot tell its own override from an inherited
 * base method, and importing all 37 models would drag encryption and native modules in.
 */

const MODELS_DIR = path.join(__dirname, '..');

// A `@writer` on its own line above the method, or inline before it — both are used.
const WRITER_MARK_AS_DELETED = /@writer\s+(?:async\s+)?markAsDeleted\s*\([^)]*\)[^{]*\{/;

/** The method body starting at `from` (the index of its opening brace). */
function methodBody(source: string, from: number): string {
  let depth = 0;
  for (let i = from; i < source.length; i++) {
    if (source[i] === '{') {
      depth++;
    } else if (source[i] === '}') {
      depth--;
      if (depth === 0) {
        return source.slice(from, i + 1);
      }
    }
  }
  return source.slice(from);
}

const models = fs
  .readdirSync(MODELS_DIR)
  .filter((file) => file.endsWith('.ts'))
  .map((file) => {
    const source = fs.readFileSync(path.join(MODELS_DIR, file), 'utf8');
    return { file, source, table: source.match(/static table = '([^']+)'/)?.[1] };
  })
  .filter((model): model is { file: string; source: string; table: string } =>
    Boolean(model.table)
  );

const softDeletableTables = new Set(
  Object.values(schema.tables)
    .filter((table) => 'deleted_at' in table.columns)
    .map((table) => table.name)
);

const softDeletableModels = models.filter(({ table }) => softDeletableTables.has(table));

describe('model markAsDeleted overrides', () => {
  it('finds a model for every soft-deletable table', () => {
    const modelled = new Set(models.map(({ table }) => table));
    expect([...softDeletableTables].filter((table) => !modelled.has(table))).toEqual([]);
  });

  it.each(softDeletableModels.map(({ file, table }) => [file, table]))(
    '%s (%s) declares its own @writer markAsDeleted that stamps deleted_at',
    (file) => {
      const { source } = softDeletableModels.find((model) => model.file === file)!;

      // Without this the model silently inherits WatermelonDB's Sync tombstone instead.
      expect(source).toMatch(WRITER_MARK_AS_DELETED);

      const match = source.match(WRITER_MARK_AS_DELETED)!;
      const body = methodBody(source, match.index! + match[0].length - 1);
      expect(body).toMatch(/\.deletedAt = /);
    }
  );
});
