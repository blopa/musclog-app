import { randomUUID } from 'expo-crypto';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useSnackbar } from '@/context/SnackbarContext';
import type WorkoutLog from '@/database/models/WorkoutLog';
import { BleDeviceService } from '@/database/services/BleDeviceService';
import { UserMetricService } from '@/database/services/UserMetricService';
import { UserService } from '@/database/services/UserService';
import type { CurrentSetData } from '@/hooks/useActiveWorkout';
import { useWitMotion, witMotionClient } from '@/modules/witmotion-ble';
import {
  appendBleWorkoutSamplesToNdjsonFile,
  type BleWorkoutSample,
  compressRawToDataPoints,
  createBleWorkoutTrackingTempFile,
  saveBleWorkoutFile,
} from '@/utils/bleWorkoutDataStorage';
import { localDayHalfOpenRange, MS_PER_SOLAR_DAY } from '@/utils/calendarDate';
import { handleError } from '@/utils/handleError';

type SessionBleTrackingInput = {
  workoutLogId: string | undefined;
  workoutLog: WorkoutLog | null | undefined;
  currentSetData: CurrentSetData | null;
  /** The reps currently entered for the set, recorded alongside the motion samples. */
  reps: number;
  bleGenerateChartPayload: boolean;
};

/**
 * Motion-sensor recording during a session: auto-connecting to the last sensor, recording one set
 * at a time to a temp file, saving it with the user's biometrics, and attaching the compressed
 * chart data to the set once it is logged. A recording never outlives its set — it is discarded
 * when the set changes, the sensor drops or the screen unmounts.
 */
export function useSessionBleTracking({
  workoutLogId,
  workoutLog,
  currentSetData,
  reps,
  bleGenerateChartPayload,
}: SessionBleTrackingInput) {
  const { t } = useTranslation();
  const { showSnackbar } = useSnackbar();
  const wit = useWitMotion();
  const [isTracking, setIsTracking] = useState(false);
  const [isStopTrackingSaving, setIsStopTrackingSaving] = useState(false);
  const [blinkState, setBlinkState] = useState(true);
  const isTrackingRef = useRef(false);
  const trackingTempFileRef = useRef<ReturnType<typeof createBleWorkoutTrackingTempFile> | null>(
    null
  );
  const trackingSampleCountRef = useRef(0);
  const trackingStartedAtRef = useRef<number | null>(null);
  const unsubscribeBatchRef = useRef<(() => void) | null>(null);
  const hasAttemptedAutoConnect = useRef(false);
  const pendingRawBleFileUriRef = useRef<string | null>(null);
  // Initialize to current state so remounts while connected don't re-show the snackbar.
  const wasConnectedRef = useRef(wit.isConnected);

  useEffect(() => {
    if (!isTracking) {
      return;
    }

    const interval = setInterval(() => {
      setBlinkState((current) => !current);
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, [isTracking]);

  const clearTrackingTempFile = useCallback(() => {
    const tempFile = trackingTempFileRef.current;
    trackingTempFileRef.current = null;

    if (!tempFile) {
      return;
    }

    try {
      tempFile.parentDirectory.delete();
      return;
    } catch {
      // Fall through and try deleting the file itself.
    }

    try {
      tempFile.delete();
    } catch {
      // Best-effort cleanup only.
    }
  }, []);

  // Stop tracking and discard data (used on disconnect and set/workout transitions).
  const discardTracking = useCallback(() => {
    if (!isTrackingRef.current) {
      return;
    }

    setIsTracking(false);
    isTrackingRef.current = false;
    unsubscribeBatchRef.current?.();
    unsubscribeBatchRef.current = null;
    trackingSampleCountRef.current = 0;
    trackingStartedAtRef.current = null;
    pendingRawBleFileUriRef.current = null;
    clearTrackingTempFile();
  }, [clearTrackingTempFile]);

  // Stop tracking and save the collected data to a local JSON file.
  const stopTrackingAndSave = useCallback(async () => {
    if (!isTrackingRef.current) {
      return;
    }

    const sampleCount = trackingSampleCountRef.current;
    const tempFile = trackingTempFileRef.current;
    const startedAt = trackingStartedAtRef.current;

    setIsTracking(false);
    isTrackingRef.current = false;
    unsubscribeBatchRef.current?.();
    unsubscribeBatchRef.current = null;
    trackingSampleCountRef.current = 0;
    trackingStartedAtRef.current = null;

    if (sampleCount === 0 || !tempFile || !currentSetData || !workoutLog || !wit.connectedDevice) {
      clearTrackingTempFile();
      return;
    }

    try {
      const stoppedAt = new Date();

      // Collect user biometrics to enrich the recording.
      let userHeightCm: number | undefined;
      let userAgeYears: number | undefined;
      let userGender: string | undefined;
      let userWeightKg: number | undefined;

      try {
        const [heightMetric, user, weightMetric] = await Promise.all([
          UserMetricService.getLatest('height'),
          UserService.getCurrentUser(),
          UserMetricService.getLatest('weight'),
        ]);

        if (heightMetric) {
          const { value } = await heightMetric.getDecrypted();
          userHeightCm = value;
        }

        if (user?.dateOfBirth) {
          const ageMsAtStop = stoppedAt.getTime() - user.dateOfBirth;
          userAgeYears = Math.floor(ageMsAtStop / (365.25 * MS_PER_SOLAR_DAY));
        }

        if (user?.gender) {
          userGender = user.gender;
        }

        if (weightMetric) {
          const { start, nextStart } = localDayHalfOpenRange(stoppedAt);
          if (weightMetric.date >= start && weightMetric.date < nextStart) {
            const { value } = await weightMetric.getDecrypted();
            userWeightKg = value;
          }
        }
      } catch {
        // Non-fatal — biometrics are best-effort enrichment.
      }

      const bleFileUri = await saveBleWorkoutFile({
        version: 1,
        workoutLogId: workoutLog.id,
        exerciseName: currentSetData.exercise.name ?? '',
        muscleGroup: currentSetData.exercise.muscleGroup ?? '',
        equipmentType: currentSetData.exercise.equipmentType ?? '',
        mechanicType: currentSetData.exercise.mechanicType ?? '',
        setNumber: currentSetData.setNumber,
        reps,
        deviceId: wit.connectedDevice.id,
        deviceDisplayName: wit.connectedDevice.name,
        startedAt: new Date(startedAt ?? Date.now()).toISOString(),
        stoppedAt: stoppedAt.toISOString(),
        sampleCount,
        userHeightCm,
        userAgeYears,
        userGender,
        userWeightKg,
        samplesFile: tempFile,
      });
      trackingTempFileRef.current = null;

      if (bleGenerateChartPayload && sampleCount >= 20) {
        pendingRawBleFileUriRef.current = bleFileUri;
      }

      showSnackbar('success', t('workoutSession.trackingSaved', { count: sampleCount }));
    } catch (err) {
      handleError(err, 'workout-session.stopTrackingAndSave');
    }
  }, [
    bleGenerateChartPayload,
    clearTrackingTempFile,
    currentSetData,
    workoutLog,
    reps,
    wit.connectedDevice,
    showSnackbar,
    t,
  ]);

  const startTracking = useCallback(() => {
    if (isTrackingRef.current) {
      return;
    }

    try {
      clearTrackingTempFile();
      const tempFile = createBleWorkoutTrackingTempFile(randomUUID());
      trackingTempFileRef.current = tempFile;
      trackingSampleCountRef.current = 0;
      pendingRawBleFileUriRef.current = null;
      trackingStartedAtRef.current = Date.now();
      setIsTracking(true);
      isTrackingRef.current = true;

      unsubscribeBatchRef.current?.();
      unsubscribeBatchRef.current = witMotionClient.onBatch((batch) => {
        const samples: BleWorkoutSample[] = [];

        for (const packet of batch.packets) {
          if (packet.kind === 'motion') {
            samples.push({
              timestamp: packet.timestamp,
              accel: { ...packet.accel },
              gyro: { ...packet.gyro },
              angle: { ...packet.angle },
            });
          }
        }

        if (samples.length === 0) {
          return;
        }

        trackingSampleCountRef.current += samples.length;
        appendBleWorkoutSamplesToNdjsonFile(tempFile, samples);
      });
    } catch (err) {
      handleError(err, 'workout-session.handleStartTracking');
    }
  }, [clearTrackingTempFile]);

  /** The "Stop tracking" button: saves the recording with the button's own spinner up. */
  const stopTrackingFromButton = async () => {
    setIsStopTrackingSaving(true);
    try {
      await stopTrackingAndSave();
    } finally {
      setIsStopTrackingSaving(false);
    }
  };

  /** Logging a set ends its recording first, so the samples are saved against that set. */
  const finishSetRecording = async () => {
    if (isTrackingRef.current) {
      await stopTrackingAndSave();
    }
  };

  /** Once the set is logged, turns its saved recording into chart data on the set (best effort). */
  const attachRecordingToSet = (setId: string, loggedReps: number) => {
    const rawBleFileUri = pendingRawBleFileUriRef.current;
    pendingRawBleFileUriRef.current = null;
    if (bleGenerateChartPayload && rawBleFileUri && loggedReps > 0) {
      void compressRawToDataPoints(rawBleFileUri, setId, loggedReps).catch(() => {});
    }
  };

  // Auto-connect to the most recently connected saved device when the workout starts.
  useEffect(() => {
    if (hasAttemptedAutoConnect.current || wit.isConnected || !workoutLogId) {
      return;
    }

    hasAttemptedAutoConnect.current = true;
    void BleDeviceService.getAll().then((devices) => {
      const device = devices[0];
      if (!device) {
        return;
      }

      void witMotionClient.connect(device.deviceId).catch(() => {
        // Sensor not nearby — silently ignore
      });
    });
  }, [workoutLogId, wit.isConnected]);

  // Watch for connection state changes — show snackbar on connect/disconnect.
  useEffect(() => {
    if (wit.isConnected && !wasConnectedRef.current) {
      wasConnectedRef.current = true;
      const name = wit.connectedDevice?.name ?? '';
      showSnackbar('success', t('workoutSession.sensorConnected', { name }), {
        duration: 20_000,
        secondaryAction: t('workoutSession.disconnect'),
        onSecondaryAction: () => void wit.disconnect(),
      });
    } else if (!wit.isConnected && wasConnectedRef.current) {
      wasConnectedRef.current = false;

      if (isTrackingRef.current) {
        discardTracking();
        showSnackbar('error', t('workoutSession.sensorDisconnectedTracking'), {
          duration: 0,
        });
      } else {
        showSnackbar('error', t('workoutSession.sensorDisconnected'), {
          duration: 3_000,
        });
      }
    }
  }, [wit.isConnected, wit.connectedDevice, showSnackbar, t, wit.disconnect, discardTracking, wit]);

  // Discard tracking when the active set changes (after rest timer / exercise transition).
  useEffect(() => {
    discardTracking();
  }, [currentSetData?.set.id, discardTracking]);

  // Clean up on workout end or unmount.
  useEffect(() => {
    return () => {
      discardTracking();
    };
  }, [discardTracking]);

  return {
    isSensorConnected: wit.isConnected,
    isTracking,
    isStopTrackingSaving,
    // When not tracking the indicator is always solid; when tracking it alternates.
    isTrackingBlinkOn: !isTracking || blinkState,
    startTracking,
    stopTrackingFromButton,
    finishSetRecording,
    attachRecordingToSet,
  };
}
