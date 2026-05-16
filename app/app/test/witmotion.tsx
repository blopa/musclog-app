import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Svg, { Line as SvgLine, Polyline, Text as SvgText } from 'react-native-svg';

import { MasterLayout } from '@/components/MasterLayout';
import { Button } from '@/components/theme/Button';
import type { WitMotionVector3 } from '@/modules/witmotion-ble';
import { useWitMotion, witMotionClient } from '@/modules/witmotion-ble';

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
const HPF_ALPHA_VEL = 0.5 / (0.5 + SENSOR_DT_S);   // tau=0.5s, cutoff≈0.32Hz

// Zero Velocity Update — forces velocity to 0 when device is truly stationary
const ZVU_ACCEL_THRESH_G = 0.05;
const ZVU_GYRO_THRESH_DPS = 5.0;
const ZVU_WINDOW = 20;

// Rep counting via dual-EMA adaptive threshold on raw acceleration magnitude.
// Uses acc_r = sqrt(ax²+ay²+az²) — works regardless of sensor orientation or exercise type.
// Approach validated by daveebbelaar/tracking-barbell-exercises and SmartLift-Analysis-Project.
//
// SIGNAL_ALPHA = 0.06  →  τ ≈ 157 ms  →  cutoff ≈ 1.0 Hz  (smooths noise, keeps rep shape)
// BASELINE_ALPHA = 0.003 →  τ ≈ 3.3 s  →  cutoff ≈ 0.05 Hz (tracks gravity-only floor slowly)
//
// The feature is (smoothMag − baseline): rises above RISE_G during a rep, falls below FALL_G
// at rest. Because baseline adapts, slow reps (smaller peaks) are still detected — their floor
// also drops proportionally, so the net rise stays detectable.
const SIGNAL_ALPHA = 0.06;
const BASELINE_ALPHA = 0.003;
const RISE_G = 0.025; // lower threshold so controlled reps still arm the detector
const FALL_G = 0.01; // must fall below this for the rep to be confirmed
const MIN_REP_MS = 220; // active phase must last at least this long (filters vibration noise)
const MIN_GAP_MS = 500; // minimum ms between rep counts (prevents double-counting)
const REARM_WINDOW = 6; // consecutive low samples required before the next rep can arm

type RepPhase = 'REST' | 'ACTIVE';

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
            <SvgText key={label} x={PAD_LEFT - 4} y={ly + 4} fontSize={9} fill="#888" textAnchor="end">
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
            <SvgText key={`${tick}-label`} x={PAD_LEFT - 4} y={y + 4} fontSize={9} fill="#888" textAnchor="end">
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
            <Polyline key={item.key} points={points} fill="none" stroke={item.color} strokeWidth={1.5} />
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

  const anchorAngleRef = useRef<{ x: number; y: number; z: number } | null>(null);
  const currentAngleRef = useRef<{ x: number; y: number; z: number } | null>(null);

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

  // Dual-EMA rep detection state — mutated inside onBatch, never causes renders
  const repRef = useRef({
    phase: 'REST' as RepPhase,
    repCount: 0,
    smoothMag: 0,          // fast EMA of acc_r  (~1 Hz cutoff)
    baseline: 0,           // slow EMA of acc_r  (~0.05 Hz) — tracks the at-rest floor
    activeStartMs: null as number | null, // when ACTIVE phase began
    lastRepMs: null as number | null,
    restStreak: 0,
    initialized: false,    // prevents startup transient from triggering phantom reps
  });

  // Buffer for the smoothed vertical accel chart
  const smoothBufRef = useRef<number[]>([]);
  const [smoothData, setSmoothData] = useState<number[]>([]);

  // React state for display (updated at 20 Hz via the interval timer)
  const [positionCm, setPositionCm] = useState(0);
  const [velocityMs, setVelocityMs] = useState(0);
  const [repCount, setRepCount] = useState(0);
  const [repPhase, setRepPhase] = useState<RepPhase>('REST');
  // (smoothMag − baseline): what the Schmitt trigger actually reads
  const [liveFeature, setLiveFeature] = useState(0);

  useEffect(() => {
    void requestPermissions();
  }, [requestPermissions]);

  useEffect(() => {
    return witMotionClient.onBatch((batch) => {
      const integ = integRef.current;
      const rep = repRef.current;

      for (const packet of batch.packets) {
        if (packet.kind !== 'motion') {
          continue;
        }

        const { accel, gyro, angle, timestamp } = packet;
        currentAngleRef.current = angle;
        const sampleTs = timestamp;

        const wallGapS = integ.lastTs !== null ? (sampleTs - integ.lastTs) / 1000 : 0;
        const isGap = wallGapS > RECONNECT_GAP_S;
        integ.lastTs = sampleTs;

        // Initialize both EMA filters from the first real packet to avoid startup transient.
        // Without this, both start at 0 and the surge to ~1g counts as a phantom rep.
        if (!rep.initialized) {
          const initMag = Math.sqrt(accel.x ** 2 + accel.y ** 2 + accel.z ** 2);
          rep.smoothMag = initMag;
          rep.baseline = initMag;
          rep.initialized = true;
        }

        if (isGap) {
          integ.prevAVert = 0;
          integ.hpfAccel = 0;
          integ.rawVel = 0;
          integ.prevRawVel = 0;
          integ.hpfVel = 0;
          integ.stillCount = 0;
          rep.phase = 'REST';
          rep.activeStartMs = null;
          rep.restStreak = 0;
          // Re-seed filters from current packet after a gap
          const gapMag = Math.sqrt(accel.x ** 2 + accel.y ** 2 + accel.z ** 2);
          rep.smoothMag = gapMag;
          rep.baseline = gapMag;
          continue;
        }

        const aVert = verticalAccelWorld(accel, angle);

        // HPF on acceleration → integrate → HPF on velocity → integrate position
        integ.hpfAccel = HPF_ALPHA_ACCEL * (integ.hpfAccel + aVert - integ.prevAVert);
        integ.prevAVert = aVert;
        integ.rawVel += integ.hpfAccel * GRAVITY_MS2 * SENSOR_DT_S;

        const accelMag = Math.sqrt(accel.x ** 2 + accel.y ** 2 + accel.z ** 2);
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

        // Dual-EMA adaptive rep detection.
        // smoothMag tracks rep dynamics; baseline tracks the gravity floor.
        // Feature = smoothMag − baseline: rises during any acceleration away from rest,
        // regardless of direction or exercise type.
        rep.smoothMag = SIGNAL_ALPHA * accelMag + (1 - SIGNAL_ALPHA) * rep.smoothMag;
        rep.baseline = BASELINE_ALPHA * accelMag + (1 - BASELINE_ALPHA) * rep.baseline;
        const feature = rep.smoothMag - rep.baseline;

        const nowMs = sampleTs;
        const msSinceLast = rep.lastRepMs !== null ? nowMs - rep.lastRepMs : Infinity;

        if (rep.phase === 'REST') {
          if (feature < FALL_G) {
            rep.restStreak += 1;
          } else {
            rep.restStreak = 0;
          }

          if (feature > RISE_G && rep.restStreak >= REARM_WINDOW && msSinceLast > MIN_GAP_MS) {
            rep.phase = 'ACTIVE';
            rep.activeStartMs = nowMs;
            rep.restStreak = 0;
          }
        } else if (rep.phase === 'ACTIVE') {
          if (feature < FALL_G) {
            const activeMs = nowMs - (rep.activeStartMs ?? nowMs);
            if (activeMs >= MIN_REP_MS) {
              rep.repCount += 1;
              rep.lastRepMs = nowMs;
            }
            rep.phase = 'REST';
            rep.activeStartMs = null;
            rep.restStreak = 1;
          } else {
            rep.restStreak = 0;
          }
        }

        // Push to chart buffer every 5 packets (100 Hz → 20 Hz chart data → ~9 s visible)
        integ.chartTick = (integ.chartTick + 1) % 5;
        if (integ.chartTick === 0) {
          const raw = rawAccelBufRef.current;
          raw.x.push(accel.x);
          raw.y.push(accel.y);
          raw.z.push(accel.z);
          if (raw.x.length > CHART_MAX_POINTS) {
            raw.x.splice(0, raw.x.length - CHART_MAX_POINTS);
          }
          if (raw.y.length > CHART_MAX_POINTS) {
            raw.y.splice(0, raw.y.length - CHART_MAX_POINTS);
          }
          if (raw.z.length > CHART_MAX_POINTS) {
            raw.z.splice(0, raw.z.length - CHART_MAX_POINTS);
          }

          const vel2 = velBufRef.current;
          vel2.push(integ.hpfVel * 100); // m/s → cm/s
          if (vel2.length > CHART_MAX_POINTS) {
            vel2.splice(0, vel2.length - CHART_MAX_POINTS);
          }

          const pos = posBufRef.current;
          pos.push(integ.position * 100); // m → cm
          if (pos.length > CHART_MAX_POINTS) {
            pos.splice(0, pos.length - CHART_MAX_POINTS);
          }

          const anchor = anchorAngleRef.current;
          const aDelta = anchor !== null ? angle.y - anchor.y : 0;
          const ang = angleBufRef.current;
          ang.push(aDelta);
          if (ang.length > CHART_MAX_POINTS) {
            ang.splice(0, ang.length - CHART_MAX_POINTS);
          }

          // (smoothMag − baseline) — the feature the rep counter actually reads
          const sm = smoothBufRef.current;
          sm.push(rep.smoothMag - rep.baseline);
          if (sm.length > CHART_MAX_POINTS) {
            sm.splice(0, sm.length - CHART_MAX_POINTS);
          }
        }
      }
    });
  }, []);

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
      setPositionCm(integRef.current.position * 100);
      setVelocityMs(integRef.current.hpfVel);
      setRepCount(repRef.current.repCount);
      setRepPhase(repRef.current.phase);
      setLiveFeature(repRef.current.smoothMag - repRef.current.baseline);
      setSmoothData([...smoothBufRef.current]);
    }, 50);
    return () => clearInterval(interval);
  }, []);

  const handleSetAnchor = useCallback(() => {
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
    velBufRef.current = [];
    posBufRef.current = [];
    angleBufRef.current = [];
    rawAccelBufRef.current = { x: [], y: [], z: [] };
  }, []);

  const handleResetReps = useCallback(() => {
    const rep = repRef.current;
    rep.repCount = 0;
    rep.phase = 'REST';
    rep.activeStartMs = null;
    rep.lastRepMs = null;
    rep.restStreak = 0;
    // Keep smoothMag/baseline — resetting them causes startup transient again
    smoothBufRef.current = [];
  }, []);

  const phaseColor = repPhase === 'ACTIVE' ? '#4ade80' : '#888';
  const phaseLabel = repPhase === 'ACTIVE' ? '● ACTIVE' : '○ REST';

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
              <Text className="text-lg font-bold text-text-primary">Rep Counter</Text>
              <Button label="Reset" onPress={handleResetReps} size="sm" variant="secondary" />
            </View>

            {/* Phase pill + live signal readout */}
            <View className="mb-3 flex-row items-center gap-3">
              <View className="rounded-full px-3 py-1" style={{ backgroundColor: phaseColor + '33' }}>
                <Text className="text-sm font-bold" style={{ color: phaseColor }}>
                  {phaseLabel}
                </Text>
              </View>
              <Text className="text-sm text-text-secondary">
                signal: <Text className="font-bold">{liveFeature.toFixed(3)} g</Text>
                {'  '}rise@{RISE_G} g
              </Text>
            </View>

            {/* Big rep number */}
            <Text className="text-center font-bold text-text-primary" style={{ fontSize: 96, lineHeight: 100 }}>
              {repCount}
            </Text>
            <Text className="mb-1 text-center text-xs uppercase tracking-widest text-text-tertiary">reps</Text>
            <Text className="text-center text-xs text-text-tertiary">
              No anchor needed — just move the device up and down
            </Text>
          </View>

          <View className="rounded-xl border border-border-accent bg-bg-overlay p-4">
            <Text className="mb-2 text-xs font-bold uppercase tracking-wider text-text-tertiary">
              Status
            </Text>
            <Text className="text-sm text-text-primary">Bluetooth: {String(wit.bleState)}</Text>
            <Text className="text-sm text-text-primary">Mode: {wit.status}</Text>
            <Text className="text-sm text-text-primary">Scanning: {wit.isScanning ? 'yes' : 'no'}</Text>
            <Text className="text-sm text-text-primary">
              Connected: {wit.connectedDevice?.name ?? 'no device'}
            </Text>
            {wit.error ? <Text className="mt-2 text-sm text-status-error">{wit.error}</Text> : null}
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
                <Button label="Disconnect" onPress={() => void wit.disconnect()} size="sm" variant="secondary" />
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
              Magnetic: {valueOrDash(wit.liveData.magnetic?.x)} / {valueOrDash(wit.liveData.magnetic?.y)} /{' '}
              {valueOrDash(wit.liveData.magnetic?.z)}
            </Text>
            <Text className="text-sm text-text-primary">
              Battery: {valueOrDash(wit.liveData.batteryPercent, 0)}% ({valueOrDash(wit.liveData.batteryVoltage)} V)
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
              {anchorAngleRef.current != null
                ? `  anchor: ${anchorAngleRef.current.y.toFixed(1)}°`
                : '  (no anchor set)'}
            </Text>
            {angleData.length > 1 ? (
              <SignedChart data={angleData} yRange={45} unitLabel="°" color="#f59e0b" zeroLabel="anchor" />
            ) : (
              <View className="items-center rounded-lg border border-border-light bg-bg-primary py-8">
                <Text className="text-xs text-text-tertiary">Press Set Anchor then tilt the device</Text>
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
                      <View className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
                      <Text className="text-xs text-text-secondary">
                        {item.label} · {valueOrDash(item.value)}
                      </Text>
                    </View>
                  ))}
                </View>
              </>
            ) : (
              <View className="items-center rounded-lg border border-border-light bg-bg-primary py-8">
                <Text className="text-xs text-text-tertiary">Connect a device to see raw accel</Text>
              </View>
            )}
          </View>

          <View className="rounded-xl border border-border-accent bg-bg-overlay p-4">
            <Text className="mb-1 font-bold text-text-primary">Rep signal (adaptive)</Text>
            <Text className="mb-3 text-xs text-text-tertiary">
              smoothMag − baseline · ACTIVE when &gt;{RISE_G} g · now: {liveFeature.toFixed(3)} g
            </Text>
            {smoothData.length > 1 ? (
              <SignedChart data={smoothData} yRange={0.5} unitLabel="g" color="#f97316" zeroLabel="0g" />
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
              HPF-integrated acceleration · + = up · − = down · Velocity: {(velocityMs * 100).toFixed(1)} cm/s
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
              <SignedChart data={posData} yRange={50} unitLabel="cm" color="#60a5fa" zeroLabel="anchor" />
            ) : (
              <View className="items-center rounded-lg border border-border-light bg-bg-primary py-8">
                <Text className="text-xs text-text-tertiary">Press Set Anchor then move the device</Text>
              </View>
            )}
          </View>

          <View className="rounded-xl border border-border-accent bg-bg-overlay p-4">
            <Text className="mb-3 font-bold text-text-primary">Commands</Text>
            <View className="flex-row flex-wrap gap-2">
              <Button label="Reset" onPress={() => void wit.reset()} size="sm" variant="secondary" />
              <Button label="Angle 0" onPress={() => void wit.setAngleZero()} size="sm" variant="secondary" />
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
        </View>
      </ScrollView>
    </MasterLayout>
  );
}
