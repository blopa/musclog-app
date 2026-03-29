/**
 * Apple Health (HealthKit) — API surface aligned with `healthConnect.android.ts` for shared call sites.
 */

import {
  AuthorizationStatus,
  authorizationStatusFor,
  isHealthDataAvailableAsync,
  requestAuthorization,
  WorkoutTypeIdentifier,
} from '@kingstinct/react-native-healthkit';
import type {
  ObjectTypeIdentifier,
  SampleTypeIdentifierWriteable,
} from '@kingstinct/react-native-healthkit/types';
import { Linking, Platform } from 'react-native';

import {
  HealthConnectError,
  HealthConnectErrorCode,
  HealthConnectErrorFactory,
} from './healthConnectErrors';
import { REQUIRED_HEALTH_PERMISSIONS } from './healthPermissionsShared';

/** Mirrors Android `HealthConnectStatus` */
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

/** Same labels as Android Health Connect `Permission` / `RecordType`. */
export type HealthRecordType =
  | 'Height'
  | 'Weight'
  | 'BodyFat'
  | 'Nutrition'
  | 'TotalCaloriesBurned'
  | 'ActiveCaloriesBurned'
  | 'BasalMetabolicRate'
  | 'ExerciseSession'
  | 'LeanBodyMass';

export type HealthPermission = { accessType: 'read' | 'write'; recordType: HealthRecordType };

export const REQUIRED_PERMISSIONS: HealthPermission[] = [
  ...REQUIRED_HEALTH_PERMISSIONS,
] as HealthPermission[];

function hkReadTypesForRecord(recordType: string): ObjectTypeIdentifier[] {
  switch (recordType) {
    case 'Height':
      return ['HKQuantityTypeIdentifierHeight'];
    case 'Weight':
      return ['HKQuantityTypeIdentifierBodyMass'];
    case 'BodyFat':
      return ['HKQuantityTypeIdentifierBodyFatPercentage'];
    case 'LeanBodyMass':
      return ['HKQuantityTypeIdentifierLeanBodyMass'];
    case 'Nutrition':
      return ['HKCorrelationTypeIdentifierFood'];
    case 'ActiveCaloriesBurned':
      return ['HKQuantityTypeIdentifierActiveEnergyBurned'];
    case 'BasalMetabolicRate':
      return ['HKQuantityTypeIdentifierBasalEnergyBurned'];
    case 'TotalCaloriesBurned':
      return [
        'HKQuantityTypeIdentifierActiveEnergyBurned',
        'HKQuantityTypeIdentifierBasalEnergyBurned',
      ];
    case 'ExerciseSession':
      return [WorkoutTypeIdentifier as unknown as ObjectTypeIdentifier];
    default:
      return [];
  }
}

function hkWriteTypesForRecord(recordType: string): SampleTypeIdentifierWriteable[] {
  switch (recordType) {
    case 'Height':
      return ['HKQuantityTypeIdentifierHeight'];
    case 'Weight':
      return ['HKQuantityTypeIdentifierBodyMass'];
    case 'BodyFat':
      return ['HKQuantityTypeIdentifierBodyFatPercentage'];
    case 'LeanBodyMass':
      return ['HKQuantityTypeIdentifierLeanBodyMass'];
    case 'Nutrition':
      return ['HKCorrelationTypeIdentifierFood'];
    case 'ExerciseSession':
      return [WorkoutTypeIdentifier as unknown as SampleTypeIdentifierWriteable];
    default:
      return [];
  }
}

function allAuthTypesForRequest(): {
  toRead: ObjectTypeIdentifier[];
  toShare: SampleTypeIdentifierWriteable[];
} {
  const toReadSet = new Set<ObjectTypeIdentifier>();
  const toShareSet = new Set<SampleTypeIdentifierWriteable>();

  for (const p of REQUIRED_HEALTH_PERMISSIONS) {
    if (p.accessType === 'read') {
      hkReadTypesForRecord(p.recordType).forEach((id) => toReadSet.add(id));
    } else {
      hkWriteTypesForRecord(p.recordType).forEach((id) => toShareSet.add(id));
    }
  }

  toShareSet.add('HKQuantityTypeIdentifierDietaryEnergyConsumed');
  toShareSet.add('HKQuantityTypeIdentifierDietaryProtein');
  toShareSet.add('HKQuantityTypeIdentifierDietaryCarbohydrates');
  toShareSet.add('HKQuantityTypeIdentifierDietaryFatTotal');
  toShareSet.add('HKQuantityTypeIdentifierDietaryFiber');

  return {
    toRead: Array.from(toReadSet),
    toShare: Array.from(toShareSet),
  };
}

function isAuthorized(id: ObjectTypeIdentifier): boolean {
  return authorizationStatusFor(id) === AuthorizationStatus.sharingAuthorized;
}

class HealthKitBridgeService {
  private status: HealthConnectStatus = HealthConnectStatus.NOT_INITIALIZED;
  private initializationPromise: Promise<void> | null = null;

  getStatus(): HealthConnectStatus {
    return this.status;
  }

  async checkAvailability(): Promise<HealthConnectStatus> {
    if (Platform.OS !== 'ios') {
      this.status = HealthConnectStatus.NOT_SUPPORTED;
      return this.status;
    }
    try {
      const ok = await isHealthDataAvailableAsync();
      this.status = ok ? HealthConnectStatus.AVAILABLE : HealthConnectStatus.NOT_INSTALLED;
      return this.status;
    } catch {
      this.status = HealthConnectStatus.ERROR;
      return this.status;
    }
  }

  async initializeHealthConnect(): Promise<void> {
    if (this.initializationPromise) {
      return this.initializationPromise;
    }
    if (this.status === HealthConnectStatus.AVAILABLE) {
      return Promise.resolve();
    }

    const run = async () => {
      try {
        this.status = HealthConnectStatus.INITIALIZING;
        const availability = await this.checkAvailability();
        if (availability !== HealthConnectStatus.AVAILABLE) {
          throw new HealthConnectError(
            HealthConnectErrorCode.SDK_NOT_AVAILABLE,
            'Health data is not available on this device',
            { retryable: false }
          );
        }
        this.status = HealthConnectStatus.AVAILABLE;
      } catch (error) {
        this.status = HealthConnectStatus.ERROR;
        this.initializationPromise = null;
        throw error instanceof HealthConnectError
          ? error
          : HealthConnectErrorFactory.unknownError(error as Error);
      }
    };

    this.initializationPromise = run();
    return this.initializationPromise;
  }

  async requestPermissions(
    permissions: HealthPermission[] = REQUIRED_PERMISSIONS
  ): Promise<{ granted: HealthPermission[]; denied: HealthPermission[] }> {
    await this.ensureInitialized();

    const toRead = new Set<ObjectTypeIdentifier>();
    const toShare = new Set<SampleTypeIdentifierWriteable>();

    for (const p of permissions) {
      if (p.accessType === 'read') {
        hkReadTypesForRecord(p.recordType).forEach((id) => toRead.add(id));
      } else {
        hkWriteTypesForRecord(p.recordType).forEach((id) => toShare.add(id));
        if (p.recordType === 'Nutrition') {
          toShare.add('HKQuantityTypeIdentifierDietaryEnergyConsumed');
          toShare.add('HKQuantityTypeIdentifierDietaryProtein');
          toShare.add('HKQuantityTypeIdentifierDietaryCarbohydrates');
          toShare.add('HKQuantityTypeIdentifierDietaryFatTotal');
          toShare.add('HKQuantityTypeIdentifierDietaryFiber');
        }
      }
    }

    await requestAuthorization({
      toRead: Array.from(toRead),
      toShare: Array.from(toShare),
    });

    const granted: HealthPermission[] = [];
    const denied: HealthPermission[] = [];

    for (const p of permissions) {
      const ok =
        p.accessType === 'read'
          ? hkReadTypesForRecord(p.recordType).every((id) => isAuthorized(id))
          : hkWriteTypesForRecord(p.recordType).every(
              (id) =>
                authorizationStatusFor(id as ObjectTypeIdentifier) ===
                AuthorizationStatus.sharingAuthorized
            );
      if (ok) {
        granted.push(p);
      } else {
        denied.push(p);
      }
    }

    return { granted, denied };
  }

  async requestFullAuthorization(): Promise<boolean> {
    await this.ensureInitialized();
    const { toRead, toShare } = allAuthTypesForRequest();
    return requestAuthorization({ toRead, toShare });
  }

  async getGrantedPermissions(): Promise<HealthPermission[]> {
    await this.ensureInitialized();
    const granted: HealthPermission[] = [];
    for (const p of REQUIRED_HEALTH_PERMISSIONS) {
      const ids =
        p.accessType === 'read'
          ? hkReadTypesForRecord(p.recordType)
          : hkWriteTypesForRecord(p.recordType);
      const ok = ids.every((id) =>
        p.accessType === 'read'
          ? isAuthorized(id)
          : authorizationStatusFor(id as ObjectTypeIdentifier) ===
            AuthorizationStatus.sharingAuthorized
      );
      if (ok) {
        granted.push(p as HealthPermission);
      }
    }
    return granted;
  }

  async hasAllRequiredPermissions(): Promise<boolean> {
    const granted = await this.getGrantedPermissions();
    return REQUIRED_HEALTH_PERMISSIONS.every((req) =>
      granted.some((g) => g.recordType === req.recordType && g.accessType === req.accessType)
    );
  }

  async hasAnyPermission(): Promise<boolean> {
    const granted = await this.getGrantedPermissions();
    return granted.length > 0;
  }

  async hasPermissionForRecordType(
    recordType: HealthRecordType,
    accessType: 'read' | 'write' = 'read'
  ): Promise<boolean> {
    await this.ensureInitialized();
    const ids =
      accessType === 'read' ? hkReadTypesForRecord(recordType) : hkWriteTypesForRecord(recordType);
    if (ids.length === 0) {
      return false;
    }
    return ids.every((id) =>
      accessType === 'read'
        ? isAuthorized(id)
        : authorizationStatusFor(id as ObjectTypeIdentifier) ===
          AuthorizationStatus.sharingAuthorized
    );
  }

  async getGrantedPermissionsByType(): Promise<
    Map<HealthRecordType, { read: boolean; write: boolean }>
  > {
    const permMap = new Map<HealthRecordType, { read: boolean; write: boolean }>();
    const types = Array.from(
      new Set(REQUIRED_HEALTH_PERMISSIONS.map((p) => p.recordType))
    ) as HealthRecordType[];
    for (const recordType of types) {
      permMap.set(recordType, {
        read: await this.hasPermissionForRecordType(recordType, 'read'),
        write: await this.hasPermissionForRecordType(recordType, 'write'),
      });
    }
    return permMap;
  }

  async getPermissionStats(): Promise<{
    total: number;
    granted: number;
    percentage: number;
    permissions: { recordType: HealthRecordType; read: boolean; write: boolean }[];
  }> {
    const permMap = await this.getGrantedPermissionsByType();
    const types = Array.from(
      new Set(REQUIRED_HEALTH_PERMISSIONS.map((p) => p.recordType))
    ) as HealthRecordType[];
    const permissions = types.map((recordType) => ({
      recordType,
      ...(permMap.get(recordType) || { read: false, write: false }),
    }));
    const grantedCount = permissions.filter((p) => p.read || p.write).length;
    return {
      total: permissions.length,
      granted: grantedCount,
      percentage:
        permissions.length === 0 ? 0 : Math.round((grantedCount / permissions.length) * 100),
      permissions,
    };
  }

  async revokeAllPermissions(): Promise<void> {
    await this.ensureInitialized();
    await Linking.openSettings();
  }

  async openSettings(): Promise<void> {
    await Linking.openSettings();
  }

  async openDataManagement(): Promise<void> {
    await Linking.openURL('x-apple-health://').catch(() => Linking.openSettings());
  }

  private async ensureInitialized(): Promise<void> {
    if (this.status === HealthConnectStatus.AVAILABLE) {
      return;
    }
    await this.initializeHealthConnect();
  }
}

export const healthConnectService = new HealthKitBridgeService();
