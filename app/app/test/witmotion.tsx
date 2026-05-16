import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Svg, { Line as SvgLine, Polyline, Text as SvgText } from 'react-native-svg';

import { MasterLayout } from '@/components/MasterLayout';
import { Button } from '@/components/theme/Button';
import { useWitMotion, witMotionClient } from '@/modules/witmotion-ble';
import type { WitMotionVector3 } from '@/modules/witmotion-ble';

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

// Rep counting via peak detection on EMA-smoothed net vertical acceleration.
// No integration, no anchor, no drift. Uses AHRS angles only for gravity projection.
// Research: Zelman 2020, RecoFit 2014 — peak detection on LPF-smoothed accel is most reliable.
//
// EMA_ALPHA = 0.25  →  τ = dt*(1-α)/α = 0.01*0.75/0.25 = 30 ms  →  cutoff ≈ 5.3 Hz
// This preserves rep dynamics (0.3–2 Hz) while smoothing sensor noise.
const REP_EMA_ALPHA = 0.25;
const REP_UPPER_G = 0.15;  // smoothed net vertical accel must exceed this to start a rep
const REP_LOWER_G = 0.03;  // must drop below this to complete the rep (hysteresis)
const REP_MIN_PEAK_MS = 150;   // concentric phase must last at least 150 ms
const REP_REFRACTORY_MS = 800; // minimum ms between consecutive rep counts

type RepPhase = 'IDLE' | 'CONCENTRIC';

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

  const labels: Array<[number, string]> = [
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

export default function WitMotionTestScreen() {
  const wit = useWitMotion();
  const requestPermissions = wit.requestPermissions;

  const velBufRef = useRef<number[]>([]);
  const posBufRef = useRef<number[]>([]);
  const angleBufRef = useRef<number[]>([]);
  const [velData, setVelData] = useState<number[]>([]);
  const [posData, setPosData] = useState<number[]>([]);
  const [angleData, setAngleData] = useState<number[]>([]);

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

  // Vertical-accel peak detection rep state — mutated inside onBatch, never causes renders
  const repRef = useRef({
    phase: 'IDLE' as RepPhase,
    repCount: 0,
    smoothVert: 0,       // EMA-filtered net vertical accel (g)
    peakStartMs: null as number | null,
    lastRepMs: null as number | null,
  });

  // Buffer for the smoothed vertical accel chart
  const smoothBufRef = useRef<number[]>([]);
  const [smoothData, setSmoothData] = useState<number[]>([]);

  // React state for display (updated at 20 Hz via the interval timer)
  const [positionCm, setPositionCm] = useState(0);
  const [velocityMs, setVelocityMs] = useState(0);
  const [repCount, setRepCount] = useState(0);
  const [repPhase, setRepPhase] = useState<RepPhase>('IDLE');
  const [liveSmooth, setLiveSmooth] = useState(0);

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

        const wallGapS = integ.lastTs !== null ? (timestamp - integ.lastTs) / 1000 : 0;
        const isGap = wallGapS > RECONNECT_GAP_S;
        integ.lastTs = timestamp;

        if (isGap) {
          integ.prevAVert = 0;
          integ.hpfAccel = 0;
          integ.rawVel = 0;
          integ.prevRawVel = 0;
          integ.hpfVel = 0;
          integ.stillCount = 0;
          rep.phase = 'IDLE';
          rep.smoothVert = 0;
          rep.peakStartMs = null;
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

        // Peak detection on EMA-smoothed net vertical acceleration.
        // aVert is already gravity-subtracted (0 at rest, + when pushed upward).
        // No anchor needed — the AHRS projection handles any sensor orientation.
        rep.smoothVert = REP_EMA_ALPHA * aVert + (1 - REP_EMA_ALPHA) * rep.smoothVert;

        const nowMs = Date.now();
        const msSinceLastRep = rep.lastRepMs !== null ? nowMs - rep.lastRepMs : Infinity;

        if (rep.phase === 'IDLE') {
          if (rep.smoothVert > REP_UPPER_G && msSinceLastRep > REP_REFRACTORY_MS) {
            rep.phase = 'CONCENTRIC';
            rep.peakStartMs = nowMs;
          }
        } else if (rep.phase === 'CONCENTRIC') {
          if (rep.smoothVert < REP_LOWER_G) {
            const peakMs = nowMs - (rep.peakStartMs ?? nowMs);
            if (peakMs >= REP_MIN_PEAK_MS) {
              rep.repCount += 1;
              rep.lastRepMs = nowMs;
            }
            rep.phase = 'IDLE';
            rep.peakStartMs = null;
          }
        }

        // Push to chart buffer every 5 packets (100 Hz → 20 Hz chart data → ~9 s visible)
        integ.chartTick = (integ.chartTick + 1) % 5;
        if (integ.chartTick === 0) {
          const vel2 = velBufRef.current;
          vel2.push(integ.hpfVel * 100); // m/s → cm/s
          if (vel2.length > CHART_MAX_POINTS) vel2.splice(0, vel2.length - CHART_MAX_POINTS);

          const pos = posBufRef.current;
          pos.push(integ.position * 100); // m → cm
          if (pos.length > CHART_MAX_POINTS) pos.splice(0, pos.length - CHART_MAX_POINTS);

          const anchor = anchorAngleRef.current;
          const aDelta = anchor !== null ? angle.y - anchor.y : 0;
          const ang = angleBufRef.current;
          ang.push(aDelta);
          if (ang.length > CHART_MAX_POINTS) ang.splice(0, ang.length - CHART_MAX_POINTS);

          // Smoothed vertical accel — the signal the rep counter actually uses
          const sm = smoothBufRef.current;
          sm.push(rep.smoothVert);
          if (sm.length > CHART_MAX_POINTS) sm.splice(0, sm.length - CHART_MAX_POINTS);
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
      setPositionCm(integRef.current.position * 100);
      setVelocityMs(integRef.current.hpfVel);
      setRepCount(repRef.current.repCount);
      setRepPhase(repRef.current.phase);
      setLiveSmooth(repRef.current.smoothVert);
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
  }, []);

  const handleResetReps = useCallback(() => {
    const rep = repRef.current;
    rep.repCount = 0;
    rep.phase = 'IDLE';
    rep.smoothVert = 0;
    rep.peakStartMs = null;
    rep.lastRepMs = null;
    smoothBufRef.current = [];
  }, []);

  const phaseColor = repPhase === 'CONCENTRIC' ? '#4ade80' : '#888';
  const phaseLabel = repPhase === 'CONCENTRIC' ? '↑ LIFTING' : 'REST';

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
                signal: <Text className="font-bold">{liveSmooth.toFixed(3)} g</Text>
                {'  '}threshold: {REP_UPPER_G} g
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

          {/* Smoothed vertical accel — the signal the rep counter reads */}
          <View className="rounded-xl border border-border-accent bg-bg-overlay p-4">
            <Text className="mb-1 font-bold text-text-primary">Rep signal (smoothed vert. accel)</Text>
            <Text className="mb-3 text-xs text-text-tertiary">
              EMA-filtered net vertical accel · counts rep when above {REP_UPPER_G} g · now: {liveSmooth.toFixed(3)} g
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
