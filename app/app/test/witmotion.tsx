import {
  cacheDirectory,
  deleteAsync,
  documentDirectory,
  makeDirectoryAsync,
  readAsStringAsync,
  readDirectoryAsync,
  writeAsStringAsync,
} from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Svg, { Line as SvgLine, Polyline, Text as SvgText } from 'react-native-svg';

import { MasterLayout } from '@/components/MasterLayout';
import { Button } from '@/components/theme/Button';
import type { WitMotionVector3 } from '@/modules/witmotion-ble';
import { useWitMotion, witMotionClient } from '@/modules/witmotion-ble';
import type { PerRepResult, SegmentAndScoreResult } from '@/utils/segmentAndScorePipeline';
import { segmentAndScore } from '@/utils/segmentAndScorePipeline';

function valueOrDash(value: number | null | undefined, digits = 2) {
  if (value === null || value === undefined) {
    return '—';
  }

  return value.toFixed(digits);
}

const CHART_MAX_POINTS = 180;
const GRAVITY_MS2 = 9.81;
const SENSOR_DT_S = 0.01; // fixed 10 ms per sample — never derived from wall-clock timestamps
const RECONNECT_GAP_S = 2.0;

// High-pass filter coefficients — alpha = tau / (tau + dt)
const HPF_ALPHA_ACCEL = 1.0 / (1.0 + SENSOR_DT_S); // tau=1s, cutoff≈0.16Hz
const HPF_ALPHA_VEL = 0.5 / (0.5 + SENSOR_DT_S); // tau=0.5s, cutoff≈0.32Hz

// Zero Velocity Update — forces velocity to 0 when device is truly stationary
const ZVU_ACCEL_THRESH_G = 0.05;
const ZVU_GYRO_THRESH_DPS = 5.0;
const ZVU_WINDOW = 20;

// Display threshold for the live accel envelope shown in the "Rep signal" card.
const REP_PEAK_THRESHOLD_G = 0.42;

const DEBUG_DATA_DIRECTORY_NAME = 'witmotion-debug';

interface RecordedMotionSample {
  timestamp: number;
  accel: WitMotionVector3;
  gyro: WitMotionVector3;
  angle: WitMotionVector3;
}

interface DebugMotionFile {
  version: 1;
  startedAt: string;
  stoppedAt?: string;
  sampleCount: number;
  analysis?: SegmentAndScoreResult;
  samples: RecordedMotionSample[];
}

interface StoredDebugMotionFile extends DebugMotionFile {
  uri: string;
  fileName: string;
  sortTimestampMs: number;
}

type MutableRef<T> = {
  current: T;
};

function pushCapped<T>(buffer: T[], value: T, maxLength: number) {
  buffer.push(value);
  if (buffer.length > maxLength) {
    buffer.splice(0, buffer.length - maxLength);
  }
}

function resetLiveBuffers(
  refs: MutableRef<number[]>[],
  rawAccelRef: MutableRef<{ x: number[]; y: number[]; z: number[] }>
) {
  for (const ref of refs) {
    ref.current = [];
  }

  rawAccelRef.current = { x: [], y: [], z: [] };
}

function resetRecordingState(
  integRef: MutableRef<{
    prevAVert: number;
    hpfAccel: number;
    rawVel: number;
    prevRawVel: number;
    hpfVel: number;
    position: number;
    lastTs: number | null;
    chartTick: number;
    stillCount: number;
  }>,
  liveFeatureRef: MutableRef<{
    smoothMag: number;
    baseline: number;
    initialized: boolean;
  }>,
  anchorAngleRef: MutableRef<{ x: number; y: number; z: number } | null>,
  currentAngleRef: MutableRef<{ x: number; y: number; z: number } | null>,
  smoothBufRef: MutableRef<number[]>,
  velBufRef: MutableRef<number[]>,
  posBufRef: MutableRef<number[]>,
  angleBufRef: MutableRef<number[]>,
  rawAccelBufRef: MutableRef<{ x: number[]; y: number[]; z: number[] }>
) {
  const integ = integRef.current;
  integ.prevAVert = 0;
  integ.hpfAccel = 0;
  integ.rawVel = 0;
  integ.prevRawVel = 0;
  integ.hpfVel = 0;
  integ.position = 0;
  integ.lastTs = null;
  integ.chartTick = 0;
  integ.stillCount = 0;

  anchorAngleRef.current = currentAngleRef.current ? { ...currentAngleRef.current } : null;
  smoothBufRef.current = [];
  resetLiveBuffers([velBufRef, posBufRef, angleBufRef], rawAccelBufRef);
  liveFeatureRef.current = {
    smoothMag: 0,
    baseline: 0,
    initialized: false,
  };
}

/**
 * Projects body-frame accel onto world-frame vertical using ZYX Euler angles
 * from the sensor's AHRS output. Yaw cancels for the vertical axis.
 * Returns signed vertical acceleration in g units; 0 = no vertical movement.
 */
function verticalAccelWorld(accel: WitMotionVector3, angle: WitMotionVector3): number {
  const roll = (angle.x * Math.PI) / 180;
  const pitch = (angle.y * Math.PI) / 180;
  const azWorld =
    -Math.sin(pitch) * accel.x +
    Math.cos(pitch) * Math.sin(roll) * accel.y +
    Math.cos(pitch) * Math.cos(roll) * accel.z;
  return azWorld - 1.0;
}

function getDebugDataDirectoryUri(): string | null {
  const baseDirectory = documentDirectory ?? cacheDirectory;
  return baseDirectory ? `${baseDirectory}${DEBUG_DATA_DIRECTORY_NAME}/` : null;
}

function joinUri(baseUri: string, childName: string): string {
  return `${baseUri.replace(/\/?$/, '/')}${childName}`;
}

function buildDebugMotionFileName(
  startedAtMs: number,
  stoppedAtMs: number,
  sampleCount: number
): string {
  const startedStamp = new Date(startedAtMs).toISOString().replace(/[:.]/g, '-');
  const stoppedStamp = new Date(stoppedAtMs).toISOString().replace(/[:.]/g, '-');
  const randomSuffix = Math.random().toString(36).slice(2, 8);
  return `witmotion-${startedStamp}-to-${stoppedStamp}-${sampleCount}samples-${randomSuffix}.json`;
}

async function ensureDebugDataDirectoryUri(): Promise<string | null> {
  const directoryUri = getDebugDataDirectoryUri();
  if (!directoryUri) {
    return null;
  }

  await makeDirectoryAsync(directoryUri, { intermediates: true });
  return directoryUri;
}

function isDebugMotionFile(value: unknown): value is DebugMotionFile {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Partial<DebugMotionFile>;
  return (
    candidate.version === 1 &&
    typeof candidate.startedAt === 'string' &&
    (candidate.stoppedAt === undefined || typeof candidate.stoppedAt === 'string') &&
    typeof candidate.sampleCount === 'number' &&
    Array.isArray(candidate.samples)
  );
}

function formatDebugDateTime(isoString: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(isoString));
}

async function loadStoredDebugMotionFiles(): Promise<StoredDebugMotionFile[]> {
  const directoryUri = await ensureDebugDataDirectoryUri();
  if (!directoryUri) {
    return [];
  }

  let fileNames: string[] = [];
  try {
    fileNames = await readDirectoryAsync(directoryUri);
  } catch {
    return [];
  }

  const files = await Promise.all(
    fileNames
      .filter((fileName) => fileName.endsWith('.json'))
      .map(async (fileName) => {
        const uri = joinUri(directoryUri, fileName);

        try {
          const raw = await readAsStringAsync(uri);
          const parsed = JSON.parse(raw) as unknown;
          if (!isDebugMotionFile(parsed)) {
            return null;
          }

          const sortTimestampMs = new Date(parsed.stoppedAt ?? parsed.startedAt).getTime();
          return {
            ...parsed,
            uri,
            fileName,
            sortTimestampMs,
          } satisfies StoredDebugMotionFile;
        } catch {
          return null;
        }
      })
  );

  return files
    .filter((file): file is StoredDebugMotionFile => file !== null)
    .sort((a, b) => b.sortTimestampMs - a.sortTimestampMs);
}

function buildDebugMotionFile(
  samples: RecordedMotionSample[],
  startedAtMs: number,
  stoppedAtMs: number | null,
  analysis?: SegmentAndScoreResult
): DebugMotionFile {
  return {
    version: 1,
    startedAt: new Date(startedAtMs).toISOString(),
    stoppedAt: stoppedAtMs !== null ? new Date(stoppedAtMs).toISOString() : undefined,
    sampleCount: samples.length,
    analysis,
    samples,
  };
}

interface ChartProps {
  data: number[];
  yRange: number;
  unitLabel: string;
  color?: string;
  zeroLabel?: string;
}

function SignedChart({ data, yRange, unitLabel, color = '#4ade80', zeroLabel }: ChartProps) {
  const WIDTH = 320;
  const HEIGHT = 160;
  const PAD_LEFT = 44;
  const PAD_RIGHT = 8;
  const PAD_TOP = 8;
  const PAD_BOTTOM = 20;
  const innerW = WIDTH - PAD_LEFT - PAD_RIGHT;
  const innerH = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const midY = PAD_TOP + innerH / 2;

  const points =
    data.length < 2
      ? ''
      : data
          .map((v, i) => {
            const x = PAD_LEFT + (i / (CHART_MAX_POINTS - 1)) * innerW;
            const y = midY - (v / yRange) * (innerH / 2);
            return `${x.toFixed(1)},${Math.max(PAD_TOP, Math.min(PAD_TOP + innerH, y)).toFixed(1)}`;
          })
          .join(' ');

  const labels: [number, string][] = [
    [-yRange, `−${yRange}${unitLabel}`],
    [0, zeroLabel ?? `0${unitLabel}`],
    [yRange, `+${yRange}${unitLabel}`],
  ];

  return (
    <View className="overflow-hidden rounded-lg border border-border-light bg-bg-primary">
      <Svg width={WIDTH} height={HEIGHT}>
        <SvgLine
          x1={PAD_LEFT}
          y1={midY}
          x2={WIDTH - PAD_RIGHT}
          y2={midY}
          stroke="#444"
          strokeWidth={1}
          strokeDasharray="4,4"
        />
        {[-1, 1].map((g) => {
          const gy = midY - (g / yRange) * (innerH / 2);
          return (
            <SvgLine
              key={g}
              x1={PAD_LEFT}
              y1={gy}
              x2={WIDTH - PAD_RIGHT}
              y2={gy}
              stroke="#333"
              strokeWidth={1}
              strokeDasharray="2,6"
            />
          );
        })}
        {labels.map(([val, label]) => {
          const ly = midY - (val / yRange) * (innerH / 2);
          return (
            <SvgText
              key={label}
              x={PAD_LEFT - 4}
              y={ly + 4}
              fontSize={9}
              fill="#888"
              textAnchor="end"
            >
              {label}
            </SvgText>
          );
        })}
        {points ? <Polyline points={points} fill="none" stroke={color} strokeWidth={1.5} /> : null}
      </Svg>
    </View>
  );
}

interface MultiChartSeries {
  key: string;
  label: string;
  color: string;
  data: number[];
}

interface RangeChartProps {
  series: MultiChartSeries[];
  minY: number;
  maxY: number;
}

function RangeChart({ series, minY, maxY }: RangeChartProps) {
  const WIDTH = 320;
  const HEIGHT = 160;
  const PAD_LEFT = 44;
  const PAD_RIGHT = 8;
  const PAD_TOP = 8;
  const PAD_BOTTOM = 20;
  const innerW = WIDTH - PAD_LEFT - PAD_RIGHT;
  const innerH = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const span = maxY - minY;
  const ticks = [1.1, 1.0, 0.8, 0.6, 0.4, 0.2, 0, -0.2];

  return (
    <View className="overflow-hidden rounded-lg border border-border-light bg-bg-primary">
      <Svg width={WIDTH} height={HEIGHT}>
        {ticks.map((tick) => {
          const clamped = Math.max(minY, Math.min(maxY, tick));
          const y = PAD_TOP + ((maxY - clamped) / span) * innerH;
          return (
            <SvgLine
              key={tick}
              x1={PAD_LEFT}
              y1={y}
              x2={WIDTH - PAD_RIGHT}
              y2={y}
              stroke={tick === 0 || tick === 1 ? '#444' : '#333'}
              strokeWidth={1}
              strokeDasharray={tick === 0 || tick === 1 ? '4,4' : '2,6'}
            />
          );
        })}
        {ticks.map((tick) => {
          const clamped = Math.max(minY, Math.min(maxY, tick));
          const y = PAD_TOP + ((maxY - clamped) / span) * innerH;
          return (
            <SvgText
              key={`${tick}-label`}
              x={PAD_LEFT - 4}
              y={y + 4}
              fontSize={9}
              fill="#888"
              textAnchor="end"
            >
              {tick.toFixed(tick === 0 || tick === 1 ? 0 : 1)}
            </SvgText>
          );
        })}
        {series.map((item) => {
          const points =
            item.data.length < 2
              ? ''
              : item.data
                  .map((v, i) => {
                    const x = PAD_LEFT + (i / (CHART_MAX_POINTS - 1)) * innerW;
                    const y = PAD_TOP + ((maxY - v) / span) * innerH;
                    return `${x.toFixed(1)},${Math.max(PAD_TOP, Math.min(PAD_TOP + innerH, y)).toFixed(1)}`;
                  })
                  .join(' ');

          return points ? (
            <Polyline
              key={item.key}
              points={points}
              fill="none"
              stroke={item.color}
              strokeWidth={1.5}
            />
          ) : null;
        })}
      </Svg>
    </View>
  );
}

export default function WitMotionTestScreen() {
  const wit = useWitMotion();
  const requestPermissions = wit.requestPermissions;

  const velBufRef = useRef<number[]>([]);
  const posBufRef = useRef<number[]>([]);
  const angleBufRef = useRef<number[]>([]);
  const rawAccelBufRef = useRef({
    x: [] as number[],
    y: [] as number[],
    z: [] as number[],
  });
  const [velData, setVelData] = useState<number[]>([]);
  const [posData, setPosData] = useState<number[]>([]);
  const [angleData, setAngleData] = useState<number[]>([]);
  const [rawAccelData, setRawAccelData] = useState({
    x: [] as number[],
    y: [] as number[],
    z: [] as number[],
  });
  const recordedMotionRef = useRef<RecordedMotionSample[]>([]);
  const recordingActiveRef = useRef(false);
  const recordingStartedAtRef = useRef<number | null>(null);
  const [recordingStatus, setRecordingStatus] = useState<'idle' | 'recording' | 'analyzed'>('idle');
  const [pipelineResult, setPipelineResult] = useState<SegmentAndScoreResult | null>(null);
  const [recordedSampleCount, setRecordedSampleCount] = useState(0);
  const [debugDataStatus, setDebugDataStatus] = useState('No saved debug files yet');
  const [isSavingDebugData, setIsSavingDebugData] = useState(false);
  const [isSharingDebugData, setIsSharingDebugData] = useState(false);
  const [isSharingAvailable, setIsSharingAvailable] = useState(false);
  const [storedDebugFiles, setStoredDebugFiles] = useState<StoredDebugMotionFile[]>([]);
  const [isLoadingStoredDebugFiles, setIsLoadingStoredDebugFiles] = useState(false);

  const anchorAngleRef = useRef<{ x: number; y: number; z: number } | null>(null);
  const [anchorAngle, setAnchorAngle] = useState<{ x: number; y: number; z: number } | null>(null);
  const currentAngleRef = useRef<{ x: number; y: number; z: number } | null>(null);
  const liveFeatureRef = useRef({
    smoothMag: 0,
    baseline: 0,
    initialized: false,
  });

  // HPF integration state
  const integRef = useRef({
    prevAVert: 0,
    hpfAccel: 0,
    rawVel: 0,
    prevRawVel: 0,
    hpfVel: 0,
    position: 0,
    lastTs: null as number | null,
    chartTick: 0,
    stillCount: 0, // consecutive samples below ZVU thresholds
  });

  // Buffer for the smoothed vertical accel chart
  const smoothBufRef = useRef<number[]>([]);
  const [smoothData, setSmoothData] = useState<number[]>([]);

  // React state for display (updated at 20 Hz via the interval timer)
  const [positionCm, setPositionCm] = useState(0);
  const [velocityMs, setVelocityMs] = useState(0);
  // fastEMA − slowEMA: live motion envelope used by the rep detector
  const [liveFeature, setLiveFeature] = useState(0);

  useEffect(() => {
    void requestPermissions();
  }, [requestPermissions]);

  useEffect(() => {
    let cancelled = false;

    void Sharing.isAvailableAsync()
      .then((available) => {
        if (!cancelled) {
          setIsSharingAvailable(available);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setIsSharingAvailable(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return witMotionClient.onBatch((batch) => {
      const integ = integRef.current;

      for (const packet of batch.packets) {
        if (packet.kind !== 'motion') {
          continue;
        }

        const { accel, gyro, angle, timestamp } = packet;
        currentAngleRef.current = angle;
        const sampleTs = timestamp;

        if (recordingActiveRef.current) {
          recordedMotionRef.current.push({
            timestamp: sampleTs,
            accel: { ...accel },
            gyro: { ...gyro },
            angle: { ...angle },
          });
        }

        const wallGapS = integ.lastTs !== null ? (sampleTs - integ.lastTs) / 1000 : 0;
        const isGap = wallGapS > RECONNECT_GAP_S;
        integ.lastTs = sampleTs;

        if (isGap) {
          integ.prevAVert = 0;
          integ.hpfAccel = 0;
          integ.rawVel = 0;
          integ.prevRawVel = 0;
          integ.hpfVel = 0;
          integ.stillCount = 0;
          // Re-seed filters from current packet after a gap
          continue;
        }

        const aVert = verticalAccelWorld(accel, angle);

        // HPF on acceleration → integrate → HPF on velocity → integrate position
        integ.hpfAccel = HPF_ALPHA_ACCEL * (integ.hpfAccel + aVert - integ.prevAVert);
        integ.prevAVert = aVert;
        integ.rawVel += integ.hpfAccel * GRAVITY_MS2 * SENSOR_DT_S;

        const accelMag = Math.sqrt(accel.x ** 2 + accel.y ** 2 + accel.z ** 2);
        const adaptiveFeature = Math.abs(accelMag - 1.0);

        const gyroMag = Math.sqrt(gyro.x ** 2 + gyro.y ** 2 + gyro.z ** 2);
        if (Math.abs(accelMag - 1.0) < ZVU_ACCEL_THRESH_G && gyroMag < ZVU_GYRO_THRESH_DPS) {
          integ.stillCount += 1;
          if (integ.stillCount >= ZVU_WINDOW) {
            integ.rawVel = 0;
            integ.prevRawVel = 0;
            integ.hpfVel = 0;
          }
        } else {
          integ.stillCount = 0;
        }

        integ.hpfVel = HPF_ALPHA_VEL * (integ.hpfVel + integ.rawVel - integ.prevRawVel);
        integ.prevRawVel = integ.rawVel;
        integ.position += integ.hpfVel * SENSOR_DT_S;

        // Push to chart buffer every 5 packets (100 Hz → 20 Hz chart data → ~9 s visible)
        integ.chartTick = (integ.chartTick + 1) % 5;
        if (integ.chartTick === 0) {
          const raw = rawAccelBufRef.current;
          pushCapped(raw.x, accel.x, CHART_MAX_POINTS);
          pushCapped(raw.y, accel.y, CHART_MAX_POINTS);
          pushCapped(raw.z, accel.z, CHART_MAX_POINTS);

          const vel2 = velBufRef.current;
          pushCapped(vel2, integ.hpfVel * 100, CHART_MAX_POINTS); // m/s → cm/s

          const pos = posBufRef.current;
          pushCapped(pos, integ.position * 100, CHART_MAX_POINTS); // m → cm

          const anchor = anchorAngleRef.current;
          const aDelta = anchor !== null ? angle.y - anchor.y : 0;
          const ang = angleBufRef.current;
          pushCapped(ang, aDelta, CHART_MAX_POINTS);

          // fastEMA − slowEMA — the feature the rep counter actually reads
          const sm = smoothBufRef.current;
          pushCapped(sm, adaptiveFeature, CHART_MAX_POINTS);
        }
      }
    });
  }, []);

  const refreshStoredDebugFiles = useCallback(async () => {
    setIsLoadingStoredDebugFiles(true);
    try {
      const files = await loadStoredDebugMotionFiles();
      setStoredDebugFiles(files);
      if (files.length === 0) {
        setDebugDataStatus('No saved debug files yet');
      }
    } catch (error) {
      console.error('Failed to load stored debug files:', error);
      setDebugDataStatus('Failed to load saved debug files');
    } finally {
      setIsLoadingStoredDebugFiles(false);
    }
  }, []);

  useEffect(() => {
    const run = () => {
      void refreshStoredDebugFiles();
    };
    run();
  }, [refreshStoredDebugFiles]);

  // Throttle React state updates to 20 fps
  useEffect(() => {
    const interval = setInterval(() => {
      setVelData([...velBufRef.current]);
      setPosData([...posBufRef.current]);
      setAngleData([...angleBufRef.current]);
      setRawAccelData({
        x: [...rawAccelBufRef.current.x],
        y: [...rawAccelBufRef.current.y],
        z: [...rawAccelBufRef.current.z],
      });
      setRecordedSampleCount(recordedMotionRef.current.length);
      setPositionCm(integRef.current.position * 100);
      setVelocityMs(integRef.current.hpfVel);
      setLiveFeature(liveFeatureRef.current.smoothMag - liveFeatureRef.current.baseline);
      setSmoothData([...smoothBufRef.current]);
    }, 50);
    return () => clearInterval(interval);
  }, []);

  const handleStartRecording = useCallback(async () => {
    recordingActiveRef.current = true;
    recordedMotionRef.current = [];
    recordingStartedAtRef.current = Date.now();
    setPipelineResult(null);
    setRecordedSampleCount(0);
    setRecordingStatus('recording');
    setDebugDataStatus('Recording... a new JSON file will be saved when you stop');
    setLiveFeature(0);
    setPositionCm(0);
    setVelocityMs(0);
    setVelData([]);
    setPosData([]);
    setAngleData([]);
    setRawAccelData({ x: [], y: [], z: [] });
    setSmoothData([]);

    resetRecordingState(
      integRef,
      liveFeatureRef,
      anchorAngleRef,
      currentAngleRef,
      smoothBufRef,
      velBufRef,
      posBufRef,
      angleBufRef,
      rawAccelBufRef
    );
    setAnchorAngle(anchorAngleRef.current);
  }, []);

  const handleStopRecording = useCallback(async () => {
    recordingActiveRef.current = false;
    const samples = [...recordedMotionRef.current];
    recordedMotionRef.current = [];

    const result = segmentAndScore(samples);
    setPipelineResult(result);

    setRecordingStatus('analyzed');

    const directoryUri = await ensureDebugDataDirectoryUri();
    if (!directoryUri) {
      setDebugDataStatus('Debug file location unavailable');
      return;
    }

    setIsSavingDebugData(true);
    try {
      const startedAtMs = recordingStartedAtRef.current ?? samples[0]?.timestamp ?? Date.now();
      const stoppedAtMs = samples[samples.length - 1]?.timestamp ?? Date.now();
      const payload = buildDebugMotionFile(samples, startedAtMs, stoppedAtMs, result);
      const fileName = buildDebugMotionFileName(startedAtMs, stoppedAtMs, samples.length);
      const fileUri = joinUri(directoryUri, fileName);
      await writeAsStringAsync(fileUri, JSON.stringify(payload, null, 2));
      setDebugDataStatus(`Saved ${fileName}`);
      await refreshStoredDebugFiles();
    } catch (error) {
      console.error('Failed to save debug data file:', error);
      setDebugDataStatus('Failed to save debug data file');
    } finally {
      setIsSavingDebugData(false);
    }
    recordingStartedAtRef.current = null;
    recordedMotionRef.current = [];
  }, [refreshStoredDebugFiles]);

  const handleShareDebugFile = useCallback(
    async (file: StoredDebugMotionFile) => {
      if (!isSharingAvailable) {
        setDebugDataStatus('Sharing is not available on this device');
        return;
      }

      setIsSharingDebugData(true);
      try {
        await Sharing.shareAsync(file.uri, { mimeType: 'application/json' });
        setDebugDataStatus(`Shared ${file.fileName}`);
      } catch (error) {
        console.error('Failed to share debug data file:', error);
        setDebugDataStatus(`Failed to share ${file.fileName}`);
      } finally {
        setIsSharingDebugData(false);
      }
    },
    [isSharingAvailable]
  );

  const handleDeleteDebugFile = useCallback(
    async (file: StoredDebugMotionFile) => {
      setIsSavingDebugData(true);
      try {
        await deleteAsync(file.uri, { idempotent: true });
        setDebugDataStatus(`Deleted ${file.fileName}`);
        await refreshStoredDebugFiles();
      } catch (error) {
        console.error('Failed to delete debug data file:', error);
        setDebugDataStatus(`Failed to delete ${file.fileName}`);
      } finally {
        setIsSavingDebugData(false);
      }
    },
    [refreshStoredDebugFiles]
  );

  const handleSetAnchor = useCallback(() => {
    resetRecordingState(
      integRef,
      liveFeatureRef,
      anchorAngleRef,
      currentAngleRef,
      smoothBufRef,
      velBufRef,
      posBufRef,
      angleBufRef,
      rawAccelBufRef
    );
    setAnchorAngle(anchorAngleRef.current);
  }, []);

  const handleResetReps = useCallback(() => {
    recordingActiveRef.current = false;
    recordedMotionRef.current = [];
    recordingStartedAtRef.current = null;
    setRecordingStatus('idle');
    setPipelineResult(null);
    setRecordedSampleCount(0);
    setDebugDataStatus('Recording cleared');
    setLiveFeature(0);
    setPositionCm(0);
    setVelocityMs(0);
    setVelData([]);
    setPosData([]);
    setAngleData([]);
    setRawAccelData({ x: [], y: [], z: [] });
    smoothBufRef.current = [];
    setSmoothData([]);
    liveFeatureRef.current = {
      smoothMag: 0,
      baseline: 0,
      initialized: false,
    };
  }, []);

  let recordingColor = '#888';
  let recordingLabel = '○ IDLE';
  let recordingFooterText = 'Press Start, do your set, then press Stop to count reps';
  if (recordingStatus === 'recording') {
    recordingColor = '#4ade80';
    recordingLabel = '● RECORDING';
    recordingFooterText = `Recording ${recordedSampleCount} motion samples...`;
  } else if (recordingStatus === 'analyzed') {
    recordingColor = '#60a5fa';
    recordingLabel = '● DONE';
    recordingFooterText = pipelineResult
      ? `${pipelineResult.predictedReps} reps · ${pipelineResult.candidateSegments} candidates · ${recordedSampleCount} samples`
      : 'Recording finished';
  }
  const repCount = pipelineResult?.predictedReps ?? 0;

  return (
    <MasterLayout>
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="gap-4 p-4">
          <View>
            <Text className="text-2xl font-bold text-text-primary">Wit Motion BLE</Text>
            <Text className="text-text-secondary">Expo hook demo for WT sensors</Text>
          </View>

          {/* Rep Counter — primary card */}
          <View className="rounded-xl border-2 border-border-accent bg-bg-overlay p-5">
            <View className="mb-3 flex-row items-center justify-between">
              <View>
                <Text className="text-lg font-bold text-text-primary">Rep Recorder</Text>
                <Text className="text-xs text-text-tertiary">
                  Record a set, then analyze it when you stop
                </Text>
              </View>
              <Button label="Clear" onPress={handleResetReps} size="sm" variant="secondary" />
            </View>

            {/* Recording controls + live signal readout */}
            <View className="mb-3 flex-row items-center gap-3">
              <View
                className="rounded-full px-3 py-1"
                style={{ backgroundColor: recordingColor + '33' }}
              >
                <Text className="text-sm font-bold" style={{ color: recordingColor }}>
                  {recordingLabel}
                </Text>
              </View>
              <Text className="text-sm text-text-secondary">
                samples: <Text className="font-bold">{recordedSampleCount}</Text>
              </Text>
            </View>

            <View className="mb-4 flex-row gap-3">
              <Button
                label="Start"
                onPress={() => void handleStartRecording()}
                size="sm"
                variant={recordingStatus === 'recording' ? 'secondary' : 'accent'}
                disabled={
                  recordingStatus === 'recording' || isSavingDebugData || isSharingDebugData
                }
              />
              <Button
                label="Stop"
                onPress={() => void handleStopRecording()}
                size="sm"
                variant="secondary"
                disabled={
                  recordingStatus !== 'recording' || isSavingDebugData || isSharingDebugData
                }
              />
            </View>
            <Text className="mb-1 text-xs text-text-tertiary">
              Debug storage: <Text className="font-bold text-text-primary">{debugDataStatus}</Text>
            </Text>
            <Text className="mb-4 text-xs text-text-tertiary">
              Saved sessions:{' '}
              <Text className="font-bold text-text-primary">{storedDebugFiles.length}</Text>
            </Text>

            {/* Rep count */}
            <View className="items-center">
              <Text
                className="font-bold text-text-primary"
                style={{ fontSize: 80, lineHeight: 84 }}
              >
                {repCount}
              </Text>
              <Text className="text-xs uppercase tracking-widest text-text-tertiary">reps</Text>
              {pipelineResult ? (
                <Text className="mt-1 text-xs text-text-tertiary">
                  {pipelineResult.candidateSegments} candidates · {pipelineResult.classifiedAsRep}{' '}
                  classified
                  {pipelineResult.error ? `  ⚠ ${pipelineResult.error}` : ''}
                </Text>
              ) : null}
            </View>
            <Text className="mt-2 text-center text-xs text-text-tertiary">
              {recordingFooterText}
            </Text>

            {/* Per-rep breakdown table */}
            {pipelineResult && pipelineResult.reps.length > 0 ? (
              <View className="mt-4">
                <Text className="mb-2 text-xs font-bold uppercase tracking-wider text-text-tertiary">
                  Per-rep breakdown
                </Text>

                {/* Header row */}
                <View className="mb-1 flex-row gap-1">
                  {['#', 'Total', 'Ph A', 'Ph B', 'Spd A', 'Spd B', 'Conf'].map((h) => (
                    <Text
                      key={h}
                      className="text-center text-xs font-bold text-text-tertiary"
                      style={{ flex: h === '#' ? 0.5 : 1 }}
                    >
                      {h}
                    </Text>
                  ))}
                </View>

                {pipelineResult.reps.map((rep: PerRepResult) => (
                  <View
                    key={rep.index}
                    className="mb-1 flex-row gap-1 rounded-md bg-bg-primary px-2 py-2"
                  >
                    <Text
                      className="text-center text-xs font-bold text-text-primary"
                      style={{ flex: 0.5 }}
                    >
                      {rep.index}
                    </Text>
                    <Text className="text-center text-xs text-text-primary" style={{ flex: 1 }}>
                      {(rep.durationMs / 1000).toFixed(2)}s
                    </Text>
                    <Text className="text-center text-xs text-text-secondary" style={{ flex: 1 }}>
                      {(rep.phaseADurationMs / 1000).toFixed(2)}s
                    </Text>
                    <Text className="text-center text-xs text-text-secondary" style={{ flex: 1 }}>
                      {(rep.phaseBDurationMs / 1000).toFixed(2)}s
                    </Text>
                    <Text className="text-center text-xs text-text-tertiary" style={{ flex: 1 }}>
                      {rep.phaseASpeedDps.toFixed(1)}
                    </Text>
                    <Text className="text-center text-xs text-text-tertiary" style={{ flex: 1 }}>
                      {rep.phaseBSpeedDps.toFixed(1)}
                    </Text>
                    <Text className="text-center text-xs text-text-tertiary" style={{ flex: 1 }}>
                      {rep.classifierConfidence.toFixed(2)}
                    </Text>
                  </View>
                ))}

                {/* Averages row */}
                {(() => {
                  const reps = pipelineResult.reps;
                  const avg = (fn: (r: PerRepResult) => number) =>
                    reps.reduce((s, r) => s + fn(r), 0) / reps.length;
                  return (
                    <View className="mt-1 flex-row gap-1 rounded-md bg-bg-overlay px-2 py-2">
                      <Text
                        className="text-center text-xs font-bold text-text-tertiary"
                        style={{ flex: 0.5 }}
                      >
                        avg
                      </Text>
                      <Text className="text-center text-xs text-text-tertiary" style={{ flex: 1 }}>
                        {(avg((r) => r.durationMs) / 1000).toFixed(2)}s
                      </Text>
                      <Text className="text-center text-xs text-text-tertiary" style={{ flex: 1 }}>
                        {(avg((r) => r.phaseADurationMs) / 1000).toFixed(2)}s
                      </Text>
                      <Text className="text-center text-xs text-text-tertiary" style={{ flex: 1 }}>
                        {(avg((r) => r.phaseBDurationMs) / 1000).toFixed(2)}s
                      </Text>
                      <Text className="text-center text-xs text-text-tertiary" style={{ flex: 1 }}>
                        {avg((r) => r.phaseASpeedDps).toFixed(1)}
                      </Text>
                      <Text className="text-center text-xs text-text-tertiary" style={{ flex: 1 }}>
                        {avg((r) => r.phaseBSpeedDps).toFixed(1)}
                      </Text>
                      <Text className="text-center text-xs text-text-tertiary" style={{ flex: 1 }}>
                        {avg((r) => r.classifierConfidence).toFixed(2)}
                      </Text>
                    </View>
                  );
                })()}

                <Text className="mt-2 text-xs text-text-tertiary">
                  TUT:{' '}
                  {(pipelineResult.reps.reduce((s, r) => s + r.durationMs, 0) / 1000).toFixed(1)}s
                  total · Speed in °/s · Ph A/B split at turning point (concentric/eccentric
                  unlabeled)
                </Text>
              </View>
            ) : null}
          </View>

          <View className="rounded-xl border border-border-accent bg-bg-overlay p-4">
            <Text className="mb-2 text-xs font-bold uppercase tracking-wider text-text-tertiary">
              Status
            </Text>
            <Text className="text-sm text-text-primary">Bluetooth: {String(wit.bleState)}</Text>
            <Text className="text-sm text-text-primary">Mode: {wit.status}</Text>
            <Text className="text-sm text-text-primary">
              Scanning: {wit.isScanning ? 'yes' : 'no'}
            </Text>
            <Text className="text-sm text-text-primary">
              Connected: {wit.connectedDevice?.name ?? 'no device'}
            </Text>
            {wit.error ? <Text className="text-status-error mt-2 text-sm">{wit.error}</Text> : null}
          </View>

          <View className="rounded-xl border border-border-accent bg-bg-overlay p-4">
            <Text className="mb-3 font-bold text-text-primary">Scan</Text>
            <View className="flex-row gap-3">
              <Button
                label={wit.isScanning ? 'Stop Scan' : 'Start Scan'}
                onPress={() => {
                  if (wit.isScanning) {
                    wit.stopScan();
                    return;
                  }

                  void wit.startScan({ autoConnect: true });
                }}
                size="sm"
                variant={wit.isScanning ? 'secondary' : 'accent'}
              />
              {wit.connectedDevice ? (
                <Button
                  label="Disconnect"
                  onPress={() => void wit.disconnect()}
                  size="sm"
                  variant="secondary"
                />
              ) : null}
            </View>

            {wit.discoveredDevices.length > 0 ? (
              <View className="mt-4 gap-2">
                <Text className="text-xs font-bold uppercase tracking-wider text-text-tertiary">
                  Found devices ({wit.discoveredDevices.length})
                </Text>
                {wit.discoveredDevices.map((device) => (
                  <Pressable
                    key={device.id}
                    onPress={() => void wit.connect(device)}
                    className="rounded-lg border border-border-light bg-bg-primary p-3"
                  >
                    <Text className="font-medium text-text-primary">{device.name}</Text>
                    <Text className="text-xs text-text-tertiary">{device.id}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>

          <View className="rounded-xl border border-border-accent bg-bg-overlay p-4">
            <Text className="mb-3 font-bold text-text-primary">Live data</Text>
            <Text className="text-sm text-text-primary">
              Accel: {valueOrDash(wit.liveData.accel?.x)} / {valueOrDash(wit.liveData.accel?.y)} /{' '}
              {valueOrDash(wit.liveData.accel?.z)}
            </Text>
            <Text className="text-sm text-text-primary">
              Gyro: {valueOrDash(wit.liveData.gyro?.x)} / {valueOrDash(wit.liveData.gyro?.y)} /{' '}
              {valueOrDash(wit.liveData.gyro?.z)}
            </Text>
            <Text className="text-sm text-text-primary">
              Angle: {valueOrDash(wit.liveData.angle?.x)} / {valueOrDash(wit.liveData.angle?.y)} /{' '}
              {valueOrDash(wit.liveData.angle?.z)}
            </Text>
            <Text className="text-sm text-text-primary">
              Magnetic: {valueOrDash(wit.liveData.magnetic?.x)} /{' '}
              {valueOrDash(wit.liveData.magnetic?.y)} / {valueOrDash(wit.liveData.magnetic?.z)}
            </Text>
            <Text className="text-sm text-text-primary">
              Battery: {valueOrDash(wit.liveData.batteryPercent, 0)}% (
              {valueOrDash(wit.liveData.batteryVoltage)} V)
            </Text>
            <Text className="text-xs text-text-tertiary">Packets received: {wit.packetCount}</Text>
          </View>

          {/* Pitch angle from anchor */}
          <View className="rounded-xl border border-border-accent bg-bg-overlay p-4">
            <View className="mb-2 flex-row items-start justify-between">
              <View className="flex-1 pr-2">
                <Text className="font-bold text-text-primary">Tilt from anchor</Text>
                <Text className="text-xs text-text-tertiary">
                  Pitch angle change since Set Anchor · works at any speed · zero drift
                </Text>
              </View>
              <Button label="Set Anchor" onPress={handleSetAnchor} size="sm" variant="accent" />
            </View>
            <Text className="mb-3 text-xs text-text-tertiary">
              Pitch now: {valueOrDash(wit.liveData.angle?.y, 1)}°
              {anchorAngle != null ? `  anchor: ${anchorAngle.y.toFixed(1)}°` : '  (no anchor set)'}
            </Text>
            {angleData.length > 1 ? (
              <SignedChart
                data={angleData}
                yRange={45}
                unitLabel="°"
                color="#f59e0b"
                zeroLabel="anchor"
              />
            ) : (
              <View className="items-center rounded-lg border border-border-light bg-bg-primary py-8">
                <Text className="text-xs text-text-tertiary">
                  Press Set Anchor then tilt the device
                </Text>
              </View>
            )}
          </View>

          {/* Raw acceleration chart, close to the official app's display */}
          <View className="rounded-xl border border-border-accent bg-bg-overlay p-4">
            <Text className="mb-1 font-bold text-text-primary">Raw acceleration</Text>
            <Text className="mb-3 text-xs text-text-tertiary">
              Direct accel values from the sensor · slow movement still shows here
            </Text>
            {rawAccelData.x.length > 1 ? (
              <>
                <RangeChart
                  series={[
                    { key: 'x', label: 'AccX', color: '#94a3b8', data: rawAccelData.x },
                    { key: 'y', label: 'AccY', color: '#facc15', data: rawAccelData.y },
                    { key: 'z', label: 'AccZ', color: '#f59e0b', data: rawAccelData.z },
                  ]}
                  minY={-0.2}
                  maxY={1.1}
                />
                <View className="mt-3 flex-row flex-wrap gap-3">
                  {[
                    { key: 'x', label: 'AccX', color: '#94a3b8', value: wit.liveData.accel?.x },
                    { key: 'y', label: 'AccY', color: '#facc15', value: wit.liveData.accel?.y },
                    { key: 'z', label: 'AccZ', color: '#f59e0b', value: wit.liveData.accel?.z },
                  ].map((item) => (
                    <View key={item.key} className="flex-row items-center gap-2">
                      <View
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      <Text className="text-xs text-text-secondary">
                        {item.label} · {valueOrDash(item.value)}
                      </Text>
                    </View>
                  ))}
                </View>
              </>
            ) : (
              <View className="items-center rounded-lg border border-border-light bg-bg-primary py-8">
                <Text className="text-xs text-text-tertiary">
                  Connect a device to see raw accel
                </Text>
              </View>
            )}
          </View>

          <View className="rounded-xl border border-border-accent bg-bg-overlay p-4">
            <Text className="mb-1 font-bold text-text-primary">Rep signal (adaptive)</Text>
            <Text className="mb-3 text-xs text-text-tertiary">
              |mag − 1g| · peak when &gt;{REP_PEAK_THRESHOLD_G} g · now: {liveFeature.toFixed(3)} g
            </Text>
            {smoothData.length > 1 ? (
              <SignedChart
                data={smoothData}
                yRange={0.5}
                unitLabel="g"
                color="#f97316"
                zeroLabel="0g"
              />
            ) : (
              <View className="items-center rounded-lg border border-border-light bg-bg-primary py-8">
                <Text className="text-xs text-text-tertiary">Connect a device to see data</Text>
              </View>
            )}
          </View>

          {/* Vertical velocity */}
          <View className="rounded-xl border border-border-accent bg-bg-overlay p-4">
            <Text className="mb-1 font-bold text-text-primary">Vertical velocity</Text>
            <Text className="mb-3 text-xs text-text-tertiary">
              HPF-integrated acceleration · + = up · − = down · Velocity:{' '}
              {(velocityMs * 100).toFixed(1)} cm/s
            </Text>
            {velData.length > 1 ? (
              <SignedChart data={velData} yRange={80} unitLabel="cm/s" color="#4ade80" />
            ) : (
              <View className="items-center rounded-lg border border-border-light bg-bg-primary py-8">
                <Text className="text-xs text-text-tertiary">Connect a device to see data</Text>
              </View>
            )}
          </View>

          {/* Vertical position */}
          <View className="rounded-xl border border-border-accent bg-bg-overlay p-4">
            <View className="mb-3 flex-row items-center justify-between">
              <View>
                <Text className="font-bold text-text-primary">Vertical position</Text>
                <Text className="text-xs text-text-tertiary">
                  Displacement from anchor · Position: {positionCm.toFixed(1)} cm
                </Text>
              </View>
            </View>
            {posData.length > 1 ? (
              <SignedChart
                data={posData}
                yRange={50}
                unitLabel="cm"
                color="#60a5fa"
                zeroLabel="anchor"
              />
            ) : (
              <View className="items-center rounded-lg border border-border-light bg-bg-primary py-8">
                <Text className="text-xs text-text-tertiary">
                  Press Set Anchor then move the device
                </Text>
              </View>
            )}
          </View>

          <View className="rounded-xl border border-border-accent bg-bg-overlay p-4">
            <Text className="mb-3 font-bold text-text-primary">Commands</Text>
            <View className="flex-row flex-wrap gap-2">
              <Button
                label="Reset"
                onPress={() => void wit.reset()}
                size="sm"
                variant="secondary"
              />
              <Button
                label="Angle 0"
                onPress={() => void wit.setAngleZero()}
                size="sm"
                variant="secondary"
              />
              <Button
                label="Mag start"
                onPress={() => void wit.startMagCalibration()}
                size="sm"
                variant="secondary"
              />
              <Button
                label="Mag stop"
                onPress={() => void wit.stopMagCalibration()}
                size="sm"
                variant="secondary"
              />
              <Button
                label="Rate 100Hz"
                onPress={() => void wit.setOutputRate(100)}
                size="sm"
                variant="secondary"
              />
              <Button
                label="Bandwidth 20"
                onPress={() => void wit.setBandwidth(20)}
                size="sm"
                variant="secondary"
              />
            </View>
          </View>

          <View className="rounded-xl border border-border-accent bg-bg-overlay p-4">
            <View className="mb-3 flex-row items-start justify-between gap-3">
              <View className="flex-1">
                <Text className="font-bold text-text-primary">Saved debug files</Text>
                <Text className="text-xs text-text-tertiary">
                  Every Stop writes a new local JSON file so you can review, share, or delete old
                  sessions.
                </Text>
              </View>
              <Button
                label="Refresh"
                onPress={() => void refreshStoredDebugFiles()}
                size="xs"
                variant="secondary"
                loading={isLoadingStoredDebugFiles}
              />
            </View>

            {storedDebugFiles.length > 0 ? (
              <View className="gap-3">
                {storedDebugFiles.map((file) => {
                  const savedAtLabel = formatDebugDateTime(file.stoppedAt ?? file.startedAt);
                  const repLabel = file.analysis
                    ? `${file.analysis.predictedReps} reps`
                    : 'No analysis';
                  const durationSeconds: number | null = null;

                  return (
                    <View
                      key={file.uri}
                      className="rounded-lg border border-border-light bg-bg-primary p-3"
                    >
                      <View className="mb-3">
                        <Text className="font-medium text-text-primary" numberOfLines={1}>
                          {file.fileName}
                        </Text>
                        <Text className="text-xs text-text-tertiary">
                          {savedAtLabel} · {file.sampleCount} samples · {repLabel}
                          {durationSeconds != null
                            ? ` · ${(durationSeconds as number).toFixed(1)} s`
                            : ''}
                        </Text>
                      </View>
                      <View className="flex-row flex-wrap gap-2">
                        <Button
                          label="Share"
                          onPress={() => void handleShareDebugFile(file)}
                          size="xs"
                          variant="secondary"
                          disabled={!isSharingAvailable || isSharingDebugData || isSavingDebugData}
                        />
                        <Button
                          label="Delete"
                          onPress={() => void handleDeleteDebugFile(file)}
                          size="xs"
                          variant="discard"
                          disabled={isSharingDebugData || isSavingDebugData}
                        />
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : (
              <View className="items-center rounded-lg border border-border-light bg-bg-primary py-8">
                <Text className="text-xs text-text-tertiary">
                  No saved debug files yet. Press Start, then Stop to create one.
                </Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </MasterLayout>
  );
}
