/**
 * What on-device AI can do on this phone right now, as one answer. Pure: the store gathers the
 * readings (`services/localModels/onDeviceStatusStore.ts`), this decides.
 */
import type { AppleAvailability } from '@/modules/on-device-ai';

import { downloadFraction, type LocalModelInstallState } from './localModels/install';
import {
  type OnDeviceCapabilities,
  onDeviceCapabilities,
  type OnDeviceEngine,
} from './onDeviceEngine';

export type OnDeviceStatusState =
  /** Can answer now. */
  | 'ready'
  /** Downloaded model chosen but not installed yet. */
  | 'needsDownload'
  | 'downloading'
  | 'downloadFailed'
  | 'appleNotEligible'
  /** Eligible, but Apple Intelligence is switched off in iOS Settings. */
  | 'appleOff'
  /** Eligible and on, but iOS is still downloading its model. */
  | 'appleNotReady'
  /** Nothing can run here (web, an old OS, a phone below the device gate). */
  | 'unsupported';

export type OnDeviceModelReading = {
  supported: boolean;
  state: LocalModelInstallState;
  projectorInstalled: boolean;
  updateAvailable: boolean;
};

/** Which ways of running AI on the phone this device could offer, whatever is chosen now. */
export type OnDeviceOptions = {
  /** Apple Intelligence exists here and can be used (switched off or still downloading counts). */
  apple: boolean;
  /** The phone can hold and run the downloaded model. */
  model: boolean;
};

export type OnDeviceStatus = {
  /** True once `refreshOnDeviceStatus()` has completed at least one probe. */
  initialized: boolean;
  engine: OnDeviceEngine;
  state: OnDeviceStatusState;
  /** Apple Intelligence status even when the active engine is `'gguf'`. */
  appleState: OnDeviceStatusState;
  /** 0..1 while a download runs or is paused; null otherwise. */
  progress: number | null;
  capabilities: OnDeviceCapabilities;
  updateAvailable: boolean;
  options: OnDeviceOptions;
};

export type OnDeviceStatusInput = {
  initialized?: boolean;
  engine: OnDeviceEngine;
  appleAvailability: AppleAvailability;
  model: OnDeviceModelReading;
  /** The phone passes `evaluateLocalModelDevice`. */
  deviceOk: boolean;
};

function appleState(availability: AppleAvailability): OnDeviceStatusState {
  switch (availability) {
    case 'available':
      return 'ready';
    case 'deviceNotEligible':
      return 'appleNotEligible';
    case 'appleIntelligenceNotEnabled':
      return 'appleOff';
    case 'modelNotReady':
      return 'appleNotReady';
    default:
      return 'unsupported';
  }
}

function modelState(model: OnDeviceModelReading, deviceOk: boolean): OnDeviceStatusState {
  if (!model.supported || !deviceOk) {
    return 'unsupported';
  }

  switch (model.state.kind) {
    case 'ready':
      return 'ready';
    case 'downloading':
    case 'paused':
    case 'verifying':
    case 'installing':
      return 'downloading';
    case 'failed':
      return 'downloadFailed';
    default:
      return 'needsDownload';
  }
}

function modelProgress(state: LocalModelInstallState): number | null {
  if (state.kind === 'downloading' || state.kind === 'paused') {
    return downloadFraction(state.receivedBytes, state.totalBytes);
  }

  return state.kind === 'verifying' || state.kind === 'installing' ? 1 : null;
}

export function deriveOnDeviceStatus(input: OnDeviceStatusInput): OnDeviceStatus {
  const isApple = input.engine === 'apple';
  const resolvedAppleState = appleState(input.appleAvailability);

  return {
    initialized: input.initialized ?? false,
    engine: input.engine,
    state: isApple ? resolvedAppleState : modelState(input.model, input.deviceOk),
    appleState: resolvedAppleState,
    progress: isApple ? null : modelProgress(input.model.state),
    capabilities: onDeviceCapabilities(input.engine, input.model.projectorInstalled),
    updateAvailable: !isApple && input.model.updateAvailable,
    options: {
      apple:
        input.appleAvailability === 'available' ||
        input.appleAvailability === 'appleIntelligenceNotEnabled' ||
        input.appleAvailability === 'modelNotReady',
      model: input.model.supported && input.deviceOk,
    },
  };
}

/** Is there any way to run AI on this phone? Decides whether onboarding asks the question at all. */
export function hasLocalAiOption(status: Pick<OnDeviceStatus, 'options'>): boolean {
  return status.options.apple || status.options.model;
}

export function isOnDeviceReady(status: Pick<OnDeviceStatus, 'state'>): boolean {
  return status.state === 'ready';
}
