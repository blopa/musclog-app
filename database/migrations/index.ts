import { schemaMigrations, addColumns } from '@nozbe/watermelondb/Schema/migrations';
import { schema } from '../schema';

export const migrations = schemaMigrations({
  migrations: [
    // Version 1: Initial schema
    // No migration needed as this is the initial version
  ],
});
