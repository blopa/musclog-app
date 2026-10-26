import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { AppointmentSummarySheet } from '@/components/cycle/AppointmentSummarySheet';
import { CycleHealthSettings } from '@/components/cycle/CycleHealthSettings';
import { CyclePreferences } from '@/components/cycle/CyclePreferences';
import { CycleReminderSettings } from '@/components/cycle/CycleReminderSettings';
import { CycleSharingSettings } from '@/components/cycle/CycleSharingSettings';
import { CycleTrackingModeSettings } from '@/components/cycle/CycleTrackingModeSettings';
import { type CycleSetupData, EditCycleSetupData } from '@/components/EditCycleSetupData';
import { AppLockSettings } from '@/components/lock/AppLockSettings';
import { AreaLockGate } from '@/components/lock/AreaLockGate';
import { CyclePortabilityModal } from '@/components/modals/CyclePortabilityModal';
import { DataSettingsModal } from '@/components/modals/DataSettingsModal';
import { Button } from '@/components/theme/Button';
import { TextButton } from '@/components/theme/TextButton';
import { ToggleInput } from '@/components/theme/ToggleInput';
import { SETTINGS } from '@/constants/settingDefinitions';
import { deleteBackup, getStoredBackups } from '@/database/preMigrationBackup';
import { SettingsService } from '@/database/services/SettingsService';
import { useMenstrualCycle } from '@/hooks/useMenstrualCycle';
import { useSettings } from '@/hooks/useSettings';
import { useSubModalState } from '@/hooks/useSubModalVisibility';
import { exportDayLogsCsv, exportPeriodsCsv } from '@/services/cycleExport';
import { isAppLockSupported } from '@/utils/appLock';
import type { CycleConfigPatch } from '@/utils/cycle/types';
import { authenticateForDangerousAction } from '@/utils/dangerousActionAuth';
import { handleError } from '@/utils/handleError';

import { ConfirmationModal } from './ConfirmationModal';
import { CycleContextModal } from './CycleContextModal';
import { FullScreenModal } from './FullScreenModal';

type CycleSettingsModalProps = {
  visible: boolean;
  onClose: () => void;
};

/** One sub-surface at a time, rendered inside this modal and inside the lock gate. */
type Sub =
  'context' | 'portability' | 'data' | 'summary' | 'fertility' | 'delete' | 'backups' | null;

/** Usual-length edits save as they are made, after this pause (and at once on close). */
const LENGTH_SAVE_DELAY_MS = 600;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="gap-3">
      <Text className="text-xs font-semibold text-text-tertiary">{title}</Text>
      {children}
    </View>
  );
}

/**
 * Everything about the cycle that is a preference rather than a log entry: reminders, usual
 * lengths, what is shown (predictions, the optional fertility estimate), who can open it, and
 * getting data out or removing it for good. Every control saves when it changes; there is no
 * Save button that only some of them obey.
 */
export function CycleSettingsModal({ visible, onClose }: CycleSettingsModalProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const { cycleShowPredictions, cycleShowFertility } = useSettings();
  const {
    cycle,
    pausedCycle,
    config,
    updateConfig,
    deactivateTracking,
    resumeTracking,
    deleteAllData,
    periods,
    history,
    dayLogs,
    moods,
    moodsLoading,
    moodsError,
  } = useMenstrualCycle();
  const [sub, setSub] = useSubModalState<Sub>(visible, null);
  const [backupCount, setBackupCount] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const tracked = cycle ?? pausedCycle;

  const guarded = async (context: string, action: () => Promise<void>) => {
    try {
      await action();
    } catch (error) {
      handleError(error, context, { snackbarMessage: t('errors.somethingWentWrong') });
    }
  };

  // Steppers fire once per tap; one write per pause, not per tap. Flushed when the modal closes,
  // so an edit followed straight away by closing is never lost.
  const pendingLengths = useRef<CycleConfigPatch | null>(null);
  const lengthTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const flushLengths = () => {
    clearTimeout(lengthTimer.current);
    const patch = pendingLengths.current;
    pendingLengths.current = null;
    if (patch && Object.keys(patch).length > 0) {
      void guarded('CycleSettingsModal.lengths', () => updateConfig(patch));
    }
  };

  const onLengthsChange = (form: Partial<CycleSetupData>) => {
    const patch: CycleConfigPatch = {
      ...(form.cycleLength !== undefined && form.cycleLength !== config.fallbackCycleLength
        ? { fallbackCycleLength: form.cycleLength }
        : {}),
      ...(form.cycleLengthKnown !== undefined && form.cycleLengthKnown !== config.cycleLengthKnown
        ? { cycleLengthKnown: form.cycleLengthKnown }
        : {}),
      ...(form.periodDuration !== undefined && form.periodDuration !== config.fallbackPeriodDuration
        ? { fallbackPeriodDuration: form.periodDuration }
        : {}),
    };
    pendingLengths.current = patch;
    clearTimeout(lengthTimer.current);
    lengthTimer.current = setTimeout(flushLengths, LENGTH_SAVE_DELAY_MS);
  };

  const close = () => {
    flushLengths();
    onClose();
  };

  useEffect(() => () => clearTimeout(lengthTimer.current), []);

  const runExport = (context: string, action: () => Promise<void>) => {
    setIsExporting(true);
    void guarded(context, action).finally(() => setIsExporting(false));
  };

  const confirmDeleteAll = async () => {
    await guarded('CycleSettingsModal.deleteAll', async () => {
      if (!(await authenticateForDangerousAction(t('cycle.settings.delete.prompt')))) {
        return;
      }

      await deleteAllData();
      const backups = await getStoredBackups();
      if (backups.length > 0) {
        setBackupCount(backups.length);
        setSub('backups');

        return;
      }

      setSub(null);
      onClose();
    });
  };

  const confirmDeleteBackups = async () => {
    await guarded('CycleSettingsModal.deleteBackups', async () => {
      const backups = await getStoredBackups();
      await Promise.all(backups.map((backup) => deleteBackup(backup.uri)));
      setSub(null);
      onClose();
    });
  };

  const confirmCopy = {
    fertility: {
      title: t('cycle.settings.fertility.explainTitle'),
      message: t('cycle.settings.fertility.explainMessage'),
      confirmLabel: t('cycle.settings.fertility.enable'),
      variant: 'primary' as const,
      onConfirm: async () => {
        await guarded('CycleSettingsModal.fertility', () =>
          SettingsService.set(SETTINGS.cycleShowFertility, true)
        );
        setSub(null);
      },
    },
    delete: {
      title: t('cycle.settings.delete.title'),
      message: t('cycle.settings.delete.message'),
      confirmLabel: t('cycle.settings.delete.confirm'),
      variant: 'destructive' as const,
      onConfirm: confirmDeleteAll,
    },
    backups: {
      title: t('cycle.settings.delete.backupsTitle'),
      message: t('cycle.settings.delete.backupsMessage', { count: backupCount }),
      confirmLabel: t('cycle.settings.delete.backupsConfirm'),
      variant: 'destructive' as const,
      onConfirm: confirmDeleteBackups,
    },
  };

  const renderSub = () => {
    switch (sub) {
      case 'context':
        return <CycleContextModal visible onClose={() => setSub(null)} />;
      case 'portability':
        return <CyclePortabilityModal visible onClose={() => setSub(null)} />;
      case 'data':
        return <DataSettingsModal visible onClose={() => setSub(null)} />;
      case 'summary':
        return <AppointmentSummarySheet visible onClose={() => setSub(null)} />;
      case 'fertility':
      case 'delete':
      case 'backups': {
        const copy = confirmCopy[sub];
        return (
          <ConfirmationModal
            visible
            onClose={() => setSub(null)}
            onConfirm={copy.onConfirm}
            title={copy.title}
            message={copy.message}
            confirmLabel={copy.confirmLabel}
            variant={copy.variant}
          />
        );
      }

      default:
        return null;
    }
  };

  const exportsDisabled = isExporting || moodsLoading || moodsError;

  return (
    <FullScreenModal
      visible={visible}
      onClose={close}
      title={t('cycle.settings.title')}
      subtitle={t('cycle.settings.subtitle')}
    >
      <AreaLockGate area="cycle">
        <View className="gap-8 px-4 py-4">
          <CycleTrackingModeSettings onClose={close} />
          {tracked ? (
            <>
              <Section title={t('cycle.settings.sectionReminders')}>
                <CycleReminderSettings />
              </Section>

              {cycle ? (
                <Section title={t('cycle.settings.sectionUsual')}>
                  {/* key forces remount on each open so the form starts from the saved values */}
                  <EditCycleSetupData
                    key={visible ? 'open' : 'closed'}
                    initialData={{
                      cycleLength: config.fallbackCycleLength,
                      cycleLengthKnown: config.cycleLengthKnown,
                      periodDuration: config.fallbackPeriodDuration,
                    }}
                    onFormChange={onLengthsChange}
                    showDatePicker={false}
                    showContext={false}
                  />
                  <Text className="text-xs text-text-tertiary">
                    {t('cycle.settings.usualHint')}
                  </Text>
                  <Button
                    label={t('cycle.settings.changeContext')}
                    variant="outline"
                    onPress={() => setSub('context')}
                  />
                </Section>
              ) : null}

              <Section title={t('cycle.settings.sectionShown')}>
                <ToggleInput
                  items={[
                    {
                      key: 'predictions',
                      label: t('cycle.settings.showPredictions'),
                      subtitle: t('cycle.settings.showPredictionsHint'),
                      value: cycleShowPredictions,
                      onValueChange: (value) =>
                        void guarded('CycleSettingsModal.predictions', () =>
                          SettingsService.set(SETTINGS.cycleShowPredictions, value)
                        ),
                    },
                    {
                      key: 'fertility',
                      label: t('cycle.settings.showFertility'),
                      subtitle: t('cycle.settings.showFertilityHint'),
                      value: cycleShowFertility,
                      onValueChange: (value) => {
                        if (value) {
                          setSub('fertility');
                        } else {
                          void guarded('CycleSettingsModal.fertility', () =>
                            SettingsService.set(SETTINGS.cycleShowFertility, false)
                          );
                        }
                      },
                    },
                  ]}
                />
              </Section>

              <Section title={t('cycle.personalize.title')}>
                <CyclePreferences />
                <CycleHealthSettings />
              </Section>
            </>
          ) : (
            <Section title={t('cycle.settings.sectionTracking')}>
              <Text className="text-sm text-text-secondary">{t('cycle.noData.description')}</Text>
              <Button
                label={t('cycle.noData.start')}
                variant="accent"
                onPress={() => {
                  close();
                  router.navigate({
                    pathname: '/app/onboarding/cycle-setup',
                    params: { nextRoute: encodeURIComponent('/app/cycle') },
                  } as never);
                }}
              />
            </Section>
          )}

          {isAppLockSupported ? (
            <Section title={t('cycle.settings.sectionPrivacy')}>
              <AppLockSettings />
              <Text className="text-xs text-text-tertiary">{t('cycle.settings.privacyNote')}</Text>
            </Section>
          ) : null}

          {tracked ? (
            <Section title={t('cycle.settings.sectionExport')}>
              <CycleSharingSettings />
              <Button
                label={t('cycle.settings.summaryTitle')}
                variant="outline"
                onPress={() => setSub('summary')}
              />
              <Button
                label={t('cycle.portability.title')}
                variant="outline"
                onPress={() => setSub('portability')}
              />
              <Button
                label={t('cycle.portability.fullBackup')}
                variant="outline"
                onPress={() => setSub('data')}
              />
              <Text className="text-xs text-text-secondary">
                {t('cycle.portability.fullBackupHint')}
              </Text>
              <Button
                label={t('cycle.settings.exportPeriods')}
                variant="outline"
                disabled={isExporting}
                onPress={() =>
                  runExport('CycleSettingsModal.exportPeriods', () =>
                    exportPeriodsCsv(periods, history)
                  )
                }
              />
              <Button
                label={t('cycle.settings.exportDays')}
                variant="outline"
                disabled={exportsDisabled}
                onPress={() =>
                  runExport('CycleSettingsModal.exportDays', () => exportDayLogsCsv(dayLogs, moods))
                }
              />
            </Section>
          ) : null}

          {tracked ? (
            <Section title={t('cycle.settings.sectionManage')}>
              {cycle ? (
                <TextButton
                  label={t('cycle.settings.pause')}
                  onPress={() =>
                    void guarded('CycleSettingsModal.pause', async () => {
                      await deactivateTracking();
                      close();
                    })
                  }
                />
              ) : (
                <TextButton
                  label={t('cycle.noData.resume')}
                  onPress={() => void guarded('CycleSettingsModal.resume', resumeTracking)}
                />
              )}
              <Text className="text-xs text-text-tertiary">{t('cycle.settings.pauseHint')}</Text>
              <TextButton
                label={t('cycle.settings.delete.action')}
                tone="danger"
                onPress={() => setSub('delete')}
              />
            </Section>
          ) : null}
        </View>

        {renderSub()}
      </AreaLockGate>
    </FullScreenModal>
  );
}
