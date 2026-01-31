import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';

import { migrations } from './migrations';
import { schema } from './schema';

// Note: The JSI SQLiteAdapter warning ("JSI SQLiteAdapter not available... falling back to asynchronous operation")
// is expected and harmless in the following scenarios:
// 1. When using remote JS debugging (Chrome DevTools) - JSI cannot work with remote debugging
// 2. When using Expo Go - custom native modules are not available in Expo Go
// 3. In development builds, ensure you're using a development client (not Expo Go) and have rebuilt native code
// The adapter will automatically fall back to async mode, which is slower but functional.
// For production builds, ensure native code is properly compiled with JSI support.
export default new SQLiteAdapter({
  schema,
  migrations,
  dbName: 'musclog',
  jsi: true,
});
