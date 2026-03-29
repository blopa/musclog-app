export interface FitnessSyncCounts {
  totalRead: number;
  written: number;
  updated: number;
  deleted: number;
  skipped: number;
}

export interface UserMetricWriteParams {
  metricId: string;
  type: string;
  value: number;
  date: number;
  timezone: string;
}

export async function writeUserMetricToHealthConnect(
  _params: UserMetricWriteParams
): Promise<string | undefined> {
  return undefined;
}

export async function syncFitnessMetrics(
  _timeRange?: { startTime: number; endTime: number },
  _options?: { retryAttempts?: number; skipValidation?: boolean }
): Promise<FitnessSyncCounts> {
  return { totalRead: 0, written: 0, updated: 0, deleted: 0, skipped: 0 };
}
