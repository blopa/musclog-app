import type { CameraView as CameraViewType } from 'expo-camera';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { copyAsync } from 'expo-file-system/legacy';
import { Bluetooth, Camera, Circle, Search } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { GenericCard } from '@/components/cards/GenericCard';
import { MasterLayout } from '@/components/MasterLayout';
import { BleDevicePreviewModal } from '@/components/modals/BleDevicePreviewModal';
import { FullScreenModal } from '@/components/modals/FullScreenModal';
import { Button } from '@/components/theme/Button';
import type Exercise from '@/database/models/Exercise';
import { useExercises } from '@/hooks/useExercises';
import { useTheme } from '@/hooks/useTheme';
import { useWitMotion, witMotionClient } from '@/modules/witmotion-ble';
import {
  appendBleWorkoutSamplesToNdjsonFile,
  type BleWorkoutSample,
  createBleWorkoutTrackingTempFile,
  saveBleWorkoutFile,
} from '@/utils/bleWorkoutDataStorage';
import { showSnackbar } from '@/utils/snackbarService';
import { generateUUID } from '@/utils/uuid';

// Isolated component — useExercises re-renders don't affect the parent screen
function ExercisePickerModal({
  visible,
  onClose,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  onSelect: (exercise: Exercise) => void;
}) {
  const theme = useTheme();
  const [searchQuery, setSearchQuery] = useState('');

  const handleClose = useCallback(() => {
    setSearchQuery('');
    onClose();
  }, [onClose]);

  const { exercises, isLoading, isLoadingMore, hasMore, loadMore } = useExercises({
    visible,
    enableReactivity: true,
    sortBy: 'name',
    sortOrder: 'asc',
    searchTerm: searchQuery.trim() || undefined,
    initialLimit: 20,
    batchSize: 20,
  });

  return (
    <FullScreenModal
      visible={visible}
      onClose={handleClose}
      title="Select Exercise"
      scrollable={true}
    >
      <View className="px-4 py-3">
        <View className="mb-4 flex-row items-center gap-2 rounded-lg border border-border-light bg-bg-card px-3">
          <Search size={theme.iconSize.md} color={theme.colors.text.tertiary} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search exercises…"
            placeholderTextColor={theme.colors.text.tertiary}
            returnKeyType="search"
            style={{ flex: 1, paddingVertical: 12, color: theme.colors.text.primary }}
          />
        </View>

        {isLoading && exercises.length === 0 ? (
          <View className="items-center justify-center py-16">
            <ActivityIndicator size="large" color={theme.colors.accent.primary} />
          </View>
        ) : exercises.length === 0 ? (
          <View className="items-center justify-center py-16">
            <Text className="text-text-tertiary">No exercises found</Text>
          </View>
        ) : (
          <>
            {exercises.map((item) => (
              <Pressable
                key={item.id}
                onPress={() => onSelect(item)}
                className="border-b border-border-light py-3"
              >
                <Text className="font-medium text-text-primary">{item.name}</Text>
                <Text className="mt-0.5 text-xs text-text-tertiary">
                  {item.muscleGroup} · {item.equipmentType}
                </Text>
              </Pressable>
            ))}
            {hasMore ? (
              <View className="py-4">
                <Button
                  label={isLoadingMore ? 'Loading…' : 'Load more'}
                  size="sm"
                  variant="secondary"
                  onPress={() => void loadMore()}
                  disabled={isLoadingMore}
                  loading={isLoadingMore}
                />
              </View>
            ) : null}
          </>
        )}
      </View>
    </FullScreenModal>
  );
}

interface RecordingEntry {
  id: string;
  exerciseName: string;
  reps: number;
  timestamp: string;
  jsonUri: string;
  videoUri: string;
}

function formatElapsed(ms: number): string {
  const totalSecs = Math.floor(ms / 1000);
  const m = Math.floor(totalSecs / 60)
    .toString()
    .padStart(2, '0');
  const s = (totalSecs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export default function RepsRecordingScreen() {
  const theme = useTheme();
  const wit = useWitMotion();

  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [isCameraEnabled, setIsCameraEnabled] = useState(false);

  const cameraRef = useRef<CameraViewType>(null);
  const recordingRef = useRef(false);
  const tempFileRef = useRef<ReturnType<typeof createBleWorkoutTrackingTempFile> | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const stoppedAtRef = useRef<number | null>(null);
  const recordingPromiseRef = useRef<Promise<{ uri: string } | undefined> | null>(null);
  const unsubscribeBatchRef = useRef<(() => void) | null>(null);
  const sampleCountRef = useRef(0);
  const capturedDeviceRef = useRef<{ id: string; name: string } | null>(null);
  const capturedExerciseRef = useRef<Exercise | null>(null);

  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [capturedExerciseName, setCapturedExerciseName] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [isExercisePickerVisible, setIsExercisePickerVisible] = useState(false);
  const [isPreviewVisible, setIsPreviewVisible] = useState(false);
  const [isRepsDialogVisible, setIsRepsDialogVisible] = useState(false);
  const [repsInput, setRepsInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [recordings, setRecordings] = useState<RecordingEntry[]>([]);

  useEffect(() => {
    void wit.requestPermissions();
  }, [wit.requestPermissions]);

  // Elapsed timer — independent 1s interval, no BLE involvement
  useEffect(() => {
    if (!isRecording) {
      return;
    }
    const id = setInterval(() => {
      if (startedAtRef.current !== null) {
        setElapsedMs(Date.now() - startedAtRef.current);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [isRecording]);

  const handleExerciseSelect = useCallback((exercise: Exercise) => {
    setSelectedExercise(exercise);
    setIsExercisePickerVisible(false);
  }, []);

  const handleEnableCamera = useCallback(async () => {
    if (!cameraPermission?.granted) {
      const result = await requestCameraPermission();
      if (!result.granted) {
        return;
      }
    }
    setIsCameraEnabled(true);
  }, [cameraPermission?.granted, requestCameraPermission]);

  const clearCapturedRecordingRefs = useCallback((deleteTempFile: boolean) => {
    const tempFile = tempFileRef.current;

    tempFileRef.current = null;
    startedAtRef.current = null;
    stoppedAtRef.current = null;
    sampleCountRef.current = 0;
    capturedDeviceRef.current = null;
    capturedExerciseRef.current = null;
    setCapturedExerciseName('');
    recordingPromiseRef.current = null;
    unsubscribeBatchRef.current?.();
    unsubscribeBatchRef.current = null;

    if (!deleteTempFile || !tempFile) {
      return;
    }

    try {
      tempFile.parentDirectory.delete();
    } catch {
      try {
        tempFile.delete();
      } catch {
        // Best-effort cleanup only.
      }
    }
  }, []);

  const handleStart = useCallback(async () => {
    if (!wit.isConnected || !selectedExercise || !cameraRef.current) {
      return;
    }
    if (recordingRef.current) {
      return;
    }

    try {
      const tempFile = createBleWorkoutTrackingTempFile(generateUUID());
      tempFileRef.current = tempFile;
      sampleCountRef.current = 0;
      // Capture device + exercise at start — save doesn't depend on live state
      capturedDeviceRef.current = wit.connectedDevice
        ? { id: wit.connectedDevice.id, name: wit.connectedDevice.name }
        : null;
      capturedExerciseRef.current = selectedExercise;
      setCapturedExerciseName(selectedExercise.name ?? '');
      startedAtRef.current = Date.now();
      stoppedAtRef.current = null;
      recordingRef.current = true;
      setIsRecording(true);
      setElapsedMs(0);

      unsubscribeBatchRef.current?.();
      unsubscribeBatchRef.current = witMotionClient.onBatch((batch) => {
        const samples: BleWorkoutSample[] = [];
        for (const packet of batch.packets) {
          if (packet.kind !== 'motion') {
            continue;
          }
          samples.push({
            timestamp: packet.timestamp,
            accel: { ...packet.accel },
            gyro: { ...packet.gyro },
            angle: { ...packet.angle },
          });
        }
        if (samples.length > 0) {
          sampleCountRef.current += samples.length;
          appendBleWorkoutSamplesToNdjsonFile(tempFile, samples);
        }
      });

      // Do NOT await — resolves only after stopRecording()
      recordingPromiseRef.current = cameraRef.current.recordAsync({ maxDuration: 600 });
    } catch (err) {
      console.error('[reps-recording] handleStart error:', err);
      recordingRef.current = false;
      setIsRecording(false);
      clearCapturedRecordingRefs(true);
    }
  }, [selectedExercise, wit.connectedDevice, wit.isConnected]);

  const handleStop = useCallback(async () => {
    if (!recordingRef.current) {
      return;
    }
    recordingRef.current = false;
    stoppedAtRef.current = Date.now();

    unsubscribeBatchRef.current?.();
    unsubscribeBatchRef.current = null;

    cameraRef.current?.stopRecording();
    const result = await recordingPromiseRef.current;
    recordingPromiseRef.current = null;
    setIsRecording(false);
    if (!result?.uri) {
      setVideoUri(null);
      clearCapturedRecordingRefs(true);
      showSnackbar('error', 'Failed to capture video');
      return;
    }

    setVideoUri(result.uri);
    setRepsInput('');
    setIsRepsDialogVisible(true);
  }, [clearCapturedRecordingRefs]);

  const handleSave = useCallback(async () => {
    const reps = parseInt(repsInput, 10);
    if (isNaN(reps) || reps < 0) {
      return;
    }

    const exercise = capturedExerciseRef.current;
    const device = capturedDeviceRef.current;
    const tempFile = tempFileRef.current;
    const startedAt = startedAtRef.current;
    const stoppedAt = stoppedAtRef.current;
    const sampleCount = sampleCountRef.current;

    if (
      !videoUri ||
      !exercise ||
      !device ||
      !tempFile ||
      startedAt === null ||
      stoppedAt === null
    ) {
      showSnackbar('error', 'Missing recording data');
      return;
    }

    setIsSaving(true);
    try {
      const savedJsonUri = await saveBleWorkoutFile({
        version: 1,
        workoutLogId: generateUUID(),
        exerciseName: exercise.name ?? '',
        muscleGroup: exercise.muscleGroup ?? '',
        equipmentType: exercise.equipmentType ?? '',
        mechanicType: exercise.mechanicType ?? '',
        setNumber: 1,
        reps,
        deviceId: device.id,
        deviceDisplayName: device.name,
        startedAt: new Date(startedAt).toISOString(),
        stoppedAt: new Date(stoppedAt).toISOString(),
        sampleCount,
        samplesFile: tempFile,
      });

      const savedVideoUri = savedJsonUri.replace(/\.json$/i, '.mp4');
      await copyAsync({ from: videoUri, to: savedVideoUri });

      setRecordings((prev) => [
        ...prev,
        {
          id: savedJsonUri.slice(savedJsonUri.lastIndexOf('/') + 1).replace(/\.json$/i, ''),
          exerciseName: exercise.name ?? '',
          reps,
          timestamp: new Date().toISOString(),
          jsonUri: savedJsonUri,
          videoUri: savedVideoUri,
        },
      ]);
      setIsRepsDialogVisible(false);
      setVideoUri(null);
      setRepsInput('');
      clearCapturedRecordingRefs(false);
      showSnackbar('success', `Saved recording — ${reps} reps, ${sampleCount} samples`);
    } catch (err) {
      console.error('[reps-recording] save error:', err);
      showSnackbar('error', 'Failed to save recording');
    } finally {
      setIsSaving(false);
    }
  }, [clearCapturedRecordingRefs, repsInput, videoUri]);

  const handleDismissRepsDialog = useCallback(() => {
    setIsRepsDialogVisible(false);
    setVideoUri(null);
    clearCapturedRecordingRefs(true);
  }, [clearCapturedRecordingRefs]);

  useEffect(() => {
    return () => {
      clearCapturedRecordingRefs(true);
    };
  }, [clearCapturedRecordingRefs]);

  const canStart =
    wit.isConnected && selectedExercise !== null && !isSaving && isCameraEnabled && !isRecording;

  const statusColor = useMemo(() => {
    if (wit.status === 'connected') {
      return theme.colors.status.success;
    }
    if (wit.status === 'error') {
      return theme.colors.status.error;
    }
    return theme.colors.status.warning;
  }, [wit.status, theme]);

  return (
    <MasterLayout>
      <ScrollView
        className="flex-1 bg-bg-primary"
        contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 80 }}
      >
        <View>
          <Text className="text-2xl font-bold text-text-primary">Reps Recording</Text>
          <Text className="mt-1 text-xs text-text-tertiary">
            Training data collector — BLE + video synchronized
          </Text>
        </View>

        {/* BLE Sensor */}
        <GenericCard variant="default">
          <View className="gap-3 p-4">
            <View className="flex-row items-center gap-3">
              <View className="h-10 w-10 items-center justify-center rounded-lg bg-bg-card">
                <Bluetooth size={theme.iconSize.md} color={statusColor} />
              </View>
              <View className="flex-1">
                <Text className="font-semibold text-text-primary">BLE Sensor</Text>
                <Text className="text-xs text-text-tertiary">
                  {wit.status} · BT: {wit.bleState}
                </Text>
              </View>
            </View>

            <View className="flex-row flex-wrap gap-2">
              <Button
                label={wit.isScanning ? 'Scanning…' : 'Scan'}
                size="xs"
                variant="secondary"
                loading={wit.isScanning}
                disabled={wit.isScanning || wit.isConnected}
                onPress={() => void wit.startScan()}
              />
              {wit.isConnected ? (
                <>
                  <Button
                    label="Disconnect"
                    size="xs"
                    variant="discard"
                    onPress={() => void wit.disconnect()}
                  />
                  <Button
                    label="Preview Data"
                    size="xs"
                    variant="secondary"
                    onPress={() => setIsPreviewVisible(true)}
                  />
                </>
              ) : null}
            </View>

            {wit.connectedDevice ? (
              <Text className="text-xs text-text-tertiary">
                Connected: {wit.connectedDevice.name} ({wit.connectedDevice.id})
              </Text>
            ) : null}

            {wit.discoveredDevices.length > 0 && !wit.isConnected ? (
              <View className="gap-2">
                <Text className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">
                  Discovered
                </Text>
                {wit.discoveredDevices.map((device) => (
                  <Pressable
                    key={device.id}
                    onPress={() => void wit.connect(device)}
                    className="flex-row items-center justify-between rounded-lg bg-bg-card p-3"
                  >
                    <Text className="font-medium text-text-primary">
                      {device.name ?? 'Unknown'}
                    </Text>
                    <Text className="text-xs text-text-tertiary">{device.id}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}

            {wit.error ? (
              <Text className="text-xs" style={{ color: theme.colors.status.error }}>
                {wit.error}
              </Text>
            ) : null}
          </View>
        </GenericCard>

        {/* Exercise + Controls */}
        <GenericCard variant="default">
          <View className="gap-3 p-4">
            <Text className="font-semibold text-text-primary">Exercise</Text>
            <Text
              className={
                selectedExercise
                  ? 'text-base text-text-primary'
                  : 'text-base italic text-text-tertiary'
              }
            >
              {selectedExercise?.name ?? 'No exercise selected'}
            </Text>
            <Button
              label="Select Exercise"
              size="sm"
              variant="secondary"
              onPress={() => setIsExercisePickerVisible(true)}
            />

            {isRecording ? (
              <Button
                label="STOP"
                size="md"
                width="full"
                variant="discard"
                icon={
                  <Circle
                    size={theme.iconSize.sm}
                    color={theme.colors.text.white}
                    fill={theme.colors.text.white}
                  />
                }
                onPress={() => void handleStop()}
              />
            ) : (
              <Button
                label="START"
                size="md"
                width="full"
                variant="accent"
                disabled={!canStart}
                onPress={() => void handleStart()}
              />
            )}

            {!wit.isConnected ? (
              <Text className="text-xs text-text-tertiary">
                Connect a BLE device to enable recording
              </Text>
            ) : null}
            {!selectedExercise && wit.isConnected ? (
              <Text className="text-xs text-text-tertiary">
                Select an exercise to enable recording
              </Text>
            ) : null}
            {!isCameraEnabled && wit.isConnected && selectedExercise ? (
              <Text className="text-xs text-text-tertiary">
                Enable the camera below to start recording
              </Text>
            ) : null}
          </View>
        </GenericCard>

        {/* Camera */}
        <GenericCard variant="default">
          <View className="gap-3 p-4">
            <View className="flex-row items-center justify-between">
              <Text className="font-semibold text-text-primary">Camera</Text>
              {isCameraEnabled && !isRecording ? (
                <Pressable onPress={() => setIsCameraEnabled(false)}>
                  <Text className="text-xs text-text-tertiary">Disable</Text>
                </Pressable>
              ) : null}
            </View>

            {isCameraEnabled ? (
              <View
                style={{
                  height: 300,
                  borderRadius: theme.borderRadius.lg,
                  overflow: 'hidden',
                  backgroundColor: '#000',
                }}
              >
                {cameraPermission?.granted ? (
                  <CameraView
                    ref={cameraRef}
                    style={{ flex: 1 }}
                    mode="video"
                    facing="back"
                    videoQuality="720p"
                  />
                ) : (
                  <Pressable
                    onPress={() => void requestCameraPermission()}
                    className="flex-1 items-center justify-center"
                  >
                    <Text className="text-text-tertiary">Tap to grant camera permission</Text>
                  </Pressable>
                )}
              </View>
            ) : (
              <Pressable
                onPress={() => void handleEnableCamera()}
                className="items-center justify-center rounded-lg border border-dashed py-8"
                style={{ borderColor: theme.colors.border.light, gap: 8 }}
              >
                <Camera size={theme.iconSize.lg} color={theme.colors.accent.primary} />
                <Text className="font-semibold" style={{ color: theme.colors.accent.primary }}>
                  Enable Camera
                </Text>
                <Text className="text-xs text-text-tertiary">
                  Tap to activate — off to save battery
                </Text>
              </Pressable>
            )}

            {isRecording ? (
              <View className="flex-row items-center gap-4 rounded-lg bg-bg-card p-3">
                <Text className="font-bold" style={{ color: theme.colors.status.error }}>
                  ● REC
                </Text>
                <Text className="text-text-secondary" style={{ fontVariant: ['tabular-nums'] }}>
                  {formatElapsed(elapsedMs)}
                </Text>
              </View>
            ) : null}
          </View>
        </GenericCard>

        {/* This Session */}
        <GenericCard variant="default">
          <View className="gap-2 p-4">
            <Text className="font-semibold text-text-primary">
              This Session ({recordings.length})
            </Text>
            {recordings.length === 0 ? (
              <Text className="text-sm text-text-tertiary">No recordings yet</Text>
            ) : (
              recordings.map((r) => (
                <View key={r.id} className="rounded-lg bg-bg-card p-3">
                  <Text className="font-semibold text-text-primary">
                    {r.exerciseName} — {r.reps} reps
                  </Text>
                  <Text className="text-xs text-text-tertiary">
                    {new Date(r.timestamp).toLocaleTimeString()} · {r.id}
                  </Text>
                  <Text
                    className="mt-1 text-xs"
                    style={{ color: theme.colors.text.muted }}
                    numberOfLines={1}
                  >
                    JSON: {r.jsonUri}
                  </Text>
                  <Text
                    className="mt-1 text-xs"
                    style={{ color: theme.colors.text.muted }}
                    numberOfLines={1}
                  >
                    Video: {r.videoUri}
                  </Text>
                </View>
              ))
            )}
          </View>
        </GenericCard>
      </ScrollView>

      <BleDevicePreviewModal
        visible={isPreviewVisible}
        onClose={() => setIsPreviewVisible(false)}
      />

      <ExercisePickerModal
        visible={isExercisePickerVisible}
        onClose={() => setIsExercisePickerVisible(false)}
        onSelect={handleExerciseSelect}
      />

      <FullScreenModal
        visible={isRepsDialogVisible}
        onClose={handleDismissRepsDialog}
        title="How many reps?"
        scrollable={false}
        footer={
          <View className="gap-2">
            <Button
              label="Save"
              size="md"
              width="full"
              variant="accent"
              onPress={() => void handleSave()}
              disabled={isSaving || !repsInput}
              loading={isSaving}
            />
            <Button
              label="Cancel"
              size="md"
              width="full"
              variant="secondary"
              onPress={handleDismissRepsDialog}
              disabled={isSaving}
            />
          </View>
        }
      >
        <View className="flex-1 justify-center gap-6 p-6">
          <Text className="text-center text-text-secondary">
            {capturedExerciseName || selectedExercise?.name || ''}
          </Text>
          <TextInput
            value={repsInput}
            onChangeText={setRepsInput}
            keyboardType="number-pad"
            placeholder="e.g. 10"
            placeholderTextColor={theme.colors.text.tertiary}
            autoFocus
            style={{
              backgroundColor: theme.colors.background.card,
              color: theme.colors.text.primary,
              borderRadius: theme.borderRadius.lg,
              padding: 14,
              fontSize: 24,
              fontWeight: '600',
              textAlign: 'center',
              borderWidth: 1,
              borderColor: theme.colors.border.light,
            }}
          />
        </View>
      </FullScreenModal>

      <View pointerEvents="none" style={{ height: 120 }} />
    </MasterLayout>
  );
}
