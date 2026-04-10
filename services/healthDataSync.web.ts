/**
 * Web stub — no native health integration.
 */

export const HC_LAST_SYNC_TYPE = 'health_connect_last_sync';

export enum SyncStatus {
  IDLE = 'IDLE',
  SYNCING = 'SYNCING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR',
}

export interface SyncResult {
  status: SyncStatus;
  recordsRead: number;
  recordsWritten: number;
  recordsSkipped: number;
  errors: never[];
  startTime: number;
  endTime: number;
  duration: number;
}

const emptyResult = (): SyncResult => ({
  status: SyncStatus.SUCCESS,
  recordsRead: 0,
  recordsWritten: 0,
  recordsSkipped: 0,
  errors: [],
  startTime: 0,
  endTime: 0,
  duration: 0,
});

class HealthDataSyncServiceWebStub {
  async isSyncEnabled(): Promise<boolean> {
    return false;
  }

  async enableSync(): Promise<void> {}

  async disableSync(): Promise<void> {}

  async getLastSyncTime(): Promise<number> {
    return 0;
  }

  isSyncInProgress(): boolean {
    return false;
  }

  async syncFromHealthPlatform(): Promise<SyncResult> {
    return emptyResult();
  }

  async syncFromHealthConnect(): Promise<SyncResult> {
    return emptyResult();
  }
}

export const healthDataSyncService = new HealthDataSyncServiceWebStub();
