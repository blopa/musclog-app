/**
 * One reactive answer to "can on-device AI answer right now?", shared by the provider probe, the
 * settings context, the onboarding and settings screens and the coach. Module-level, like
 * `premiumStore`: nothing runs at import, `refreshOnDeviceStatus` reads the settings and the
 * system once, and the downloaded model's own store pushes download progress in.
 */
import * as Device from 'expo-device';
import { AppState, Platform } from 'react-native';

import { SETTINGS } from '@/constants/settingDefinitions';
import { SettingsService } from '@/database/services/SettingsService';
import type { AppleAvailability } from '@/modules/on-device-ai';
import { createListeners } from '@/utils/createListeners';
import { handleError } from '@/utils/handleError';
import { evaluateLocalModelDevice } from '@/utils/localModels/deviceGate';
import { type OnDeviceEngineChoice, resolveOnDeviceEngine } from '@/utils/onDeviceEngine';
import { deriveOnDeviceStatus, type OnDeviceStatus } from '@/utils/onDeviceStatus';

import { isDevWebLocalModel } from './devWebBridge';
import { getLocalModelSnapshot, refreshLocalModel, subscribeLocalModel } from './modelStore';

/**
 * Apple's availability is read through an inline require: `utils/onDeviceAi.ios` imports the
 * Apple AI package, which throws where its native module is absent, and this store is reached from
 * `SettingsContext`, so a static import would load it into every screen and test.
 */
function readAppleAvailability(): Promise<AppleAvailability> {
  return (
    require('@/utils/onDeviceAi') as typeof import('@/utils/onDeviceAi')
  ).getAppleAvailability();
}

type Readings = {
  engineChoice: OnDeviceEngineChoice;
  appleAvailability: AppleAvailability;
};

async function readChoice(): Promise<OnDeviceEngineChoice> {
  return SettingsService.get(SETTINGS.onDeviceEngine);
}

/**
 * Everything one run of the store knows. A probe writes into the session it started in, and the
 * test reset replaces the session, so a probe still in flight at reset writes into a dead one.
 */
type Session = {
  readings: Readings;
  initialized: boolean;
  current: OnDeviceStatus | null;
  running: Promise<OnDeviceStatus> | null;
  trailing: Promise<OnDeviceStatus> | null;
  unsubscribeModel: (() => void) | null;
  appStateSubscription: { remove: () => void } | null;
};

function createSession(): Session {
  return {
    readings: { engineChoice: 'auto', appleAvailability: 'unsupportedOs' },
    initialized: false,
    current: null,
    running: null,
    trailing: null,
    unsubscribeModel: null,
    appStateSubscription: null,
  };
}

let session = createSession();
const { subscribe, notify, clear: clearListeners } = createListeners();

function deviceOk(): boolean {
  // The dev web bridge runs on the desktop's llama-server, so the phone gate does not apply.
  if (isDevWebLocalModel()) {
    return true;
  }

  return evaluateLocalModelDevice({
    platform: Platform.OS,
    totalMemoryBytes: Device.totalMemory,
    cpuArchitectures: Device.supportedCpuArchitectures,
  }).ok;
}

function recompute(target: Session) {
  target.current = deriveOnDeviceStatus({
    initialized: target.initialized,
    engine: resolveOnDeviceEngine(target.readings.engineChoice, Platform.OS),
    appleAvailability: target.readings.appleAvailability,
    model: getLocalModelSnapshot(),
    deviceOk: deviceOk(),
  });
  notify();
}

function wire(target: Session) {
  if (target.unsubscribeModel) {
    return;
  }

  // Download progress and installs arrive from the model store.
  target.unsubscribeModel = subscribeLocalModel(() => recompute(target));
  // The person may have switched Apple Intelligence on in iOS Settings while the app was away.
  target.appStateSubscription = AppState.addEventListener('change', (next) => {
    if (next === 'active') {
      void refreshOnDeviceStatus();
    }
  });
}

function snapshotOf(target: Session): OnDeviceStatus {
  if (!target.current) {
    recompute(target);
  }

  return target.current as OnDeviceStatus;
}

export function getOnDeviceStatusSnapshot(): OnDeviceStatus {
  return snapshotOf(session);
}

export const subscribeOnDeviceStatus = subscribe;

/** One probe. Never rejects: a failure is reported once and the last snapshot stays. */
async function probe(target: Session): Promise<OnDeviceStatus> {
  try {
    const [engineChoice, appleAvailability] = await Promise.all([
      readChoice().catch(() => target.readings.engineChoice),
      readAppleAvailability(),
      refreshLocalModel(),
    ]);
    target.readings = { engineChoice, appleAvailability };
    target.initialized = true;
    recompute(target);
  } catch (error) {
    void handleError(error, 'onDeviceStatus.refresh', { showSnackbar: false });
  }

  return snapshotOf(target);
}

function startProbe(target: Session): Promise<OnDeviceStatus> {
  const run = probe(target);
  target.running = run;
  void run.then(() => {
    // A pending trailing probe keeps the slot until it starts, so nothing slips in between.
    if (target.running === run && !target.trailing) {
      target.running = null;
    }
  });

  return run;
}

/**
 * Re-reads the engine choice, Apple's availability and the installed model, then publishes. At
 * most one probe runs: calls made while it runs share ONE trailing probe that starts after it (so
 * a call made after a settings write always sees a fresh read). Never rejects.
 */
export function refreshOnDeviceStatus(): Promise<OnDeviceStatus> {
  const target = session;
  wire(target);
  if (!target.running) {
    return startProbe(target);
  }

  if (!target.trailing) {
    target.trailing = target.running.then(() => {
      target.trailing = null;

      return startProbe(target);
    });
  }

  return target.trailing;
}

/** Test seam: a new session; whatever the old one still runs writes into a dead one. */
export function resetOnDeviceStatusForTests() {
  session.unsubscribeModel?.();
  session.appStateSubscription?.remove();
  session = createSession();
  clearListeners();
}
