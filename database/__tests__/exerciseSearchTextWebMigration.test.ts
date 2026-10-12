/**
 * The v27 migration adds `exercises.search_text` EMPTY and leaves filling it to a JS boot backfill,
 * because the value needs the app's own normalization and LokiJS (web) ignores raw SQL anyway. That
 * only works if the backfill's selector matches the rows the migration produced on the web adapter
 * too — where a column is not a SQL column but a property each record may or may not have. A
 * selector that only matched SQLite's NULL would leave every web user's existing exercises
 * unsearchable by alias or translated name, silently and forever.
 *
 * This runs LokiJS's own add-columns migration step and LokiJS's own query execution, with the
 * real v27 step and the backfill's real selector, against a record shaped like a pre-v27 row.
 */

import { buildQueryDescription } from '@nozbe/watermelondb/QueryDescription';

import { missingSearchTextClause } from '@/database/exerciseSearchText';
import { migrations } from '@/database/migrations';

const Loki = require('lokijs');
const {
  default: DatabaseDriver,
} = require('@nozbe/watermelondb/adapters/lokijs/worker/DatabaseDriver');
const { executeQuery } = require('@nozbe/watermelondb/adapters/lokijs/worker/executeQuery');

type Step = { type: string; table?: string; columns?: { name: string }[] };

const v27Steps = (
  migrations.sortedMigrations.find(({ toVersion }) => toVersion === 27)!.steps as Step[]
).filter((step) => step.type === 'add_columns' && step.table === 'exercises');

function lokiWithPreV27Exercises() {
  const loki = new Loki('test.db', { env: 'NA' });
  const exercises = loki.addCollection('exercises', { unique: ['id'], disableMeta: true });
  // Rows written before v27: the column does not exist on them at all.
  exercises.insert({ id: 'user-1', name: 'My Press', _status: 'synced', _changed: '' });
  exercises.insert({ id: 'catalogue-1', name: 'Squat', _status: 'synced', _changed: '' });
  return loki;
}

function runV27OnLoki(loki: unknown) {
  for (const step of v27Steps) {
    DatabaseDriver.prototype._executeAddColumnsMigration.call({ loki }, step);
  }
}

function backfillSelection(loki: unknown): string[] {
  const query = {
    table: 'exercises',
    description: buildQueryDescription([missingSearchTextClause()]),
    associations: [],
  };
  return executeQuery(query, loki).map((record: { id: string }) => record.id);
}

describe('exercises.search_text on web (LokiJS)', () => {
  it('is the v27 step under test', () => {
    expect(v27Steps.flatMap((step) => step.columns!.map((column) => column.name))).toEqual([
      'search_text',
    ]);
  });

  it('leaves pre-v27 rows with an explicit null, which the backfill selects', () => {
    const loki = lokiWithPreV27Exercises();

    runV27OnLoki(loki);

    expect(loki.getCollection('exercises').findOne({ id: 'user-1' })).toHaveProperty(
      'search_text',
      null
    );
    expect(backfillSelection(loki)).toEqual(['user-1', 'catalogue-1']);
  });

  it('stops selecting a row once it has been filled', () => {
    const loki = lokiWithPreV27Exercises();
    runV27OnLoki(loki);

    // What the catalogue sync (or a previous backfill run) leaves behind.
    const exercises = loki.getCollection('exercises');
    exercises.update({ ...exercises.findOne({ id: 'catalogue-1' }), search_text: 'squat' });

    expect(backfillSelection(loki)).toEqual(['user-1']);
  });

  it('also selects a row that lacks the property entirely, e.g. one restored from an old backup', () => {
    expect(backfillSelection(lokiWithPreV27Exercises())).toEqual(['user-1', 'catalogue-1']);
  });
});
