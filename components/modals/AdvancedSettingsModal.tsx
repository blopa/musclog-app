import {
  Activity,
  AlignHorizontalJustifyStart,
  AlignLeft,
  BrainCircuit,
  Bug,
  ChevronRight,
  Coffee,
  Droplets,
  Dumbbell,
  Pill,
} from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { SettingsCard } from '@/components/cards/SettingsCard';
import { ToggleInput } from '@/components/theme/ToggleInput';
import { useDebouncedSettings } from '@/hooks/useDebouncedSettings';
import { useTheme } from '@/hooks/useTheme';

import { FullScreenModal } from './FullScreenModal';
import { ManageSupplementsModal } from './ManageSupplementsModal';

type AdvancedSettingsModalProps = {
  visible: boolean;
  onClose: () => void;
};

export function AdvancedSettingsModal({ visible, onClose }: AdvancedSettingsModalProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  const {
    anonymousBugReport: debouncedAnonymousBugReport,
    handleAnonymousBugReportChange,
    chartTooltipPosition: debouncedChartTooltipPosition,
    handleChartTooltipPositionChange,
    showDailyMoodPrompt: debouncedShowDailyMoodPrompt,
    handleShowDailyMoodPromptChange,
    showDailyWaterPrompt: debouncedShowDailyWaterPrompt,
    handleShowDailyWaterPromptChange,
    showDailySupplementPrompt: debouncedShowDailySupplementPrompt,
    handleShowDailySupplementPromptChange,
    alwaysAllowFoodEditing: debouncedAlwaysAllowFoodEditing,
    handleAlwaysAllowFoodEditingChange,
    showWeightPrediction: debouncedShowWeightPrediction,
    handleShowWeightPredictionChange,
    intuitiveEatingMode: debouncedIntuitiveEatingMode,
    handleIntuitiveEatingModeChange,
    progressionMode: debouncedProgressionMode,
    handleProgressionModeChange,
    flushAllPendingChanges,
  } = useDebouncedSettings(500);

  useEffect(() => {
    if (!visible) {
      flushAllPendingChanges();
    }
  }, [visible, flushAllPendingChanges]);

  const bugReportItems = [
    {
      key: 'bug-report',
      label: t('settings.advancedSettings.anonymousBugReport'),
      subtitle: t('settings.advancedSettings.anonymousBugReportSubtitle'),
      icon: (
        <View
          style={{
            width: theme.size['10'],
            height: theme.size['10'],
            borderRadius: theme.borderRadius.sm,
            backgroundColor: theme.colors.status.purple20,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Bug size={theme.iconSize.xl} color={theme.colors.status.purple} />
        </View>
      ),
      value: debouncedAnonymousBugReport,
      onValueChange: handleAnonymousBugReportChange,
    },
  ];

  const dailyMoodPromptItems = [
    {
      key: 'daily-mood-prompt',
      label: t('settings.advancedSettings.dailyMoodPrompt'),
      subtitle: t('settings.advancedSettings.dailyMoodPromptSubtitle'),
      icon: (
        <View
          style={{
            width: theme.size['10'],
            height: theme.size['10'],
            borderRadius: theme.borderRadius.sm,
            backgroundColor: theme.colors.status.emerald20,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Activity size={theme.iconSize.xl} color={theme.colors.status.emerald} />
        </View>
      ),
      value: debouncedShowDailyMoodPrompt,
      onValueChange: handleShowDailyMoodPromptChange,
    },
    {
      key: 'daily-water-prompt',
      label: t('settings.advancedSettings.dailyWaterPrompt'),
      subtitle: t('settings.advancedSettings.dailyWaterPromptSubtitle'),
      icon: (
        <View
          style={{
            width: theme.size['10'],
            height: theme.size['10'],
            borderRadius: theme.borderRadius.sm,
            backgroundColor: theme.colors.status.info10,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Droplets size={theme.iconSize.xl} color={theme.colors.status.info} />
        </View>
      ),
      value: debouncedShowDailyWaterPrompt,
      onValueChange: handleShowDailyWaterPromptChange,
    },
    {
      key: 'daily-supplement-prompt',
      label: t('settings.advancedSettings.dailySupplementPrompt'),
      subtitle: t('settings.advancedSettings.dailySupplementPromptSubtitle'),
      icon: (
        <View
          style={{
            width: theme.size['10'],
            height: theme.size['10'],
            borderRadius: theme.borderRadius.sm,
            backgroundColor: theme.colors.status.emerald20,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Pill size={theme.iconSize.xl} color={theme.colors.status.emerald} />
        </View>
      ),
      value: debouncedShowDailySupplementPrompt,
      onValueChange: handleShowDailySupplementPromptChange,
    },
  ];

  const behaviorItems = [
    {
      key: 'always-allow-food-editing',
      label: t('settings.advancedSettings.alwaysAllowFoodEditing'),
      subtitle: t('settings.advancedSettings.alwaysAllowFoodEditingSubtitle'),
      icon: (
        <View
          style={{
            width: theme.size['10'],
            height: theme.size['10'],
            borderRadius: theme.borderRadius.sm,
            backgroundColor: theme.colors.status.amber20,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <AlignLeft size={theme.iconSize.xl} color={theme.colors.status.amber} />
        </View>
      ),
      value: debouncedAlwaysAllowFoodEditing,
      onValueChange: handleAlwaysAllowFoodEditingChange,
    },
    {
      key: 'show-weight-prediction',
      label: t('settings.advancedSettings.showWeightPrediction'),
      subtitle: t('settings.advancedSettings.showWeightPredictionSubtitle'),
      icon: (
        <View
          style={{
            width: theme.size['10'],
            height: theme.size['10'],
            borderRadius: theme.borderRadius.sm,
            backgroundColor: theme.colors.status.info10,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <BrainCircuit size={theme.iconSize.xl} color={theme.colors.status.info} />
        </View>
      ),
      value: debouncedShowWeightPrediction,
      onValueChange: handleShowWeightPredictionChange,
    },
    {
      key: 'intuitive-eating-mode',
      label: t('settings.advancedSettings.intuitiveEatingMode'),
      subtitle: t('settings.advancedSettings.intuitiveEatingModeSubtitle'),
      icon: (
        <View
          style={{
            width: theme.size['10'],
            height: theme.size['10'],
            borderRadius: theme.borderRadius.sm,
            backgroundColor: theme.colors.status.emerald20,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Coffee size={theme.iconSize.xl} color={theme.colors.status.emerald} />
        </View>
      ),
      value: debouncedIntuitiveEatingMode,
      onValueChange: handleIntuitiveEatingModeChange,
    },
  ];

  const chartTooltipPositionItems = [
    {
      key: 'chart-tooltip-left',
      label: t('settings.advancedSettings.chartTooltipLeft'),
      subtitle: t('settings.advancedSettings.chartTooltipLeftSubtitle'),
      icon: (
        <View
          style={{
            width: theme.size['10'],
            height: theme.size['10'],
            borderRadius: theme.borderRadius.sm,
            backgroundColor: theme.colors.accent.primary20,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <AlignHorizontalJustifyStart
            size={theme.iconSize.xl}
            color={theme.colors.accent.primary}
          />
        </View>
      ),
      value: debouncedChartTooltipPosition === 'left',
      onValueChange: (v: boolean) => handleChartTooltipPositionChange(v ? 'left' : 'right'),
    },
  ];

  const [showManageSupplementsModal, setShowManageSupplementsModal] = useState(false);

  return (
    <FullScreenModal
      visible={visible}
      onClose={onClose}
      title={t('settings.appBehaviorSettings.title')}
    >
      <View className="gap-6 px-4 py-6" style={{ minHeight: '100%' }}>
        {/* Reminders Section */}
        <View>
          <Text
            className="mb-2 px-5 text-xs font-bold tracking-wider uppercase"
            style={{ color: theme.colors.text.secondary }}
          >
            {t('settings.advancedSettings.reminders')}
          </Text>
          <ToggleInput items={dailyMoodPromptItems} />
          <SettingsCard
            icon={<Pill size={theme.iconSize.xl} color={theme.colors.accent.primary} />}
            iconContainerStyle={{
              width: theme.size['10'],
              height: theme.size['10'],
              borderRadius: theme.borderRadius.sm,
              backgroundColor: theme.colors.accent.primary20,
            }}
            title={t('settings.advancedSettings.manageSupplements')}
            subtitle={t('settings.advancedSettings.manageSupplementsSubtitle')}
            onPress={() => setShowManageSupplementsModal(true)}
            rightIcon={<ChevronRight size={theme.iconSize.lg} color={theme.colors.text.tertiary} />}
          />
        </View>

        {/* Privacy & Diagnostics Section */}
        <View>
          <Text
            className="mb-2 px-5 text-xs font-bold tracking-wider uppercase"
            style={{ color: theme.colors.text.secondary }}
          >
            {t('settings.advancedSettings.privacyDiagnostics')}
          </Text>
          <ToggleInput items={bugReportItems} />
          <View className="mt-4" />
          <ToggleInput items={behaviorItems} />
        </View>

        {/* Workouts Section */}
        <View>
          <Text
            className="mb-2 px-5 text-xs font-bold tracking-wider uppercase"
            style={{ color: theme.colors.text.secondary }}
          >
            {t('settings.advancedSettings.workouts')}
          </Text>
          <ToggleInput
            items={[
              {
                key: 'progression-mode-weight-first',
                label: t('settings.advancedSettings.progressionModeWeightFirst'),
                subtitle: t('settings.advancedSettings.progressionModeWeightFirstSubtitle'),
                icon: (
                  <View
                    style={{
                      width: theme.size['10'],
                      height: theme.size['10'],
                      borderRadius: theme.borderRadius.sm,
                      backgroundColor: theme.colors.accent.primary20,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Dumbbell size={theme.iconSize.xl} color={theme.colors.accent.primary} />
                  </View>
                ),
                value: debouncedProgressionMode === 'weight_first',
                onValueChange: (v: boolean) =>
                  handleProgressionModeChange(v ? 'weight_first' : 'reps_first'),
              },
            ]}
          />
        </View>

        {/* Charts Section */}
        <View>
          <Text
            className="mb-2 px-5 text-xs font-bold tracking-wider uppercase"
            style={{ color: theme.colors.text.secondary }}
          >
            {t('settings.advancedSettings.charts')}
          </Text>
          <ToggleInput items={chartTooltipPositionItems} />
        </View>

        <ManageSupplementsModal
          visible={showManageSupplementsModal}
          onClose={() => setShowManageSupplementsModal(false)}
        />
      </View>
    </FullScreenModal>
  );
}
