/**
 * TEMPORARY — Optical Transfer Phase 0 bench.
 *
 * Deliberately NOT under `app/app/test/`: that route group's layout redirects to /app whenever
 * `isProduction()`, and the measurements here are only meaningful on a release build (dev-mode
 * Hermes and the unminified bundle distort every timing). Delete this file, its route, and the
 * temporary Home entry point once the go/no-go decision is recorded.
 *
 * What it answers:
 *   A4  Does Hermes reproduce the fountain's dlog digest? If not, two phones desync silently.
 *   A1  What does one QR frame cost to generate? Decides live generation vs. another strategy.
 *   A3  How big is a real database dump, and how well does it gzip? Decides transfer time.
 *   A2  What does the receiving camera actually see and decode? The decisive one — especially
 *       the analysis resolution, which on Android we do not get to choose.
 */

import { useRouter } from 'expo-router';
import { gzipSync } from 'fflate';
import { ArrowLeft } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useCameraPermission } from 'react-native-vision-camera';

import { OpticalQrCanvas } from '@/components/optical/OpticalQrCanvas';
import { OpticalScannerCamera } from '@/components/optical/OpticalScannerCamera';
import { Button } from '@/components/theme/Button';
import { dumpDatabase } from '@/database/exportDb';
import { useKeepScreenAwake } from '@/hooks/useKeepScreenAwake';
import { useTheme } from '@/hooks/useTheme';
import {
  benchQrEncode,
  type DlogSweepResult,
  type EncodeBenchRow,
  runDlogSweep,
  suggestedFpsForFrameCost,
} from '@/utils/optical/bench';
import {
  base44CharsForBytes,
  getOpticalPreset,
  OPTICAL_PRESETS,
  type OpticalPresetId,
  QR_QUIET_ZONE_MODULES,
} from '@/utils/optical/presets';
import { estimateTransferProgress } from '@/utils/optical/progress';
import { encodeQrAlphanumericFixed } from '@/utils/optical/qrEncode';
import { type QrRaster, rasterizeQr } from '@/utils/optical/qrRaster';
import { OpticalReceiver } from '@/utils/optical/receiverSession';
import { newOpticalSessionId, OpticalStream } from '@/utils/optical/senderSession';

type BenchMode = 'bench' | 'send' | 'receive';
type PayloadSourceId = '25kb' | '100kb' | '500kb' | 'realdb';

/** Frames generated ahead of the display tick, so one slow encode does not drop a frame. */
const LOOKAHEAD = 4;

const nowMs = (): number =>
  typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();

const fmtBytes = (n: number): string =>
  n < 1024
    ? `${n} B`
    : n < 1024 * 1024
      ? `${(n / 1024).toFixed(1)} KB`
      : `${(n / 1048576).toFixed(2)} MB`;

function syntheticPayload(byteLength: number): Uint8Array {
  // Pseudo-random so it does not compress — a synthetic payload that gzips to nothing would
  // flatter the measurement.
  const payload = new Uint8Array(byteLength);
  let seed = 0x12345678;
  for (let i = 0; i < byteLength; i++) {
    seed = (Math.imul(seed, 1103515245) + 12345) | 0;
    payload[i] = (seed >>> 16) & 0xff;
  }

  return payload;
}

export default function OpticalBenchScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [mode, setMode] = useState<BenchMode>('bench');

  return (
    <View style={{ backgroundColor: theme.colors.background.primary, flex: 1 }}>
      <View
        style={{
          alignItems: 'center',
          flexDirection: 'row',
          gap: 12,
          paddingHorizontal: 16,
          paddingTop: 56,
          paddingBottom: 12,
        }}
      >
        <Pressable hitSlop={12} onPress={() => router.back()}>
          <ArrowLeft color={theme.colors.text.primary} size={24} />
        </Pressable>
        <Text
          style={{
            color: theme.colors.text.primary,
            fontSize: theme.typography.fontSize.lg,
            fontWeight: '700',
          }}
        >
          Optical Transfer — bench
        </Text>
      </View>

      <ChipRow
        onSelect={(value) => setMode(value as BenchMode)}
        options={[
          { label: 'Bench', value: 'bench' },
          { label: 'Send', value: 'send' },
          { label: 'Receive', value: 'receive' },
        ]}
        selected={mode}
      />

      {mode === 'bench' ? <BenchPanel /> : null}
      {mode === 'send' ? <SendPanel /> : null}
      {mode === 'receive' ? <ReceivePanel /> : null}
    </View>
  );
}

/* ------------------------------------------------------------------ shared UI */

function ChipRow({
  options,
  selected,
  onSelect,
}: {
  options: { label: string; value: string }[];
  selected: string;
  onSelect: (value: string) => void;
}) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16 }}>
      {options.map((option) => {
        const active = option.value === selected;
        return (
          <Pressable
            key={option.value}
            onPress={() => onSelect(option.value)}
            style={{
              backgroundColor: active
                ? theme.colors.accent.primary
                : theme.colors.background.cardElevated,
              borderRadius: 8,
              paddingHorizontal: 12,
              paddingVertical: 8,
            }}
          >
            <Text
              style={{
                color: active ? '#000000' : theme.colors.text.secondary,
                fontSize: theme.typography.fontSize.sm,
                fontWeight: '600',
              }}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View
      style={{
        backgroundColor: theme.colors.background.card,
        borderRadius: 12,
        gap: 10,
        padding: 16,
      }}
    >
      <Text
        style={{
          color: theme.colors.text.primary,
          fontSize: theme.typography.fontSize.base,
          fontWeight: '700',
        }}
      >
        {title}
      </Text>
      {children}
    </View>
  );
}

function Mono({ children, color }: { children: React.ReactNode; color?: string }) {
  const theme = useTheme();
  return (
    <Text
      style={{
        color: color ?? theme.colors.text.secondary,
        fontFamily: 'monospace',
        fontSize: theme.typography.fontSize.xs,
        lineHeight: 18,
      }}
    >
      {children}
    </Text>
  );
}

/* ------------------------------------------------------------------ A1/A3/A4 */

function BenchPanel() {
  const theme = useTheme();
  const [sweep, setSweep] = useState<DlogSweepResult | null>(null);
  const [sweepProgress, setSweepProgress] = useState<number | null>(null);
  const [rows, setRows] = useState<EncodeBenchRow[]>([]);
  const [encodeRunning, setEncodeRunning] = useState(false);
  const [payloadReport, setPayloadReport] = useState<string[]>([]);
  const [payloadRunning, setPayloadRunning] = useState(false);

  useKeepScreenAwake('optical-bench', true);

  const runSweep = useCallback(async () => {
    setSweep(null);
    setSweepProgress(0);
    const result = await runDlogSweep(setSweepProgress);
    setSweep(result);
    setSweepProgress(null);
  }, []);

  const runEncode = useCallback(async () => {
    setEncodeRunning(true);
    setRows([]);
    const collected: EncodeBenchRow[] = [];
    for (const preset of OPTICAL_PRESETS) {
      const row = await benchQrEncode(
        preset.id,
        preset.qrVersion,
        base44CharsForBytes(preset.frameBytes)
      );
      collected.push(row);
      setRows([...collected]);
    }
    setEncodeRunning(false);
  }, []);

  const runPayload = useCallback(async () => {
    setPayloadRunning(true);
    setPayloadReport(['Dumping database…']);
    try {
      const dumpStart = nowMs();
      const json = await dumpDatabase();
      const dumpMs = nowMs() - dumpStart;

      const encodeStart = nowMs();
      const plain = new TextEncoder().encode(json);
      const encodeMs = nowMs() - encodeStart;

      const lines = [
        `dumpDatabase()   ${dumpMs.toFixed(0)} ms`,
        `JSON chars       ${json.length.toLocaleString()}`,
        `UTF-8 bytes      ${fmtBytes(plain.length)}  (encode ${encodeMs.toFixed(0)} ms)`,
        '',
      ];
      setPayloadReport([...lines, 'Compressing…']);

      for (const level of [1, 6, 9] as const) {
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
        const start = nowMs();
        const gz = gzipSync(plain, { level });
        const ms = nowMs() - start;
        const ratio = plain.length / gz.length;
        lines.push(
          `gzip L${level}  ${fmtBytes(gz.length).padEnd(10)} ${ratio.toFixed(1)}x  ${ms.toFixed(0)} ms`
        );
        setPayloadReport([...lines]);
      }

      // Project transfer time at the default preset from the L6 result.
      const gz6 = gzipSync(plain, { level: 6 });
      const preset = getOpticalPreset('standard');
      const k = Math.ceil(gz6.length / preset.blockLen);
      lines.push(
        '',
        `At preset "standard" (${preset.blockLen} B/frame):`,
        `  k = ${k} source blocks`,
        `  ≈${Math.ceil(k * 1.25)} frames needed`,
        `  @10 fps ≈ ${Math.ceil((k * 1.25) / 10)} s`,
        `  @5 fps  ≈ ${Math.ceil((k * 1.25) / 5)} s`
      );
      setPayloadReport([...lines]);
    } catch (error) {
      setPayloadReport([`FAILED: ${error instanceof Error ? error.message : String(error)}`]);
    }
    setPayloadRunning(false);
  }, []);

  return (
    <ScrollView contentContainerStyle={{ gap: 12, padding: 16, paddingBottom: 60 }}>
      <Card title="A4 — Hermes determinism (run first)">
        <Mono>
          Sweeps every dlog() input the degree distribution can reach and hashes the result. Must
          match 0x27b0f3cc, the digest Node/V8 produces. A mismatch means two phones would sample
          different fountain degrees and no transfer would ever complete.
        </Mono>
        <Button
          disabled={sweepProgress !== null}
          label={
            sweepProgress === null ? 'Run sweep' : `Running… ${Math.round(sweepProgress * 100)}%`
          }
          onPress={runSweep}
          size="sm"
          variant="accent"
        />
        {sweep ? (
          <Mono color={sweep.matches ? theme.colors.status.success : theme.colors.status.error}>
            {sweep.matches ? '✓ PASS' : '✗ FAIL'}
            {'\n'}got {sweep.digest}
            {'\n'}expected {sweep.expected}
            {'\n'}
            {sweep.ms.toFixed(0)} ms
          </Mono>
        ) : null}
      </Card>

      <Card title="A1 — QR encode cost per frame">
        <Mono>
          p50/p90/max for generating one frame at each density, plus the rasterize step. Suggested
          fps caps frame generation at half the JS thread.
        </Mono>
        <Button
          disabled={encodeRunning}
          label={encodeRunning ? 'Running…' : 'Run encode benchmark'}
          onPress={runEncode}
          size="sm"
          variant="accent"
        />
        {rows.length > 0 ? (
          <Mono>
            {'preset    ver  enc50  enc90  encMax  rast  frame90  fps'}
            {'\n'}
            {rows
              .map(
                (row) =>
                  `${row.label.padEnd(9)} ${String(row.qrVersion).padStart(3)} ` +
                  `${row.encodeP50.toFixed(1).padStart(6)} ${row.encodeP90.toFixed(1).padStart(6)} ` +
                  `${row.encodeMax.toFixed(1).padStart(7)} ${row.rasterP50.toFixed(1).padStart(5)} ` +
                  `${row.frameP90.toFixed(1).padStart(8)} ${String(row.suggestedFps).padStart(4)}`
              )
              .join('\n')}
          </Mono>
        ) : null}
      </Card>

      <Card title="A3 — Real payload size and compressibility">
        <Mono>
          Runs the actual export and compresses it. The gzip ratio is what decides whether a real
          transfer takes one minute or ten.
        </Mono>
        <Button
          disabled={payloadRunning}
          label={payloadRunning ? 'Running…' : 'Measure my database'}
          onPress={runPayload}
          size="sm"
          variant="accent"
        />
        {payloadReport.length > 0 ? <Mono>{payloadReport.join('\n')}</Mono> : null}
      </Card>
    </ScrollView>
  );
}

/* ------------------------------------------------------------------ sender */

function SendPanel() {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const [presetId, setPresetId] = useState<OpticalPresetId>('standard');
  const [payloadSource, setPayloadSource] = useState<PayloadSourceId>('100kb');
  const [fps, setFps] = useState(10);
  const [isStreaming, setIsStreaming] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [raster, setRaster] = useState<QrRaster | null>(null);
  const [info, setInfo] = useState<string[]>([]);
  const [live, setLive] = useState({ displayed: 0, encP50: 0, encP90: 0, realFps: 0 });

  const streamRef = useRef<OpticalStream | null>(null);
  const queueRef = useRef<QrRaster[]>([]);
  const encodeTimesRef = useRef<number[]>([]);
  const displayedRef = useRef(0);
  const lastSampleRef = useRef({ at: 0, displayed: 0 });

  useKeepScreenAwake('optical-bench-send', isStreaming);

  const makeFrame = useCallback((): QrRaster | null => {
    const stream = streamRef.current;
    if (!stream) {
      return null;
    }
    const started = nowMs();
    const matrix = encodeQrAlphanumericFixed(stream.next(), stream.preset.qrVersion, 'L');
    const next = rasterizeQr(matrix.moduleCount, matrix.modules, QR_QUIET_ZONE_MODULES);
    encodeTimesRef.current.push(nowMs() - started);
    if (encodeTimesRef.current.length > 240) {
      encodeTimesRef.current.shift();
    }
    return next;
  }, []);

  const start = useCallback(async () => {
    setPreparing(true);
    try {
      let payload: Uint8Array;
      const notes: string[] = [];

      if (payloadSource === 'realdb') {
        const dumpStart = nowMs();
        const json = await dumpDatabase();
        const plain = new TextEncoder().encode(json);
        const gz = gzipSync(plain, { level: 6 });
        payload = gz;
        notes.push(
          `real DB: ${fmtBytes(plain.length)} → ${fmtBytes(gz.length)} gz ` +
            `(${(plain.length / gz.length).toFixed(1)}x, ${(nowMs() - dumpStart).toFixed(0)} ms)`
        );
      } else {
        const sizes: Record<string, number> = {
          '25kb': 25 * 1024,
          '100kb': 100 * 1024,
          '500kb': 500 * 1024,
        };
        payload = syntheticPayload(sizes[payloadSource]);
        notes.push(`synthetic incompressible payload: ${fmtBytes(payload.length)}`);
      }

      const preset = getOpticalPreset(presetId);
      const stream = new OpticalStream(payload, preset, newOpticalSessionId());
      streamRef.current = stream;
      queueRef.current = [];
      encodeTimesRef.current = [];
      displayedRef.current = 0;
      lastSampleRef.current = { at: nowMs(), displayed: 0 };

      notes.push(
        `k = ${stream.k} blocks · session ${stream.sessionId} · QR v${preset.qrVersion} · ` +
          `${preset.blockLen} B/frame`,
        `≈${Math.ceil(stream.k * 1.25)} frames ≈ ${Math.ceil((stream.k * 1.25) / fps)} s at ${fps} fps`
      );
      setInfo(notes);

      for (let i = 0; i < LOOKAHEAD; i++) {
        const frame = makeFrame();
        if (frame) {
          queueRef.current.push(frame);
        }
      }
      setIsStreaming(true);
    } catch (error) {
      setInfo([`FAILED: ${error instanceof Error ? error.message : String(error)}`]);
    }
    setPreparing(false);
  }, [payloadSource, presetId, fps, makeFrame]);

  const stop = useCallback(() => {
    setIsStreaming(false);
    setRaster(null);
    queueRef.current = [];
    streamRef.current = null;
  }, []);

  // Display tick: show one frame, then top the lookahead queue up by at most one. Capping
  // production at one frame per tick is what keeps generation amortised instead of bursting.
  useEffect(() => {
    if (!isStreaming) {
      return;
    }
    const id = setInterval(
      () => {
        const next = queueRef.current.shift();
        if (next) {
          setRaster(next);
          displayedRef.current++;
        }
        if (queueRef.current.length < LOOKAHEAD) {
          const frame = makeFrame();
          if (frame) {
            queueRef.current.push(frame);
          }
        }
      },
      Math.max(1, Math.round(1000 / fps))
    );
    return () => clearInterval(id);
  }, [isStreaming, fps, makeFrame]);

  useEffect(() => {
    if (!isStreaming) {
      return;
    }
    const id = setInterval(() => {
      const times = [...encodeTimesRef.current].sort((a, b) => a - b);
      const at = nowMs();
      const elapsed = (at - lastSampleRef.current.at) / 1000;
      const realFps =
        elapsed > 0 ? (displayedRef.current - lastSampleRef.current.displayed) / elapsed : 0;
      lastSampleRef.current = { at, displayed: displayedRef.current };
      setLive({
        displayed: displayedRef.current,
        encP50: times.length ? times[Math.floor(times.length * 0.5)] : 0,
        encP90: times.length ? times[Math.floor(times.length * 0.9)] : 0,
        realFps,
      });
    }, 1000);
    return () => clearInterval(id);
  }, [isStreaming]);

  if (isStreaming) {
    return (
      <View style={{ alignItems: 'center', flex: 1, justifyContent: 'center', gap: 12 }}>
        <OpticalQrCanvas
          budgetDp={Math.min(width - 24, Dimensions.get('window').height * 0.55)}
          raster={raster}
        />
        <Mono>
          {`frames ${live.displayed} · ${live.realFps.toFixed(1)} fps (target ${fps})`}
          {'\n'}
          {`encode p50 ${live.encP50.toFixed(1)} ms · p90 ${live.encP90.toFixed(1)} ms`}
          {'\n'}
          {`suggested fps for this device: ${suggestedFpsForFrameCost(live.encP90)}`}
        </Mono>
        <Mono color={theme.colors.text.tertiary}>
          No progress bar by design — the receiving phone shows progress.
        </Mono>
        <Button label="Stop" onPress={stop} size="sm" variant="discard" />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ gap: 16, padding: 16, paddingBottom: 60 }}>
      <View style={{ gap: 8 }}>
        <Mono color={theme.colors.text.primary}>Density</Mono>
        <ChipRow
          onSelect={(value) => setPresetId(value as OpticalPresetId)}
          options={OPTICAL_PRESETS.map((preset) => ({
            label: `${preset.id} (v${preset.qrVersion})`,
            value: preset.id,
          }))}
          selected={presetId}
        />
      </View>

      <View style={{ gap: 8 }}>
        <Mono color={theme.colors.text.primary}>Payload</Mono>
        <ChipRow
          onSelect={(value) => setPayloadSource(value as PayloadSourceId)}
          options={[
            { label: '25 KB', value: '25kb' },
            { label: '100 KB', value: '100kb' },
            { label: '500 KB', value: '500kb' },
            { label: 'Real DB (gz)', value: 'realdb' },
          ]}
          selected={payloadSource}
        />
      </View>

      <View style={{ gap: 8 }}>
        <Mono color={theme.colors.text.primary}>Target fps</Mono>
        <ChipRow
          onSelect={(value) => setFps(Number(value))}
          options={[4, 6, 8, 10, 12, 15, 20, 24].map((value) => ({
            label: String(value),
            value: String(value),
          }))}
          selected={String(fps)}
        />
      </View>

      <Button
        disabled={preparing}
        label={preparing ? 'Preparing…' : 'Start streaming'}
        onPress={start}
        size="md"
        variant="accent"
      />
      {preparing ? <ActivityIndicator color={theme.colors.accent.primary} /> : null}
      {info.length > 0 ? <Mono>{info.join('\n')}</Mono> : null}
    </ScrollView>
  );
}

/* ------------------------------------------------------------------ receiver */

interface ReceiveSnapshot {
  analysis: string;
  callbacksPerSec: number;
  codesPerSec: number;
  distinctPerSec: number;
  framesNew: number;
  framesDup: number;
  ignored: number;
  k: number;
  solved: number;
  totalLen: number;
  fraction: number;
  etaSeconds?: number;
  outcome: string;
  elapsed: number;
  throughput: number;
}

const emptySnapshot: ReceiveSnapshot = {
  analysis: '—',
  callbacksPerSec: 0,
  codesPerSec: 0,
  distinctPerSec: 0,
  framesNew: 0,
  framesDup: 0,
  ignored: 0,
  k: 0,
  solved: 0,
  totalLen: 0,
  fraction: 0,
  outcome: '',
  elapsed: 0,
  throughput: 0,
};

function ReceivePanel() {
  const theme = useTheme();
  const { hasPermission, requestPermission } = useCameraPermission();
  const [snapshot, setSnapshot] = useState<ReceiveSnapshot>(emptySnapshot);
  const [running, setRunning] = useState(true);

  const receiverRef = useRef(new OpticalReceiver());
  const analysisRef = useRef('—');
  const callbacksRef = useRef(0);
  const codesRef = useRef(0);
  const distinctRef = useRef(0);
  const outcomeRef = useRef('');
  const startedAtRef = useRef(0);
  const windowRef = useRef({ at: 0, callbacks: 0, codes: 0, distinct: 0 });

  useKeepScreenAwake('optical-bench-receive', true);

  // Identity-stable and writes only to refs. MLKit fires this many times a second; a setState
  // here would starve the thread doing the decode bookkeeping.
  const onCodeScanned = useCallback(
    (codes: { value?: string }[], frame: { width: number; height: number }) => {
      callbacksRef.current++;
      analysisRef.current = `${frame.width}×${frame.height}`;

      for (const code of codes) {
        if (!code.value) {
          continue;
        }
        codesRef.current++;
        if (startedAtRef.current === 0) {
          startedAtRef.current = nowMs();
        }
        const result = receiverRef.current.accept(code.value, Date.now());
        if (result === 'accepted' || result === 'reset' || result === 'complete') {
          distinctRef.current++;
        }
        if (result === 'complete' || result === 'checksum-failed') {
          outcomeRef.current = result;
        }
      }
    },
    []
  );

  useEffect(() => {
    const id = setInterval(() => {
      const stats = receiverRef.current.stats;
      const at = nowMs();
      const win = windowRef.current;
      const elapsedWindow = win.at === 0 ? 0 : (at - win.at) / 1000;

      const rates =
        elapsedWindow > 0
          ? {
              callbacksPerSec: (callbacksRef.current - win.callbacks) / elapsedWindow,
              codesPerSec: (codesRef.current - win.codes) / elapsedWindow,
              distinctPerSec: (distinctRef.current - win.distinct) / elapsedWindow,
            }
          : { callbacksPerSec: 0, codesPerSec: 0, distinctPerSec: 0 };

      windowRef.current = {
        at,
        callbacks: callbacksRef.current,
        codes: codesRef.current,
        distinct: distinctRef.current,
      };

      const elapsed = startedAtRef.current ? (at - startedAtRef.current) / 1000 : 0;
      const progress = estimateTransferProgress(
        stats.k,
        stats.framesNew,
        elapsed,
        stats.solvedBlocks
      );
      const container = receiverRef.current.takeContainer();

      setSnapshot({
        analysis: analysisRef.current,
        ...rates,
        framesNew: stats.framesNew,
        framesDup: stats.framesDup,
        ignored: stats.framesIgnored,
        k: stats.k,
        solved: stats.solvedBlocks,
        totalLen: stats.totalLen,
        fraction: progress.fraction,
        etaSeconds: progress.etaSeconds,
        outcome: outcomeRef.current,
        elapsed,
        throughput: container && elapsed > 0 ? container.length / elapsed : 0,
      });

      if (outcomeRef.current) {
        setRunning(false);
      }
    }, 250);
    return () => clearInterval(id);
  }, []);

  const reset = useCallback(() => {
    receiverRef.current.reset();
    callbacksRef.current = 0;
    codesRef.current = 0;
    distinctRef.current = 0;
    outcomeRef.current = '';
    startedAtRef.current = 0;
    windowRef.current = { at: 0, callbacks: 0, codes: 0, distinct: 0 };
    setSnapshot(emptySnapshot);
    setRunning(true);
  }, []);

  if (!hasPermission) {
    return (
      <View style={{ gap: 12, padding: 16 }}>
        <Mono>Camera permission is required to receive.</Mono>
        <Button
          label="Grant camera access"
          onPress={requestPermission}
          size="sm"
          variant="accent"
        />
      </View>
    );
  }

  const complete = snapshot.outcome === 'complete';
  const failed = snapshot.outcome === 'checksum-failed';

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flex: 1, overflow: 'hidden' }}>
        <OpticalScannerCamera active={running} onCodeScanned={onCodeScanned} />
      </View>

      <View style={{ backgroundColor: theme.colors.background.card, gap: 8, padding: 16 }}>
        <Mono
          color={
            failed
              ? theme.colors.status.error
              : complete
                ? theme.colors.status.success
                : theme.colors.text.primary
          }
        >
          {complete
            ? `✓ COMPLETE — ${fmtBytes(snapshot.totalLen)} in ${snapshot.elapsed.toFixed(1)} s ` +
              `(${fmtBytes(snapshot.throughput)}/s)`
            : failed
              ? '✗ CHECKSUM FAILED — reassembled but the payload hash did not match'
              : `${Math.round(snapshot.fraction * 100)}%` +
                (snapshot.etaSeconds ? ` · ETA ${Math.ceil(snapshot.etaSeconds)} s` : '')}
        </Mono>

        <Mono>
          {`analysis frame  ${snapshot.analysis}   ← THE number on Android`}
          {'\n'}
          {`callbacks/s ${snapshot.callbacksPerSec.toFixed(1)}  codes/s ${snapshot.codesPerSec.toFixed(1)}  distinct/s ${snapshot.distinctPerSec.toFixed(1)}`}
          {'\n'}
          {`frames new ${snapshot.framesNew}${snapshot.k ? ` / ~${Math.ceil(snapshot.k * 1.25)}` : ''}  dup ${snapshot.framesDup}  ignored ${snapshot.ignored}`}
          {'\n'}
          {`blocks ${snapshot.solved}/${snapshot.k}  payload ${snapshot.totalLen ? fmtBytes(snapshot.totalLen) : '—'}`}
        </Mono>

        <Button label="Reset" onPress={reset} size="sm" variant="outline" />
      </View>
    </View>
  );
}
