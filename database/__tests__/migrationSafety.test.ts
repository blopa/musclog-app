import type { SchemaMigrations } from '@nozbe/watermelondb/Schema/migrations';

import { pendingMigrationsCanTouchExistingData } from '../migrationSafety';

// Build a minimal SchemaMigrations-shaped object; the policy only reads
// `sortedMigrations[].toVersion` and `sortedMigrations[].steps[].type`.
const mig = (toVersion: number, ...stepTypes: string[]) => ({
  toVersion,
  steps: stepTypes.map((type) => ({ type })),
});

const schema = (...migrations: ReturnType<typeof mig>[]): SchemaMigrations =>
  ({ sortedMigrations: migrations }) as unknown as SchemaMigrations;

describe('pendingMigrationsCanTouchExistingData', () => {
  it('returns false for a lone additive migration (the v23 createTable case)', () => {
    const migrations = schema(mig(23, 'create_table'));
    expect(pendingMigrationsCanTouchExistingData(migrations, 22, 23)).toBe(false);
  });

  it('returns false when every pending step is additive (createTable / addColumns)', () => {
    const migrations = schema(mig(23, 'create_table'), mig(24, 'add_columns', 'add_columns'));
    expect(pendingMigrationsCanTouchExistingData(migrations, 22, 24)).toBe(false);
  });

  it('returns true when any pending migration has a raw sql step', () => {
    const migrations = schema(mig(23, 'create_table'), mig(24, 'sql'));
    expect(pendingMigrationsCanTouchExistingData(migrations, 22, 24)).toBe(true);
  });

  it('returns true for a migration mixing additive and sql steps', () => {
    const migrations = schema(mig(23, 'create_table', 'sql'));
    expect(pendingMigrationsCanTouchExistingData(migrations, 22, 23)).toBe(true);
  });

  it('treats an unrecognised step type as potentially destructive (fail safe)', () => {
    const migrations = schema(mig(23, 'rename_table'));
    expect(pendingMigrationsCanTouchExistingData(migrations, 22, 23)).toBe(true);
  });

  it('only considers migrations inside the pending (fromVersion, toVersion] range', () => {
    const migrations = schema(
      mig(20, 'sql'), // already applied — must be ignored
      mig(23, 'create_table'), // the only pending one
      mig(24, 'sql') // future — must be ignored
    );
    expect(pendingMigrationsCanTouchExistingData(migrations, 22, 23)).toBe(false);
  });

  it('detects a destructive migration anywhere within a multi-version jump', () => {
    const migrations = schema(
      mig(19, 'add_columns'),
      mig(20, 'create_table'),
      mig(21, 'sql'), // destructive, mid-range
      mig(22, 'add_columns'),
      mig(23, 'create_table')
    );
    expect(pendingMigrationsCanTouchExistingData(migrations, 18, 23)).toBe(true);
  });

  it('returns false when nothing is pending (fromVersion === toVersion)', () => {
    const migrations = schema(mig(23, 'sql'));
    expect(pendingMigrationsCanTouchExistingData(migrations, 23, 23)).toBe(false);
  });
});
