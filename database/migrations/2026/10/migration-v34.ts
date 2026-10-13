import { addColumns } from '@nozbe/watermelondb/Schema/migrations';

import { weeklyReviewTrainingColumns } from '@/database/weeklyReviewSchema';

const migrationV34 = {
  toVersion: 34,
  steps: [
    addColumns({
      table: 'weekly_reviews',
      columns: weeklyReviewTrainingColumns,
    }),
  ],
};

export default migrationV34;
