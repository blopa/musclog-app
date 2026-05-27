import type { CameraView as CameraViewType } from 'expo-camera';
import { CameraView, useCameraPermissions } from 'expo-camera';
import type { File } from 'expo-file-system';
import {
  copyAsync,
  makeDirectoryAsync,
  readAsStringAsync,
  writeAsStringAsync,
} from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import { Bluetooth, Camera, Circle, Search } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  FlatList,
  PermissionsAndroid,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';

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
} from '@/utils/bleWorkoutDataStorage';
import { showSnackbar } from '@/utils/snackbarService';
import { generateUUID } from '@/utils/uuid';

const EXTERNAL_STORAGE_BASE = 'file:///storage/emulated/0/musclog/';
const MANAGE_EXTERNAL_STORAGE = 'android.permission.MANAGE_EXTERNAL_STORAGE' as Parameters<
  typeof PermissionsAndroid.check
>[0];

interface RecordingEntry {
  sessionId: string;
  exerciseName: string;
  reps: number;
  timestamp: string;
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
  // Same pattern as workout-session.tsx — useWitMotion() directly
  const wit = useWitMotion();

  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  // Camera mounted ONLY on demand — viewfinder is a major battery/heat sink
  const [isCameraEnabled, setIsCameraEnabled] = useState(false);

  // Refs that should not trigger re-renders (mirrors workout-session.tsx tracking refs)
  const cameraRef = useRef<CameraViewType>(null);
  const recordingRef = useRef(false);
  const tempFileRef = useRef<File | null>(null);
  const sampleCountRef = useRef(0);
  const startedAtRef = useRef<number | null>(null);
  const stoppedAtRef = useRef<number | null>(null);
  const recordingPromiseRef = useRef<Promise<{ uri: string } | undefined> | null>(null);
  const unsubscribeBatchRef = useRef<(() => void) | null>(null);

  const [storagePermissionGranted, setStoragePermissionGranted] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [sampleCount, setSampleCount] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [isExercisePickerVisible, setIsExercisePickerVisible] = useState(false);
  const [exerciseSearch, setExerciseSearch] = useState('');
  const [isPreviewVisible, setIsPreviewVisible] = useState(false);
  const [isRepsDialogVisible, setIsRepsDialogVisible] = useState(false);
  const [repsInput, setRepsInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [recordings, setRecordings] = useState<RecordingEntry[]>([]);

  const {
    exercises,
    isLoading: isLoadingExercises,
    isLoadingMore,
    hasMore,
    loadMore,
  } = useExercises({
    visible: isExercisePickerVisible,
    searchTerm: exerciseSearch.trim() || undefined,
    initialLimit: 20,
    batchSize: 20,
    enableReactivity: false,
    sortBy: 'name',
    sortOrder: 'asc',
  });

  const checkStoragePermission = useCallback(async () => {
    const granted = await PermissionsAndroid.check(MANAGE_EXTERNAL_STORAGE);
    setStoragePermissionGranted(granted);
  }, []);

  // BLE permissions on mount
  useEffect(() => {
    void wit.requestPermissions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Storage permission on mount + AppState active (user grants via system settings)
  useEffect(() => {
    void checkStoragePermission();
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') void checkStoragePermission();
    });
    return () => sub.remove();
  }, [checkStoragePermission]);

  // Sample count display ticker — only while recording, reads ref into state
  useEffect(() => {
    if (!isRecording) return;
    const id = setInterval(() => setSampleCount(sampleCountRef.current), 250);
    return () => clearInterval(id);
  }, [isRecording]);

  // Elapsed timer — only while recording
  useEffect(() => {
    if (!isRecording) return;
    const id = setInterval(() => {
      if (startedAtRef.current !== null) {
        setElapsedMs(Date.now() - startedAtRef.current);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [isRecording]);

  const handleGrantStorage = useCallback(async () => {
    await IntentLauncher.startActivityAsync(
      'android.settings.MANAGE_APP_ALL_FILES_ACCESS_PERMISSION',
      { data: 'package:com.werules.logger' }
    );
  }, []);

  const handleExerciseSelect = useCallback((exercise: Exercise) => {
    setSelectedExercise(exercise);
    setIsExercisePickerVisible(false);
    setExerciseSearch('');
  }, []);

  const handleEnableCamera = useCallback(async () => {
    if (!cameraPermission?.granted) {
      const result = await requestCameraPermission();
      if (!result.granted) return;
    }
    setIsCameraEnabled(true);
  }, [cameraPermission?.granted, requestCameraPermission]);

  // Mirrors workout-session.tsx handleStartTracking — sets refs, subscribes onBatch with file streaming
  const handleStart = useCallback(async () => {
    if (!wit.isConnected || !selectedExercise || !cameraRef.current) return;
    if (recordingRef.current) return;

    try {
      const tempFile = createBleWorkoutTrackingTempFile(generateUUID());
      tempFileRef.current = tempFile;
      sampleCountRef.current = 0;
      startedAtRef.current = Date.now();
      stoppedAtRef.current = null;
      recordingRef.current = true;
      setIsRecording(true);
      setSampleCount(0);
      setElapsedMs(0);

      unsubscribeBatchRef.current?.();
      unsubscribeBatchRef.current = witMotionClient.onBatch((batch) => {
        const samples: BleWorkoutSample[] = [];
        for (const packet of batch.packets) {
          if (packet.kind !== 'motion') continue;
          samples.push({
            timestamp: packet.timestamp,
            accel: { ...packet.accel },
            gyro: { ...packet.gyro },
            angle: { ...packet.angle },
          });
        }
        if (samples.length === 0) return;
        sampleCountRef.current += samples.length;
        appendBleWorkoutSamplesToNdjsonFile(tempFile, samples);
      });

      // Do NOT await — resolves only after stopRecording()
      recordingPromiseRef.current = cameraRef.current.recordAsync({ maxDuration: 600 });
    } catch (err) {
      console.error('[reps-recording] handleStart error:', err);
      recordingRef.current = false;
      setIsRecording(false);
    }
  }, [wit.isConnected, selectedExercise]);

  const handleStop = useCallback(async () => {
    if (!recordingRef.current) return;
    recordingRef.current = false;
    stoppedAtRef.current = Date.now();

    unsubscribeBatchRef.current?.();
    unsubscribeBatchRef.current = null;

    cameraRef.current?.stopRecording();
    const result = await recordingPromiseRef.current;
    recordingPromiseRef.current = null;
    setIsRecording(false);
    setVideoUri(result?.uri ?? null);
    setRepsInput('');
    setIsRepsDialogVisible(true);
  }, []);

  const cleanupTempFile = useCallback(() => {
    const f = tempFileRef.current;
    tempFileRef.current = null;
    if (!f) return;
    try {
      f.parentDirectory.delete();
    } catch {
      // best-effort
    }
  }, []);

  const handleSave = useCallback(async () => {
    const reps = parseInt(repsInput, 10);
    if (isNaN(reps) || reps < 0) return;
    if (!storagePermissionGranted) {
      showSnackbar('error', 'Storage permission required — tap Grant Access');
      return;
    }
    if (!videoUri || !selectedExercise || !wit.connectedDevice) return;

    const tempFile = tempFileRef.current;
    if (!tempFile) {
      showSnackbar('error', 'No BLE data recorded');
      return;
    }

    setIsSaving(true);
    try {
      const ndjsonContent = await readAsStringAsync(tempFile.uri);
      const samples = ndjsonContent
        .trim()
        .split('\n')
        .filter((line) => line.trim())
        .map((line) => JSON.parse(line) as BleWorkoutSample);

      const sessionId = Math.random().toString(36).slice(2, 10);
      const baseDir = `${EXTERNAL_STORAGE_BASE}${sessionId}/`;
      await makeDirectoryAsync(baseDir, { intermediates: true });
      await copyAsync({ from: videoUri, to: `${baseDir}video.mp4` });

      const data = {
        version: 1,
        sessionId,
        exerciseId: selectedExercise.id,
        exerciseName: selectedExercise.name,
        muscleGroup: selectedExercise.muscleGroup,
        equipmentType: selectedExercise.equipmentType,
        mechanicType: selectedExercise.mechanicType,
        reps,
        deviceId: wit.connectedDevice.id,
        deviceDisplayName: wit.connectedDevice.name,
        startedAt: new Date(startedAtRef.current!).toISOString(),
        stoppedAt: new Date(stoppedAtRef.current!).toISOString(),
        sampleCount: samples.length,
        samples,
      };
      await writeAsStringAsync(`${baseDir}data.json`, JSON.stringify(data, null, 2));

      cleanupTempFile();
      setRecordings((prev) => [
        ...prev,
        {
          sessionId,
          exerciseName: selectedExercise.name ?? '',
          reps,
          timestamp: new Date().toISOString(),
        },
      ]);
      setIsRepsDialogVisible(false);
      setVideoUri(null);
      showSnackbar('success', `Saved ${sessionId} — ${reps} reps, ${samples.length} samples`);
    } catch (err) {
      console.error('[reps-recording] save error:', err);
      showSnackbar('error', 'Failed to save recording');
    } finally {
      setIsSaving(false);
    }
  }, [
    repsInput,
    storagePermissionGranted,
    videoUri,
    selectedExercise,
    wit.connectedDevice,
    cleanupTempFile,
  ]);

  // Clean up subscription on unmount
  useEffect(() => {
    return () => {
      unsubscribeBatchRef.current?.();
      unsubscribeBatchRef.current = null;
    };
  }, []);

  const canStart =
    wit.isConnected && selectedExercise !== null && !isSaving && isCameraEnabled && !isRecording;

  const statusColor = useMemo(() => {
    if (wit.status === 'connected') return theme.colors.status.success;
    if (wit.status === 'error') return theme.colors.status.error;
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

        {/* Storage permission banner */}
        {!storagePermissionGranted ? (
          <GenericCard variant="default">
            <View
              className="gap-3 p-4"
              style={{ backgroundColor: theme.colors.status.warning + '1A' }}
            >
              <Text
                className="text-sm font-semibold"
                style={{ color: theme.colors.status.warning }}
              >
                External storage access required to save recordings
              </Text>
              <Button
                label="Grant Access"
                size="sm"
                variant="secondary"
                onPress={() => void handleGrantStorage()}
              />
            </View>
          </GenericCard>
        ) : null}

        {/* BLE Sensor card */}
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
                  {sampleCount} samples
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
                <View key={r.sessionId} className="rounded-lg bg-bg-card p-3">
                  <Text className="font-semibold text-text-primary">
                    {r.exerciseName} — {r.reps} reps
                  </Text>
                  <Text className="text-xs text-text-tertiary">
                    {new Date(r.timestamp).toLocaleTimeString()} · {r.sessionId}
                  </Text>
                  <Text
                    className="mt-1 text-xs"
                    style={{ color: theme.colors.text.muted }}
                    numberOfLines={1}
                  >
                    {EXTERNAL_STORAGE_BASE}
                    {r.sessionId}/
                  </Text>
                </View>
              ))
            )}
          </View>
        </GenericCard>
      </ScrollView>

      {/* Preview modal — same pattern as ManageBleDevicesModal: always rendered, visibility controlled */}
      <BleDevicePreviewModal
        visible={isPreviewVisible}
        onClose={() => setIsPreviewVisible(false)}
      />

      {/* Exercise Picker — FullScreenModal for app-consistent styling */}
      <FullScreenModal
        visible={isExercisePickerVisible}
        onClose={() => setIsExercisePickerVisible(false)}
        title="Select Exercise"
        scrollable={false}
      >
        <View className="flex-1 gap-3 p-4">
          <View className="flex-row items-center gap-2 rounded-lg border border-border-light bg-bg-card px-3">
            <Search size={theme.iconSize.md} color={theme.colors.text.tertiary} />
            <TextInput
              value={exerciseSearch}
              onChangeText={setExerciseSearch}
              placeholder="Search exercises…"
              placeholderTextColor={theme.colors.text.tertiary}
              className="flex-1 py-3 text-text-primary"
              style={{ color: theme.colors.text.primary }}
              returnKeyType="search"
            />
          </View>
          {isLoadingExercises ? (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator size="large" color={theme.colors.accent.primary} />
            </View>
          ) : (
            <FlatList
              data={exercises}
              keyExtractor={(item) => item.id}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: 24 }}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => handleExerciseSelect(item)}
                  className="border-b border-border-light px-1 py-3"
                >
                  <Text className="font-medium text-text-primary">{item.name}</Text>
                  <Text className="mt-0.5 text-xs text-text-tertiary">
                    {item.muscleGroup} · {item.equipmentType}
                  </Text>
                </Pressable>
              )}
              ListEmptyComponent={
                <View className="items-center pt-12">
                  <Text className="text-text-tertiary">No exercises found</Text>
                </View>
              }
              ListFooterComponent={
                hasMore ? (
                  <View className="p-4">
                    <Button
                      label={isLoadingMore ? 'Loading…' : 'Load more'}
                      size="sm"
                      variant="secondary"
                      onPress={() => void loadMore()}
                      disabled={isLoadingMore}
                      loading={isLoadingMore}
                    />
                  </View>
                ) : null
              }
            />
          )}
        </View>
      </FullScreenModal>

      {/* Reps Dialog */}
      <FullScreenModal
        visible={isRepsDialogVisible}
        onClose={() => setIsRepsDialogVisible(false)}
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
              onPress={() => setIsRepsDialogVisible(false)}
              disabled={isSaving}
            />
          </View>
        }
      >
        <View className="flex-1 justify-center gap-6 p-6">
          <Text className="text-center text-text-secondary">{selectedExercise?.name ?? ''}</Text>
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
