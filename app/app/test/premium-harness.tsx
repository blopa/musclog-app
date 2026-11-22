/**
 * Premium identity harness: a TEST TOOL for the RevenueCat identity matrix (G2/G9) and the
 * on-device crypto timing (G11) of plan docs/plans/musclog-premium.md (6.1, 11, 15). Not a feature.
 *
 * Entry is the deep link `com.werules.logger://app/test/premium-harness`; nothing links here.
 * The route is guarded by `app/app/test/_layout.tsx`: in a production build it is reachable only
 * with the flag `EXPO_PUBLIC_PREMIUM_HARNESS=1` (the `premium-harness` EAS profile). This screen
 * repeats that check at render time and touches no SDK or key when it fails.
 *
 * There is deliberately no RevenueCat logOut here: the matrix must observe what a stuck identity does.
 */

import * as Clipboard from 'expo-clipboard';
import * as Crypto from 'expo-crypto';
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Platform, ScrollView, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/theme/Button';
import { useTheme } from '@/hooks/useTheme';
import {
  DEVICE_KEY_STORAGE_DESCRIPTION,
  type DeviceKeyInfo,
  getOrCreateDeviceKey,
  loadDeviceKeyInfo,
  resetDeviceKey,
  signWithDeviceKey,
} from '@/services/premium/deviceKeyStore';
import {
  buyMonthly,
  configureRevenueCat,
  getConfiguredAppUserId,
  logInTo,
  restorePurchases,
  revenueCatApiKey,
} from '@/services/premium/revenueCat';
import {
  fetchOfferings,
  getCustomerInfoDump,
  syncPurchases,
} from '@/services/premium/revenueCatHarness';
import {
  generateDeviceKey,
  hexToBytes,
  signDeviceMessage,
  verifyDeviceSignature,
} from '@/utils/premium/deviceKeyCrypto';
import { premiumHarnessBuildEnabled } from '@/utils/premium/harnessGuard';
import {
  describeError,
  type HarnessAction,
  type HarnessLogEntry,
  makeLogEntry,
  serializeLog,
} from '@/utils/premium/harnessResult';
import {
  type FetchLike,
  hostedChallenge,
  hostedEnroll,
  type HostedResult,
  hostedSession,
  redactTokens,
} from '@/utils/premium/hostedClient';
import { summarizeTimings, type TimingSummary } from '@/utils/premium/timingStats';

const HOSTED_BASE_URL = process.env.EXPO_PUBLIC_HOSTED_AI_BASE_URL;
const RUN_OPTIONS = [10, 30, 100];
const YIELD_EVERY = 5;

function isHermes(): boolean {
  return Boolean((global as unknown as { HermesInternal?: unknown }).HermesInternal);
}

function yesNo(value: boolean): string {
  return value ? 'yes' : 'no';
}

function pause(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

// ---------------------------------------------------------------------------------------------
// Small presentational pieces
// ---------------------------------------------------------------------------------------------

function Section({ title, children }: { title: string; children: ReactNode }) {
  const theme = useTheme();

  return (
    <View
      style={{
        backgroundColor: theme.colors.background.card,
        borderRadius: 12,
        gap: 8,
        padding: 12,
      }}
    >
      <Text style={{ color: theme.colors.text.primary, fontSize: 16, fontWeight: '700' }}>
        {title}
      </Text>
      {children}
    </View>
  );
}

function Line({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  const theme = useTheme();

  return (
    <View>
      <Text style={{ color: theme.colors.text.secondary, fontSize: 12 }}>{label}</Text>
      <Text
        selectable
        style={{
          color: warn ? theme.colors.status.error : theme.colors.text.primary,
          fontSize: 13,
        }}
      >
        {value}
      </Text>
    </View>
  );
}

function Note({ text, warn }: { text: string; warn?: boolean }) {
  const theme = useTheme();

  return (
    <Text
      style={{
        color: warn ? theme.colors.status.warning : theme.colors.text.secondary,
        fontSize: 12,
      }}
    >
      {text}
    </Text>
  );
}

// ---------------------------------------------------------------------------------------------
// State hooks
// ---------------------------------------------------------------------------------------------

type KeyState = {
  info: DeviceKeyInfo | null;
  loadError: string | null;
  reload: () => Promise<void>;
};

/** Reads the stored key on open. Never creates one. */
function useStoredKey(): KeyState {
  const [info, setInfo] = useState<DeviceKeyInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const reload = useCallback(async () => {
    try {
      setInfo(await loadDeviceKeyInfo());
      setLoadError(null);
    } catch (e) {
      setLoadError(describeError(e)?.message ?? 'unknown error');
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    loadDeviceKeyInfo().then(
      (loaded) => {
        if (!cancelled) {
          setInfo(loaded);
        }
      },
      (e: unknown) => {
        if (!cancelled) {
          setLoadError(describeError(e)?.message ?? 'unknown error');
        }
      }
    );

    return () => {
      cancelled = true;
    };
  }, []);

  return { info, loadError, reload };
}

type Runner = {
  log: HarnessLogEntry[];
  busy: boolean;
  run: (action: HarnessAction, fn: () => Promise<unknown>, rcId?: string | null) => Promise<void>;
  clear: () => void;
};

/** One logged, serialized action at a time. Never throws to the UI. */
function useActionRunner(currentRcId: string | null): Runner {
  const [log, setLog] = useState<HarnessLogEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const nextId = useRef(1);
  const busyRef = useRef(false);

  const run = useCallback(
    async (action: HarnessAction, fn: () => Promise<unknown>, rcId?: string | null) => {
      if (busyRef.current) {
        return;
      }

      busyRef.current = true;
      setBusy(true);
      const startedAtIso = new Date().toISOString();
      const t0 = performance.now();
      let ok = true;
      let result: unknown = null;
      let error: HarnessLogEntry['error'] = null;

      try {
        result = await fn();
      } catch (e) {
        ok = false;
        error = describeError(e);
      }

      const entry = makeLogEntry({
        id: nextId.current,
        action,
        startedAtIso,
        durationMs: Math.round((performance.now() - t0) * 100) / 100,
        ok,
        rcId: rcId === undefined ? currentRcId : rcId,
        result,
        error,
      });

      nextId.current += 1;
      setLog((previous) => [...previous, entry]);
      busyRef.current = false;
      setBusy(false);
    },
    [currentRcId]
  );

  const clear = useCallback(() => setLog([]), []);

  return { log, busy, run, clear };
}

// ---------------------------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------------------------

function BuildInfoSection({ hasKey }: { hasKey: boolean }) {
  return (
    <Section title="Build">
      <Note
        text="Test tool for the RevenueCat identity matrix (G2/G9). Not a feature. Sandbox accounts only."
        warn
      />
      <Line
        label="Platform / __DEV__ / Hermes"
        value={`${Platform.OS} / ${yesNo(__DEV__)} / ${yesNo(isHermes())}`}
      />
      <Note
        text={
          hasKey
            ? `${Platform.OS === 'ios' ? 'iOS' : 'Android'} key present`
            : 'No RevenueCat key: set EXPO_PUBLIC_REVENUECAT_IOS_KEY / EXPO_PUBLIC_REVENUECAT_ANDROID_KEY at build time'
        }
      />
    </Section>
  );
}

function IdentitySection({
  keyState,
  runner,
  onCreate,
}: {
  keyState: KeyState;
  runner: Runner;
  onCreate: () => void;
}) {
  const { info, loadError } = keyState;
  const configured = getConfiguredAppUserId();
  const mismatch = info !== null && configured !== null && configured !== info.rcId;

  return (
    <Section title="Identity">
      {loadError ? <Note text={`Key load failed: ${loadError}`} warn /> : null}
      {info ? (
        <>
          <Line label="rc_id" value={info.rcId} />
          <Button
            label="Copy rc_id"
            variant="outline"
            onPress={() => void Clipboard.setStringAsync(info.rcId)}
          />
          <Line
            label="Public key (hex, start)"
            value={`${info.publicKeyHex.slice(0, 24)}... (${info.publicKeyHex.length / 2} bytes)`}
          />
          <Button
            label="Copy public key"
            variant="outline"
            onPress={() => void Clipboard.setStringAsync(info.publicKeyHex)}
          />
          <Line label="Key created" value={new Date(info.createdAtMs).toISOString()} />
        </>
      ) : (
        <Note text="No device key yet. Opening this screen does not create one." />
      )}
      <Line label="Storage" value={DEVICE_KEY_STORAGE_DESCRIPTION} />
      <Line
        label="RevenueCat configured app user id"
        value={configured ?? '(not configured)'}
        warn={mismatch}
      />
      {mismatch ? (
        <Note
          warn
          text="MISMATCH: RevenueCat is configured under an id that differs from this key's rc_id."
        />
      ) : null}
      {info ? null : <Button label="Create key" disabled={runner.busy} onPress={onCreate} />}
    </Section>
  );
}

function RevenueCatSection({
  keyState,
  runner,
  onResetKey,
}: {
  keyState: KeyState;
  runner: Runner;
  onResetKey: () => void;
}) {
  const [logInId, setLogInId] = useState('');
  const theme = useTheme();
  const { run, busy } = runner;
  const rcId = keyState.info?.rcId ?? null;

  return (
    <Section title="RevenueCat actions">
      <Button
        label="Configure RevenueCat"
        disabled={busy}
        onPress={() =>
          void run('configure', async () => {
            if (!rcId) {
              throw new Error('No device key: create one first');
            }

            return configureRevenueCat(rcId);
          })
        }
      />
      <Button
        label="Fetch offerings"
        disabled={busy}
        onPress={() => void run('offerings', fetchOfferings)}
      />
      <Button
        label="Buy monthly"
        disabled={busy}
        onPress={() => void run('buyMonthly', buyMonthly)}
      />
      <Button
        label="Restore"
        disabled={busy}
        onPress={() => void run('restore', restorePurchases)}
      />
      <Button
        label="syncPurchases"
        disabled={busy}
        onPress={() => void run('syncPurchases', syncPurchases)}
      />
      <TextInput
        autoCapitalize="none"
        autoCorrect={false}
        onChangeText={setLogInId}
        placeholder="App user id to log in to"
        placeholderTextColor={theme.colors.text.secondary}
        style={{
          borderColor: theme.colors.text.secondary,
          borderRadius: 8,
          borderWidth: 1,
          color: theme.colors.text.primary,
          padding: 8,
        }}
        value={logInId}
      />
      <Button
        label="logIn to this id"
        disabled={busy}
        onPress={() => void run('logIn', () => logInTo(logInId.trim()))}
      />
      <Button
        label="getCustomerInfo dump"
        disabled={busy}
        onPress={() => void run('customerInfo', getCustomerInfoDump)}
      />
      <Button label="Reset key" variant="discard" disabled={busy} onPress={onResetKey} />
    </Section>
  );
}

async function hostedFetch(url: string, init?: Parameters<FetchLike>[1]) {
  return fetch(url, init);
}

function HostedSection({ keyState, runner }: { keyState: KeyState; runner: Runner }) {
  const { run, busy } = runner;
  const info = keyState.info;
  const base = HOSTED_BASE_URL ?? '';

  const challenge = async (): Promise<HostedResult> => {
    const result = await hostedChallenge(base, hostedFetch);

    return result;
  };

  const nonceOf = (result: HostedResult): string => {
    const nonce = (result.body as { nonce?: unknown } | null)?.nonce;

    if (!result.ok || typeof nonce !== 'string') {
      throw new Error(`Challenge failed: HTTP ${result.status} ${result.errorCode ?? ''}`);
    }

    return nonce;
  };

  const shown = (result: HostedResult) => ({
    status: result.status,
    errorCode: result.errorCode,
    body: redactTokens(result.body),
  });

  const enroll = async () => {
    const nonce = nonceOf(await challenge());
    const signed = await signWithDeviceKey('enroll', nonce);
    const result = await hostedEnroll(
      base,
      {
        rcId: signed.rcId,
        publicKey: hexToBytes(signed.publicKeyHex),
        nonce,
        signature: hexToBytes(signed.signatureHex),
      },
      hostedFetch
    );

    return shown(result);
  };

  const session = async () => {
    const nonce = nonceOf(await challenge());
    const signed = await signWithDeviceKey('session', nonce);
    const result = await hostedSession(
      base,
      { rcId: signed.rcId, nonce, signature: hexToBytes(signed.signatureHex) },
      hostedFetch
    );

    return shown(result);
  };

  return (
    <Section title="Hosted Worker">
      <Line label="EXPO_PUBLIC_HOSTED_AI_BASE_URL" value={base} />
      <Button
        label="Challenge"
        disabled={busy}
        onPress={() => void run('hostedChallenge', async () => shown(await challenge()))}
      />
      <Button
        label="Enroll"
        disabled={busy || !info}
        onPress={() => void run('hostedEnroll', enroll)}
      />
      <Button
        label="Session"
        disabled={busy || !info}
        onPress={() => void run('hostedSession', session)}
      />
    </Section>
  );
}

async function timeIterations(count: number, work: () => void): Promise<number[]> {
  const samples: number[] = [];

  for (let i = 0; i < count; i += 1) {
    const t0 = performance.now();
    work();
    samples.push(performance.now() - t0);

    if ((i + 1) % YIELD_EVERY === 0) {
      await pause();
    }
  }

  return samples;
}

type BenchResult = { keygen: TimingSummary; sign: TimingSummary; verify: TimingSummary };

async function runCryptoBench(runs: number): Promise<BenchResult> {
  const keygen = await timeIterations(runs, () => {
    generateDeviceKey(Crypto.getRandomBytes(48));
  });
  const { secretKey, publicKey } = generateDeviceKey(Crypto.getRandomBytes(48));
  const rcId = 'mlg1_bench';
  const signature = signDeviceMessage(secretKey, 'enroll', rcId, 'nonce');
  const sign = await timeIterations(runs, () => {
    signDeviceMessage(secretKey, 'enroll', rcId, 'nonce');
  });
  const verify = await timeIterations(runs, () => {
    verifyDeviceSignature(publicKey, 'enroll', rcId, 'nonce', signature);
  });

  return {
    keygen: summarizeTimings(keygen),
    sign: summarizeTimings(sign),
    verify: summarizeTimings(verify),
  };
}

function formatMs(value: number | null): string {
  return value === null ? '-' : value.toFixed(2);
}

function TimingRow({ name, stats }: { name: string; stats: TimingSummary }) {
  return (
    <Line
      label={name}
      value={`n=${stats.n} min=${formatMs(stats.minMs)} median=${formatMs(stats.medianMs)} p95=${formatMs(stats.p95Ms)} max=${formatMs(stats.maxMs)} ms`}
    />
  );
}

function BenchSection({ runner }: { runner: Runner }) {
  const [runs, setRuns] = useState(30);
  const [result, setResult] = useState<BenchResult | null>(null);
  const hasGetRandomValues = typeof globalThis.crypto?.getRandomValues === 'function';

  return (
    <Section title="G11 crypto timing">
      <Line
        label="BigInt / crypto.getRandomValues / Hermes"
        value={`${typeof BigInt} / ${yesNo(hasGetRandomValues)} / ${yesNo(isHermes())}`}
      />
      <Line label="Platform / version" value={`${Platform.OS} ${String(Platform.Version)}`} />
      <Line label="__DEV__" value={yesNo(__DEV__)} />
      <Note text="Dev builds are 10-100x slower: only a release build counts for G11" warn />
      <Note text="Android 12+ extraction rules: checked at build time by utils/premium/__tests__/androidSecureStoreBackup.test.ts" />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {RUN_OPTIONS.map((option) => (
          <Button
            key={option}
            label={`${option} runs`}
            size="sm"
            variant={option === runs ? 'accent' : 'outline'}
            onPress={() => setRuns(option)}
          />
        ))}
      </View>
      <Button
        label="Run crypto timing"
        disabled={runner.busy}
        onPress={() =>
          void runner.run('bench', async () => {
            const bench = await runCryptoBench(runs);
            setResult(bench);

            return { runs, ...bench };
          })
        }
      />
      {result ? (
        <>
          <TimingRow name="keygen" stats={result.keygen} />
          <TimingRow name="sign" stats={result.sign} />
          <TimingRow name="verify" stats={result.verify} />
        </>
      ) : null}
    </Section>
  );
}

function LogEntryView({ entry }: { entry: HarnessLogEntry }) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const badge = entry.ok ? 'OK' : 'ERR';

  return (
    <View style={{ gap: 4 }}>
      <Text
        onPress={() => setOpen((value) => !value)}
        style={{
          color: entry.ok ? theme.colors.text.primary : theme.colors.status.error,
          fontSize: 13,
        }}
      >
        {`#${entry.id} ${entry.action} ${entry.startedAtIso} [${badge}] ${entry.durationMs} ms ${open ? '(hide)' : '(show)'}`}
      </Text>
      {open ? (
        <Text
          selectable
          style={{ color: theme.colors.text.secondary, fontFamily: 'monospace', fontSize: 11 }}
        >
          {JSON.stringify({ rcId: entry.rcId, result: entry.result, error: entry.error }, null, 2)}
        </Text>
      ) : null}
    </View>
  );
}

function LogSection({ runner }: { runner: Runner }) {
  return (
    <Section title="Log">
      {runner.log.length === 0 ? <Note text="Nothing logged yet." /> : null}
      {runner.log.map((entry) => (
        <LogEntryView key={entry.id} entry={entry} />
      ))}
      <Button
        label="Copy log as JSON"
        variant="outline"
        onPress={() => void Clipboard.setStringAsync(serializeLog(runner.log))}
      />
      <Button label="Clear log" variant="outline" onPress={runner.clear} />
    </Section>
  );
}

// ---------------------------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------------------------

function Harness() {
  const theme = useTheme();
  const keyState = useStoredKey();
  const runner = useActionRunner(keyState.info?.rcId ?? null);
  const hasRevenueCatKey = revenueCatApiKey() !== null;
  const { reload } = keyState;
  const { run } = runner;

  const createKey = () =>
    void run('configure', async () => {
      const created = await getOrCreateDeviceKey();
      await reload();

      return { createdKey: true, rcId: created.rcId };
    });

  const performReset = () =>
    void run('resetKey', async () => {
      const created = await resetDeviceKey();
      await reload();

      return {
        newRcId: created.rcId,
        note: 'RevenueCat stays configured under the old id until the app is restarted or logIn is used. No RevenueCat call was made.',
      };
    });

  const confirmReset = () =>
    Alert.alert(
      'Reset key',
      'This deletes the device key and creates a new one. The old rc_id cannot be recovered.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reset', style: 'destructive', onPress: performReset },
      ]
    );

  return (
    <ScrollView style={{ backgroundColor: theme.colors.background.primary, flex: 1 }}>
      <View style={{ gap: 12, padding: 16, paddingBottom: 48, paddingTop: 48 }}>
        <BuildInfoSection hasKey={hasRevenueCatKey} />
        <IdentitySection keyState={keyState} runner={runner} onCreate={createKey} />
        {hasRevenueCatKey ? (
          <RevenueCatSection keyState={keyState} runner={runner} onResetKey={confirmReset} />
        ) : (
          <Section title="RevenueCat actions">
            <Note text="No RevenueCat key in this build, so no RevenueCat action is offered." />
            <Button
              label="Reset key"
              variant="discard"
              disabled={runner.busy}
              onPress={confirmReset}
            />
          </Section>
        )}
        {HOSTED_BASE_URL ? <HostedSection keyState={keyState} runner={runner} /> : null}
        <BenchSection runner={runner} />
        <LogSection runner={runner} />
      </View>
    </ScrollView>
  );
}

export default function PremiumHarnessScreen() {
  if (!__DEV__ && !premiumHarnessBuildEnabled()) {
    return (
      <View style={{ flex: 1, padding: 24 }}>
        <Text>Not available.</Text>
      </View>
    );
  }

  return <Harness />;
}
