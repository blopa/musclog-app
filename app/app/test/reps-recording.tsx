import type { CameraView as CameraViewType } from 'expo-camera';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { copyAsync, makeDirectoryAsync, writeAsStringAsync } from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  FlatList,
  Modal,
  PermissionsAndroid,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';

import { MasterLayout } from '@/components/MasterLayout';
import { Button } from '@/components/theme/Button';
import type Exercise from '@/database/models/Exercise';
import type { WitMotionVector3 } from '@/modules/witmotion-ble';
import { useWitMotion, witMotionClient } from '@/modules/witmotion-ble';
import { useExercises } from '@/hooks/useExercises';
import { showSnackbar } from '@/utils/snackbarService';

const EXTERNAL_STORAGE_BASE = 'file:///storage/emulated/0/musclog/';
const MANAGE_EXTERNAL_STORAGE = 'android.permission.MANAGE_EXTERNAL_STORAGE' as Parameters<
  typeof PermissionsAndroid.check
>[0];

interface MotionSample {
  timestamp: number;
  accel: WitMotionVector3;
  gyro: WitMotionVector3;
  angle: WitMotionVector3;
}

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
  const wit = useWitMotion();
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  const cameraRef = useRef<CameraViewType>(null);
  const recordingRef = useRef(false);
  const samplesRef = useRef<MotionSample[]>([]);
  const startedAtRef = useRef<number | null>(null);
  const stoppedAtRef = useRef<number | null>(null);
  const recordingPromiseRef = useRef<Promise<{ uri: string } | undefined> | null>(null);

  const [storagePermissionGranted, setStoragePermissionGranted] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [sampleCount, setSampleCount] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [isExercisePickerVisible, setIsExercisePickerVisible] = useState(false);
  const [exerciseSearch, setExerciseSearch] = useState('');
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

  // Camera permission on mount
  useEffect(() => {
    if (!cameraPermission?.granted) {
      void requestCameraPermission();
    }
  }, [cameraPermission?.granted, requestCameraPermission]);

  // BLE permissions on mount
  useEffect(() => {
    void wit.requestPermissions();
  }, [wit.requestPermissions]);

  // Storage permission on mount + AppState active
  useEffect(() => {
    const timeout = setTimeout(() => {
      void checkStoragePermission();
    }, 0);
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') {
        void checkStoragePermission();
      }
    });
    return () => {
      clearTimeout(timeout);
      sub.remove();
    };
  }, [checkStoragePermission]);

  // BLE batch subscription — always active, writes only when recording
  useEffect(() => {
    return witMotionClient.onBatch((batch) => {
      if (!recordingRef.current) {
        return;
      }
      for (const packet of batch.packets) {
        if (packet.kind !== 'motion') {
          continue;
        }
        samplesRef.current.push({
          timestamp: packet.timestamp,
          accel: { x: packet.accel.x, y: packet.accel.y, z: packet.accel.z },
          gyro: { x: packet.gyro.x, y: packet.gyro.y, z: packet.gyro.z },
          angle: { x: packet.angle.x, y: packet.angle.y, z: packet.angle.z },
        });
      }
    });
  }, []);

  // Sample count display ticker — only while recording
  useEffect(() => {
    if (!isRecording) {
      return;
    }
    const id = setInterval(() => setSampleCount(samplesRef.current.length), 200);
    return () => clearInterval(id);
  }, [isRecording]);

  // Elapsed timer — only while recording
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

  const handleOpenExercisePicker = useCallback(() => {
    setExerciseSearch('');
    setIsExercisePickerVisible(true);
  }, []);

  const handleStart = useCallback(async () => {
    if (!wit.isConnected || !selectedExercise || !cameraRef.current) {
      return;
    }
    samplesRef.current = [];
    startedAtRef.current = Date.now();
    stoppedAtRef.current = null;
    recordingRef.current = true;
    setIsRecording(true);
    setSampleCount(0);
    setElapsedMs(0);
    // Do NOT await — resolves only after stopRecording()
    recordingPromiseRef.current = cameraRef.current.recordAsync({ maxDuration: 600 });
  }, [wit.isConnected, selectedExercise]);

  const handleStop = useCallback(async () => {
    recordingRef.current = false;
    stoppedAtRef.current = Date.now();
    cameraRef.current?.stopRecording();
    const result = await recordingPromiseRef.current;
    recordingPromiseRef.current = null;
    setIsRecording(false);
    setVideoUri(result?.uri ?? null);
    setRepsInput('');
    setIsRepsDialogVisible(true);
  }, []);

  const handleSave = useCallback(async () => {
    const reps = parseInt(repsInput, 10);
    if (isNaN(reps) || reps < 0) {
      return;
    }
    if (!storagePermissionGranted) {
      showSnackbar('error', 'Storage permission required — tap Grant Access');
      return;
    }
    if (!videoUri || !selectedExercise || !wit.connectedDevice) {
      return;
    }
    setIsSaving(true);
    try {
      const sessionId = Math.random().toString(36).slice(2, 10);
      const baseDir = `${EXTERNAL_STORAGE_BASE}${sessionId}/`;
      await makeDirectoryAsync(baseDir, { intermediates: true });
      await copyAsync({ from: videoUri, to: `${baseDir}video.mp4` });
      const samples = samplesRef.current;
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
  }, [repsInput, storagePermissionGranted, videoUri, selectedExercise, wit.connectedDevice]);

  const canStart = wit.isConnected && selectedExercise !== null && !isSaving;

  return (
    <MasterLayout>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#fff', marginBottom: 4 }}>
          Reps Recording
        </Text>
        <Text style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>
          Training data collector — BLE + video synchronized
        </Text>

        {/* Storage permission banner */}
        {!storagePermissionGranted ? (
          <View style={{ backgroundColor: '#7a5c00', borderRadius: 10, padding: 12, gap: 8 }}>
            <Text style={{ color: '#ffd700', fontWeight: '600' }}>
              External storage access required to save recordings
            </Text>
            <Button
              label="Grant Access"
              onPress={() => void handleGrantStorage()}
              variant="outline"
            />
          </View>
        ) : null}

        {/* BLE Mini Manager */}
        <View style={{ backgroundColor: '#111', borderRadius: 12, padding: 14, gap: 10 }}>
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>BLE Sensor</Text>

          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            <Text style={{ color: '#aaa', fontSize: 12 }}>
              Status:{' '}
              <Text
                style={{
                  color:
                    wit.status === 'connected'
                      ? '#4caf50'
                      : wit.status === 'error'
                        ? '#f44336'
                        : '#ffaa00',
                  fontWeight: '600',
                }}
              >
                {wit.status}
              </Text>
            </Text>
            <Text style={{ color: '#aaa', fontSize: 12 }}>
              BT: <Text style={{ color: '#ccc' }}>{wit.bleState}</Text>
            </Text>
          </View>

          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Button
                label={wit.isScanning ? 'Scanning…' : 'Scan'}
                onPress={() => void wit.startScan()}
                disabled={wit.isScanning || wit.isConnected}
                variant="outline"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                label="Disconnect"
                onPress={() => void wit.disconnect()}
                disabled={!wit.isConnected}
                variant="discard"
              />
            </View>
          </View>

          {/* Discovered devices */}
          {wit.discoveredDevices.length > 0 ? (
            <View style={{ gap: 4 }}>
              <Text style={{ color: '#888', fontSize: 11 }}>Discovered devices</Text>
              {wit.discoveredDevices.map((device) => (
                <Pressable
                  key={device.id}
                  onPress={() => void wit.connect(device)}
                  style={({ pressed }) => ({
                    backgroundColor: pressed ? '#1e3a2f' : '#1a1a1a',
                    borderRadius: 8,
                    padding: 10,
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  })}
                >
                  <Text style={{ color: '#fff', fontSize: 13 }}>{device.name ?? 'Unknown'}</Text>
                  <Text style={{ color: '#666', fontSize: 11 }}>{device.id}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          {/* Live data preview */}
          {wit.liveData.accel ? (
            <Text style={{ color: '#4caf50', fontSize: 11, fontVariant: ['tabular-nums'] }}>
              accel x={wit.liveData.accel.x.toFixed(3)} y={wit.liveData.accel.y.toFixed(3)} z=
              {wit.liveData.accel.z.toFixed(3)}
            </Text>
          ) : (
            <Text style={{ color: '#555', fontSize: 11 }}>No live data</Text>
          )}

          {wit.connectedDevice ? (
            <Text style={{ color: '#aaa', fontSize: 11 }}>
              Connected: {wit.connectedDevice.name} ({wit.connectedDevice.id})
            </Text>
          ) : null}
        </View>

        {/* Exercise + Controls */}
        <View style={{ backgroundColor: '#111', borderRadius: 12, padding: 14, gap: 10 }}>
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Exercise</Text>

          <Text style={{ color: selectedExercise ? '#fff' : '#555', fontSize: 14 }}>
            {selectedExercise?.name ?? 'No exercise selected'}
          </Text>

          <Button label="Select Exercise" onPress={handleOpenExercisePicker} variant="secondary" />

          <Button
            label={isRecording ? '■  STOP' : '●  START'}
            onPress={isRecording ? () => void handleStop() : () => void handleStart()}
            disabled={!canStart}
            variant={isRecording ? 'discard' : 'accent'}
          />

          {!wit.isConnected ? (
            <Text style={{ color: '#888', fontSize: 11 }}>
              Connect a BLE device to enable recording
            </Text>
          ) : null}
          {!selectedExercise && wit.isConnected ? (
            <Text style={{ color: '#888', fontSize: 11 }}>
              Select an exercise to enable recording
            </Text>
          ) : null}
        </View>

        {/* Camera Preview */}
        <View style={{ backgroundColor: '#111', borderRadius: 12, padding: 14, gap: 10 }}>
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Camera</Text>

          <View
            style={{ height: 300, borderRadius: 10, overflow: 'hidden', backgroundColor: '#000' }}
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
                style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
              >
                <Text style={{ color: '#aaa' }}>Tap to grant camera permission</Text>
              </Pressable>
            )}
          </View>

          {isRecording ? (
            <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}>
              <Text style={{ color: '#f44336', fontWeight: '700', fontSize: 14 }}>● REC</Text>
              <Text style={{ color: '#ccc', fontSize: 13, fontVariant: ['tabular-nums'] }}>
                {sampleCount} samples
              </Text>
              <Text style={{ color: '#ccc', fontSize: 13, fontVariant: ['tabular-nums'] }}>
                {formatElapsed(elapsedMs)}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Recordings list */}
        <View style={{ backgroundColor: '#111', borderRadius: 12, padding: 14, gap: 8 }}>
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>
            This Session ({recordings.length})
          </Text>

          {recordings.length === 0 ? (
            <Text style={{ color: '#555', fontSize: 13 }}>No recordings yet</Text>
          ) : (
            recordings.map((r) => (
              <View
                key={r.sessionId}
                style={{ backgroundColor: '#1a1a1a', borderRadius: 8, padding: 10, gap: 2 }}
              >
                <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>
                  {r.exerciseName} — {r.reps} reps
                </Text>
                <Text style={{ color: '#888', fontSize: 11 }}>
                  {new Date(r.timestamp).toLocaleTimeString()} · {r.sessionId}
                </Text>
                <Text style={{ color: '#555', fontSize: 10 }} numberOfLines={1}>
                  {EXTERNAL_STORAGE_BASE}
                  {r.sessionId}/
                </Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Exercise Picker Modal */}
      <Modal
        visible={isExercisePickerVisible}
        animationType="slide"
        onRequestClose={() => setIsExercisePickerVisible(false)}
      >
        <View style={{ flex: 1, backgroundColor: '#0d0d0d' }}>
          {/* Header */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              padding: 16,
              paddingTop: 56,
              gap: 12,
              borderBottomWidth: 1,
              borderBottomColor: '#222',
            }}
          >
            <TextInput
              value={exerciseSearch}
              onChangeText={setExerciseSearch}
              placeholder="Search exercises…"
              placeholderTextColor="#555"
              style={{
                flex: 1,
                backgroundColor: '#1a1a1a',
                color: '#fff',
                borderRadius: 10,
                paddingHorizontal: 14,
                paddingVertical: 10,
                fontSize: 15,
                borderWidth: 1,
                borderColor: '#333',
              }}
              autoFocus
              returnKeyType="search"
            />
            <Pressable
              onPress={() => setIsExercisePickerVisible(false)}
              style={{ paddingHorizontal: 8, paddingVertical: 10 }}
            >
              <Text style={{ color: '#4caf50', fontSize: 15, fontWeight: '600' }}>Cancel</Text>
            </Pressable>
          </View>

          {/* Exercise list */}
          {isLoadingExercises ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator size="large" color="#4caf50" />
            </View>
          ) : (
            <FlatList
              data={exercises}
              keyExtractor={(item) => item.id}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => handleExerciseSelect(item)}
                  style={({ pressed }) => ({
                    backgroundColor: pressed ? '#1e3a2f' : 'transparent',
                    paddingHorizontal: 16,
                    paddingVertical: 14,
                    borderBottomWidth: 1,
                    borderBottomColor: '#1a1a1a',
                  })}
                >
                  <Text style={{ color: '#fff', fontSize: 15 }}>{item.name}</Text>
                  <Text style={{ color: '#666', fontSize: 12, marginTop: 2 }}>
                    {item.muscleGroup} · {item.equipmentType}
                  </Text>
                </Pressable>
              )}
              ListEmptyComponent={
                <View style={{ alignItems: 'center', paddingTop: 60 }}>
                  <Text style={{ color: '#555', fontSize: 14 }}>No exercises found</Text>
                </View>
              }
              ListFooterComponent={
                hasMore ? (
                  <View style={{ padding: 16 }}>
                    <Button
                      label={isLoadingMore ? 'Loading…' : 'Load more'}
                      onPress={() => void loadMore()}
                      variant="outline"
                      disabled={isLoadingMore}
                      loading={isLoadingMore}
                    />
                  </View>
                ) : null
              }
            />
          )}
        </View>
      </Modal>

      {/* Reps Dialog */}
      <Modal visible={isRepsDialogVisible} transparent animationType="fade">
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.75)',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}
        >
          <View
            style={{
              backgroundColor: '#1a1a1a',
              borderRadius: 16,
              padding: 24,
              width: '100%',
              gap: 16,
            }}
          >
            <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700' }}>How many reps?</Text>

            <TextInput
              value={repsInput}
              onChangeText={setRepsInput}
              keyboardType="number-pad"
              placeholder="e.g. 10"
              placeholderTextColor="#555"
              style={{
                backgroundColor: '#111',
                color: '#fff',
                borderRadius: 10,
                padding: 14,
                fontSize: 20,
                fontWeight: '600',
                textAlign: 'center',
                borderWidth: 1,
                borderColor: '#333',
              }}
              autoFocus
            />

            <Button
              label="Save"
              onPress={() => void handleSave()}
              disabled={isSaving || !repsInput}
            />
            <Button
              label="Cancel"
              onPress={() => setIsRepsDialogVisible(false)}
              variant="secondary"
              disabled={isSaving}
            />
          </View>
        </View>
      </Modal>
      <View pointerEvents="none" style={{ height: 160 }} />
    </MasterLayout>
  );
}
