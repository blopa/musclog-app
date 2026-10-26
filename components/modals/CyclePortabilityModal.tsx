import * as DocumentPicker from 'expo-document-picker';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { CycleImportMapping } from '@/components/cycle/CycleImportMapping';
import { AreaLockGate } from '@/components/lock/AreaLockGate';
import { Button } from '@/components/theme/Button';
import { Chip } from '@/components/theme/Chip';
import { TextInput } from '@/components/theme/TextInput';
import { CycleTransferService } from '@/database/services/CycleTransferService';
import { useMenstrualCycle } from '@/hooks/useMenstrualCycle';
import { exportContextsCsv } from '@/services/cycleExport';
import { CycleNotificationService } from '@/services/CycleNotificationService';
import {
  decodeCycleFile,
  encryptCycleBackup,
  getCycleBackupPreparedAt,
  recordCycleBackupPrepared,
} from '@/services/cycleRecovery';
import {
  type ConflictChoice,
  parseCycleTransfer,
  serializeCycleTransfer,
} from '@/utils/cycle/cycleTransfer';
import { detectImportColumns } from '@/utils/cycle/externalImport';
import { readFileAsStringAsync, shareTextFile } from '@/utils/file';
import { timestampSlug } from '@/utils/timestampSlug';

import { FullScreenModal } from './FullScreenModal';

type Counts = { added: number; updated: number; skipped: number; overlaps: number };

export function CyclePortabilityModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const {
    cycle,
    pausedCycle,
    config,
    periods,
    dayLogs,
    contexts,
    moods,
    moodsLoading,
    moodsError,
  } = useMenstrualCycle();
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [importPassword, setImportPassword] = useState('');
  const [externalCsv, setExternalCsv] = useState<string | null>(null);
  const [incoming, setIncoming] = useState<string | null>(null);
  const [choice, setChoice] = useState<ConflictChoice>('keep');
  const [restorePreferences, setRestorePreferences] = useState(false);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [lastBackup, setLastBackup] = useState<number | null>(null);
  const tracked = cycle ?? pausedCycle;
  useEffect(() => {
    if (!visible) {
      return;
    }

    let cancelled = false;
    void getCycleBackupPreparedAt()
      .then((date) => {
        if (!cancelled) {
          setLastBackup(date);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [visible]);
  useEffect(() => {
    if (!visible || !incoming) {
      return;
    }

    let cancelled = false;
    void CycleTransferService.preview(tracked, incoming, choice, !tracked || restorePreferences)
      .then((result) => {
        if (!cancelled) {
          setCounts(result);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMessage(t('cycle.portability.invalidFile'));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [visible, incoming, tracked, choice, restorePreferences, t]);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setMessage('');
    try {
      await action();
    } catch {
      setMessage(t('cycle.portability.failed'));
    } finally {
      setBusy(false);
    }
  };

  const exportFile = (encrypted: boolean) =>
    void run(async () => {
      const text = serializeCycleTransfer({ config, periods, dayLogs, contexts, moods });
      const content = encrypted ? await encryptCycleBackup(text, password) : text;
      await shareTextFile(
        `${timestampSlug()}-musclog-cycle${encrypted ? '-encrypted' : ''}.json`,
        content,
        'application/json'
      );
      if (encrypted) {
        await recordCycleBackupPrepared();
        setLastBackup(Date.now());
        await CycleNotificationService.scheduleMenstrualCycleNotifications();
        setPassword('');
        setRepeat('');
      }

      setMessage(t('cycle.portability.prepared'));
    });
  const pickFile = () =>
    void run(async () => {
      setIncoming(null);
      setExternalCsv(null);
      setCounts(null);
      const selected = await DocumentPicker.getDocumentAsync({
        type: ['application/json', 'text/csv', 'text/comma-separated-values', 'text/plain'],
        copyToCacheDirectory: true,
      });
      if (selected.canceled || !selected.assets[0]) {
        return;
      }

      const asset = selected.assets[0];
      if ((asset.size ?? 0) > 7_000_000) {
        throw new Error('too_large');
      }

      const plain = await decodeCycleFile(
        String(await readFileAsStringAsync(asset.uri)),
        importPassword
      );
      try {
        parseCycleTransfer(plain);
        setIncoming(plain);
      } catch (error) {
        if (plain.trimStart().startsWith('{')) {
          throw error;
        }

        detectImportColumns(plain);
        setExternalCsv(plain);
      }

      setImportPassword('');
    });
  return (
    <FullScreenModal
      closable={!busy}
      visible={visible}
      onClose={() => {
        if (!busy) {
          onClose();
        }
      }}
      title={t('cycle.portability.title')}
    >
      <AreaLockGate area="cycle">
        <View className="gap-5 p-4">
          <Text className="text-base font-semibold text-text-primary">
            {t('cycle.portability.backupTitle')}
          </Text>
          <Text className="text-sm text-text-secondary">{t('cycle.portability.recoveryHint')}</Text>
          <Text className="text-sm text-text-secondary">
            {lastBackup
              ? t('cycle.portability.lastBackup', {
                  date: new Date(lastBackup).toLocaleString(i18n.resolvedLanguage ?? i18n.language),
                })
              : t('cycle.portability.noBackup')}
          </Text>
          <TextInput
            label={t('cycle.portability.password')}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
          <TextInput
            label={t('cycle.portability.repeatPassword')}
            value={repeat}
            onChangeText={setRepeat}
            secureTextEntry
          />
          <Button
            label={t('cycle.portability.createBackup')}
            variant="accent"
            loading={busy}
            disabled={
              busy ||
              moodsLoading ||
              moodsError ||
              password.trim().length < 8 ||
              password !== repeat
            }
            onPress={() => exportFile(true)}
          />
          <Text className="text-sm text-text-secondary">
            {t('cycle.portability.plaintextHint')}
          </Text>
          <Button
            label={t('cycle.portability.exportJson')}
            variant="outline"
            disabled={busy || moodsLoading || moodsError}
            onPress={() => exportFile(false)}
          />
          <Button
            label={t('cycle.portability.exportContexts')}
            variant="outline"
            disabled={busy}
            onPress={() => void run(() => exportContextsCsv(contexts))}
          />
          <Text className="text-base font-semibold text-text-primary">
            {t('cycle.portability.importTitle')}
          </Text>
          <Text className="text-sm text-text-secondary">{t('cycle.portability.importHint')}</Text>
          <TextInput
            label={t('cycle.portability.importPassword')}
            value={importPassword}
            onChangeText={setImportPassword}
            secureTextEntry
          />
          <Button
            label={t('cycle.portability.chooseFile')}
            variant="outline"
            loading={busy}
            disabled={busy}
            onPress={pickFile}
          />
          {externalCsv ? (
            <CycleImportMapping
              text={externalCsv}
              onPrepared={(text) => {
                setIncoming(text);
                setExternalCsv(null);
              }}
              onCancel={() => setExternalCsv(null)}
            />
          ) : null}
          {incoming ? (
            <View className="gap-3">
              <Text className="text-sm text-text-secondary">
                {t('cycle.portability.conflictHint')}
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {(['keep', 'replace'] as const).map((value) => (
                  <Chip
                    key={value}
                    label={t(`cycle.portability.${value}`)}
                    disabled={busy}
                    selected={choice === value}
                    onPress={() => {
                      setCounts(null);
                      setChoice(value);
                    }}
                  />
                ))}
              </View>
              <Chip
                label={t('cycle.portability.restorePreferences')}
                role="checkbox"
                disabled={busy}
                selected={restorePreferences}
                onPress={() => {
                  setCounts(null);
                  setRestorePreferences(!restorePreferences);
                }}
              />
              {counts ? (
                <Text className="text-sm text-text-primary">
                  {t('cycle.portability.preview', counts)}
                </Text>
              ) : (
                <Text className="text-sm text-text-secondary">
                  {t('cycle.portability.checking')}
                </Text>
              )}
              <Text className="text-xs text-text-secondary">
                {t('cycle.portability.overlapHint')}
              </Text>
              <Button
                label={t('cycle.portability.confirmImport')}
                variant="accent"
                disabled={
                  busy || !counts || (counts.added + counts.updated === 0 && !restorePreferences)
                }
                loading={busy}
                onPress={() =>
                  void run(async () => {
                    const result = await CycleTransferService.import(
                      tracked,
                      incoming,
                      choice,
                      !tracked || restorePreferences
                    );
                    setIncoming(null);
                    setCounts(null);
                    await CycleNotificationService.scheduleMenstrualCycleNotifications();
                    setMessage(t('cycle.portability.imported', result));
                  })
                }
              />
            </View>
          ) : null}
          {message ? (
            <Text accessibilityLiveRegion="polite" className="text-sm text-text-primary">
              {message}
            </Text>
          ) : null}
        </View>
      </AreaLockGate>
    </FullScreenModal>
  );
}
