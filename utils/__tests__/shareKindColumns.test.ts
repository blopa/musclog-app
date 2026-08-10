import { schema } from '@/database/schema';
import { SHARE_KINDS } from '@/utils/share/shareKinds';

/**
 * `ShareKindSpec.columns` is the allowlist that keeps an untrusted, camera-delivered row from
 * assigning arbitrary properties onto a WatermelonDB model. Written out by hand in the spec so it
 * is readable next to the rest of the share contract — and pinned here so it cannot drift from the
 * schema in either direction:
 *
 *  - a column listed in the spec but absent from the table would let a payload through that the
 *    model has no setter for;
 *  - a column added to the table but not to the spec is silently unshareable, which shows up as a
 *    field that quietly resets on the receiving phone.
 *
 * `deleted_at` is excluded deliberately: an imported row is always live, and `planShareImport`
 * drops rows that carry it. `id` is handled separately — the plan remaps it.
 */
const NEVER_SHARED = new Set(['deleted_at']);

describe('share kind column allowlists', () => {
  for (const [kind, spec] of Object.entries(SHARE_KINDS)) {
    describe(kind, () => {
      it('declares an allowlist for every table it imports', () => {
        expect(Object.keys(spec.columns).sort()).toEqual([...spec.tables].sort());
      });

      it.each([...spec.tables])('matches the real schema for %s', (table) => {
        const tableSchema = schema.tables[table];
        expect(tableSchema).toBeDefined();

        const schemaColumns = Object.keys(tableSchema.columns)
          .filter((column) => !NEVER_SHARED.has(column))
          .sort();
        expect([...spec.columns[table]].sort()).toEqual(schemaColumns);
      });

      it('covers every foreign key and asset column it relies on', () => {
        for (const [table, foreignKeys] of Object.entries(spec.foreignKeys)) {
          for (const column of Object.keys(foreignKeys)) {
            expect(spec.columns[table]).toContain(column);
          }
        }
        for (const [table, assetColumns] of Object.entries(spec.assetColumns)) {
          for (const column of assetColumns) {
            expect(spec.columns[table]).toContain(column);
          }
        }
      });

      it('covers the polymorphic type columns its foreign keys discriminate on', () => {
        for (const [table, foreignKeys] of Object.entries(spec.foreignKeys)) {
          for (const target of Object.values(foreignKeys)) {
            if (typeof target !== 'string') {
              expect(spec.columns[table]).toContain(target.polymorphic.typeColumn);
            }
          }
        }
      });
    });
  }
});
