import LokiJSAdapter from '@nozbe/watermelondb/adapters/lokijs';

import { isStaticExport } from '@/constants/platform';

import { migrations } from './migrations';
import { schema } from './schema';

export default new LokiJSAdapter({
  schema,
  migrations,
  useWebWorker: false,
  useIncrementalIndexedDB: !isStaticExport,
});
