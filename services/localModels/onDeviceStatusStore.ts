/**
 * One reactive answer to "can on-device AI answer right now?", shared by the provider probe, the
 * settings context, the onboarding and settings screens and the coach. Module-level, like
 * `premiumStore`: nothing runs at import, `refreshOnDeviceStatus` reads the settings and the
 * system once, and the downloaded model's own store pushes download progress in.
 */
import * as Device from 'expo-device';
import { AppState, Platform } from 'react-native';

import { SETTINGS } from '@/constants/settingDefinitions';
import type { AppleAvailability } from '@/modules/on-device-ai';
import { SettingsService } from '@/database/services/SettingsService';
import { evaluateLocalModelDevice } from '@/utils/localModels/deviceGate';
import { getAppleAvailability } from '@/utils/onDeviceAi';
import { type OnDeviceEngineChoice, resolveOnDeviceEngine } from '@/utils/onDeviceEngine';
import { deriveOnDeviceStatus, type OnDeviceStatus } from '@/utils/onDeviceStatus';

import { getLocalModelSnapshot, refreshLocalModel, subscribeLocalModel } from './modelStore';

type Readings = {
  engineChoice: OnDeviceEngineChoice;
  appleAvailability: AppleAvailability;
};

async function readChoice(): Promise<OnDeviceEngineChoice> {
  return SettingsService.get(SETTINGS.onDeviceEngine);
}

let readings: Readings = { engineChoice: 'auto', appleAvailability: 'unsupportedOs' };
let current: OnDeviceStatus | null = null;
const listeners = new Set<() => void>();
let wired = false;

function deviceOk(): boolean {
  return evaluateLocalModelDevice({
    platform: Platform.OS,
    totalMemoryBytes: Device.totalMemory,
    cpuArchitectures: Device.supportedCpuArchitectures,
  }).ok;
}

function recompute() {
  const next = deriveOnDeviceStatus({
    engine: resolveOnDeviceEngine(readings.engineChoice, Platform.OS),
    appleAvailability: readings.appleAvailability,
    model: getLocalModelSnapshot(),
    deviceOk: deviceOk(),
  });
  current = next;
  listeners.forEach((listener) => listener());
}

function wire() {
  if (wired) {
    return;
  }

  wired = true;
  // Download progress and installs arrive from the model store.
  subscribeLocalModel(recompute);
  // The person may have switched Apple Intelligence on in iOS Settings while the app was away.
  AppState.addEventListener('change', (next) => {
    if (next === 'active') {
      void refreshOnDeviceStatus();
    }
  });
}

export function getOnDeviceStatusSnapshot(): OnDeviceStatus {
  if (!current) {
    recompute();
  }

  return current as OnDeviceStatus;
}

export function subscribeOnDeviceStatus(listener: () => void): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

/** Re-reads the engine choice, Apple's availability and the installed model, then publishes. */
export async function refreshOnDeviceStatus(): Promise<OnDeviceStatus> {
  wire();
  const [engineChoice, appleAvailability] = await Promise.all([
    readChoice().catch(() => readings.engineChoice),
    getAppleAvailability(),
    refreshLocalModel(),
  ]);
  readings = { engineChoice, appleAvailability };
  recompute();

  return getOnDeviceStatusSnapshot();
}

/** Test seam. */
export function resetOnDeviceStatusForTests() {
  readings = { engineChoice: 'auto', appleAvailability: 'unsupportedOs' };
  current = null;
  listeners.clear();
  wired = false;
}
