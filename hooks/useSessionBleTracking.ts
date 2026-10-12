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

type RecordingOwner = {
  setId: string;
  workoutLogId: string;
  exerciseName: string;
  muscleGroup: string;
  equipmentType: string;
  mechanicType: string;
  setNumber: number;
  reps: number;
  deviceId: string;
  deviceDisplayName: string;
};
type SavedSetRecording = { setId: string; uri: string; reps: number };

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
  const ownerRef = useRef<RecordingOwner | null>(null);
  const pendingRecordingRef = useRef<SavedSetRecording | null>(null);
  const savingRef = useRef(false);
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
    pendingRecordingRef.current = null;
    ownerRef.current = null;
    clearTrackingTempFile();
  }, [clearTrackingTempFile]);

  // Stop tracking and save the collected data to a local JSON file.
  const stopTrackingAndSave = useCallback(
    async (logged?: { setId: string; reps: number }) => {
      if (!isTrackingRef.current) {
        return;
      }

      const sampleCount = trackingSampleCountRef.current;
      const tempFile = trackingTempFileRef.current;
      const startedAt = trackingStartedAtRef.current;
      const owner = ownerRef.current;
      ownerRef.current = null;

      setIsTracking(false);
      isTrackingRef.current = false;
      unsubscribeBatchRef.current?.();
      unsubscribeBatchRef.current = null;
      trackingSampleCountRef.current = 0;
      trackingStartedAtRef.current = null;

      if (sampleCount === 0 || !tempFile || !owner) {
        clearTrackingTempFile();
        return;
      }

      savingRef.current = true;
      try {
        const stoppedAt = new Date();
        let recordedReps = owner.reps;
        if (currentSetData?.set.id === owner.setId) {
          recordedReps = reps;
        }
        if (logged?.setId === owner.setId) {
          recordedReps = logged.reps;
        }

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
          workoutLogId: owner.workoutLogId,
          setId: owner.setId,
          exerciseName: owner.exerciseName,
          muscleGroup: owner.muscleGroup,
          equipmentType: owner.equipmentType,
          mechanicType: owner.mechanicType,
          setNumber: owner.setNumber,
          reps: recordedReps,
          deviceId: owner.deviceId,
          deviceDisplayName: owner.deviceDisplayName,
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
          pendingRecordingRef.current = { setId: owner.setId, uri: bleFileUri, reps: recordedReps };
        }

        showSnackbar('success', t('workoutSession.trackingSaved', { count: sampleCount }));
      } catch (err) {
        handleError(err, 'workout-session.stopTrackingAndSave');
      } finally {
        savingRef.current = false;
      }
    },
    [bleGenerateChartPayload, clearTrackingTempFile, currentSetData, reps, showSnackbar, t]
  );

  const startTracking = useCallback(() => {
    if (
      isTrackingRef.current ||
      savingRef.current ||
      !currentSetData ||
      !workoutLog ||
      !wit.connectedDevice
    ) {
      return;
    }

    try {
      clearTrackingTempFile();
      const tempFile = createBleWorkoutTrackingTempFile(randomUUID());
      trackingTempFileRef.current = tempFile;
      trackingSampleCountRef.current = 0;
      pendingRecordingRef.current = null;
      ownerRef.current = {
        setId: currentSetData.set.id,
        workoutLogId: workoutLog.id,
        exerciseName: currentSetData.exercise.name ?? '',
        muscleGroup: currentSetData.exercise.muscleGroup ?? '',
        equipmentType: currentSetData.exercise.equipmentType ?? '',
        mechanicType: currentSetData.exercise.mechanicType ?? '',
        setNumber: currentSetData.setNumber,
        reps,
        deviceId: wit.connectedDevice.id,
        deviceDisplayName: wit.connectedDevice.name,
      };
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
  }, [clearTrackingTempFile, currentSetData, workoutLog, reps, wit.connectedDevice]);

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
  const finishSetRecording = async (setId?: string, loggedReps?: number) => {
    if (isTrackingRef.current) {
      await stopTrackingAndSave(
        setId && loggedReps !== undefined ? { setId, reps: loggedReps } : undefined
      );
    }
    return pendingRecordingRef.current;
  };

  /** Once the set is logged, turns its saved recording into chart data on the set (best effort). */
  const attachRecordingToSet = (setId: string, loggedReps: number) => {
    const recording = pendingRecordingRef.current;
    if (!recording || recording.setId !== setId) {
      return;
    }
    pendingRecordingRef.current = null;
    if (bleGenerateChartPayload && loggedReps > 0) {
      void compressRawToDataPoints(recording.uri, recording.setId, loggedReps).catch(() => {});
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
