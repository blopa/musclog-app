/**
 * Web stub — no native health integration.
 */

import { HealthConnectErrorFactory } from './healthConnectErrors';

export enum HealthConnectStatus {
  NOT_INITIALIZED = 'NOT_INITIALIZED',
  INITIALIZING = 'INITIALIZING',
  AVAILABLE = 'AVAILABLE',
  NOT_SUPPORTED = 'NOT_SUPPORTED',
  NOT_INSTALLED = 'NOT_INSTALLED',
  ERROR = 'ERROR',
}

export interface TimeRangeFilter {
  operator: 'between';
  startTime: string;
  endTime: string;
}

export const REQUIRED_PERMISSIONS: { accessType: 'read' | 'write'; recordType: string }[] = [];

class HealthWebStub {
  private status = HealthConnectStatus.NOT_SUPPORTED;

  getStatus(): HealthConnectStatus {
    return this.status;
  }

  async checkAvailability(): Promise<HealthConnectStatus> {
    return HealthConnectStatus.NOT_SUPPORTED;
  }

  async initializeHealthConnect(): Promise<void> {
    return;
  }

  async requestPermissions(): Promise<{
    granted: { accessType: 'read' | 'write'; recordType: string }[];
    denied: { accessType: 'read' | 'write'; recordType: string }[];
  }> {
    return { granted: [], denied: [] };
  }

  async getGrantedPermissions(): Promise<{ accessType: 'read' | 'write'; recordType: string }[]> {
    return [];
  }

  async hasAllRequiredPermissions(): Promise<boolean> {
    return false;
  }

  async hasAnyPermission(): Promise<boolean> {
    return false;
  }

  async hasPermissionForRecordType(_recordType: string): Promise<boolean> {
    return false;
  }

  async getGrantedPermissionsByType(): Promise<Map<string, { read: boolean; write: boolean }>> {
    return new Map();
  }

  async getPermissionStats(): Promise<{
    total: number;
    granted: number;
    percentage: number;
    permissions: { recordType: string; read: boolean; write: boolean }[];
  }> {
    return { total: 0, granted: 0, percentage: 0, permissions: [] };
  }

  async revokeAllPermissions(): Promise<void> {
    return;
  }

  async readRecords(): Promise<never> {
    throw HealthConnectErrorFactory.sdkNotAvailable();
  }

  async insertRecords(): Promise<never> {
    throw HealthConnectErrorFactory.sdkNotAvailable();
  }

  async aggregateRecords(): Promise<never> {
    throw HealthConnectErrorFactory.sdkNotAvailable();
  }

  async deleteRecordsByUuids(): Promise<void> {
    return;
  }

  async deleteRecordsByTimeRange(): Promise<void> {
    return;
  }

  async openSettings(): Promise<void> {
    return;
  }

  async openDataManagement(): Promise<void> {
    return;
  }
}

export const healthConnectService = new HealthWebStub();
