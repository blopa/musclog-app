import LokiJSAdapter from '@nozbe/watermelondb/adapters/lokijs';

import { migrations } from './migrations';
import { schema } from './schema';

export default new LokiJSAdapter({
  schema,
  migrations,
  useWebWorker: false,
  useIncrementalIndexedDB: true,
});
