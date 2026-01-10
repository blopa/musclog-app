import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
import { schema } from './schema';
import { migrations } from './migrations';

export default new SQLiteAdapter({
  schema,
  migrations,
  dbName: 'musclog',
  jsi: true,
});
