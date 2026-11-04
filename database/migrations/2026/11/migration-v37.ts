import { createTable } from '@nozbe/watermelondb/Schema/migrations';

import { nutritionHealthOwnershipTable } from '@/database/nutritionHealthSchema';

const migrationV37 = {
  toVersion: 37,
  steps: [createTable(nutritionHealthOwnershipTable)],
};

export default migrationV37;
