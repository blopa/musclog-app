import {
  Activity,
  AlignHorizontalJustifyEnd,
  AlignHorizontalJustifyStart,
  Apple,
  Bug,
  CalendarCheck,
  ChevronRight,
  Coffee,
  Database,
  Download,
  Dumbbell,
  Flag,
  MessageSquare,
  Target,
  TrendingUp,
  Upload,
  Utensils,
} from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Platform, Text, View } from 'react-native';

import { useDebouncedSettings } from '../../hooks/useDebouncedSettings';
import { useTheme } from '../../hooks/useTheme';
import { exportDatabase, importDatabase } from '../../utils/file';
import { LegalLinksCard } from '../cards/LegalLinksCard';
import { SettingsCard } from '../cards/SettingsCard';
import { useSnackbar } from '../SnackbarContext';
import { Button } from '../theme/Button';
import { TextInput } from '../theme/TextInput';
import { ToggleInput } from '../theme/ToggleInput';
import { CenteredModal } from './CenteredModal';
import {
  ChatMessageDataModal,
  ExerciseDataModal,
  FoodDataModal,
  FoodPortionDataModal,
  MealDataModal,
  NutritionCheckinDataModal,
  NutritionGoalDataModal,
  NutritionLogModal,
  UserMetricDataModal,
  WorkoutLogDataModal,
  WorkoutTemplateDataModal,
} from './DataLogModal';
import { FullScreenModal } from './FullScreenModal';

type AdvancedSettingsModalProps = {
  visible: boolean;
  onClose: () => void;
  // Data Portability
  onExportPress?: () => void;
  onImportPress?: () => void;
  // Danger Zone
  onAccountDeletionPress?: () => void;
};

export function AdvancedSettingsModal({
  visible,
  onClose,
  onExportPress,
  onImportPress,
  onAccountDeletionPress,
}: AdvancedSettingsModalProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { showSnackbar } = useSnackbar();

  // Use debounced settings for instant UI updates
  const {
    anonymousBugReport: debouncedAnonymousBugReport,
    handleAnonymousBugReportChange,
    chartTooltipPosition: debouncedChartTooltipPosition,
    handleChartTooltipPositionChange,
    flushAllPendingChanges,
  } = useDebouncedSettings(500);

  // Flush pending settings changes when modal closes
  useEffect(() => {
    if (!visible) {
      flushAllPendingChanges();
    }
  }, [visible, flushAllPendingChanges]);

  // Export / Import modals and state
  const [exportModalVisible, setExportModalVisible] = useState(false);
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [encryptionPhrase, setEncryptionPhrase] = useState('');
  const [decryptionPhrase, setDecryptionPhrase] = useState('');
  const [loading, setLoading] = useState(false);

  const handleExportConfirm = useCallback(async () => {
    setLoading(true);
    try {
      await exportDatabase(encryptionPhrase || undefined);
      setExportModalVisible(false);
      setEncryptionPhrase('');
    } catch (err) {
      console.error('Export failed:', err);
      showSnackbar('error', t('settings.advancedSettings.exportFailedMessage'));
    } finally {
      setLoading(false);
    }
  }, [encryptionPhrase, t, showSnackbar]);

  const handleImportConfirm = useCallback(async () => {
    setLoading(true);
    try {
      await importDatabase(decryptionPhrase || undefined);
      setImportModalVisible(false);
      setDecryptionPhrase('');
    } catch (err) {
      console.error('Import failed:', err);
      showSnackbar('error', t('settings.advancedSettings.importFailedMessage'));
    } finally {
      setLoading(false);
    }
  }, [decryptionPhrase, t, showSnackbar]);

  const handleOpenAppSettings = useCallback(async () => {
    if (Platform.OS === 'android') {
      try {
        await Linking.openSettings();
      } catch (err) {
        console.error('Failed to open settings:', err);
        showSnackbar('error', t('settings.advancedSettings.openSettingsFailedMessage'));
      }
    } else {
      // TODO: Implement clear app data functionality for iOS
      console.log('Clear app data settings - only available on Android');
    }
  }, [t, showSnackbar]);

  // Data log modal visibility – each row opens its corresponding modal
  const [showFoodDataModal, setShowFoodDataModal] = useState(false);
  const [showNutritionLogsModal, setShowNutritionLogsModal] = useState(false);
  const [showMealsModal, setShowMealsModal] = useState(false);
  const [showPortionsModal, setShowPortionsModal] = useState(false);
  const [showWorkoutsModal, setShowWorkoutsModal] = useState(false);
  const [showWorkoutLogsModal, setShowWorkoutLogsModal] = useState(false);
  const [showMetricsModal, setShowMetricsModal] = useState(false);
  const [showExercisesModal, setShowExercisesModal] = useState(false);
  const [showNutritionGoalsModal, setShowNutritionGoalsModal] = useState(false);
  const [showNutritionCheckinsModal, setShowNutritionCheckinsModal] = useState(false);
  const [showChatMessagesModal, setShowChatMessagesModal] = useState(false);
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

  return (
    <>
      <FullScreenModal
        visible={visible}
        onClose={onClose}
        title={t('settings.advancedSettings.title')}
      >
        <View className="gap-6 px-4 py-6" style={{ minHeight: '100%' }}>
          {/* Data Portability Section */}
          <View>
            <Text
              className="mb-2 px-5 text-xs font-bold uppercase tracking-wider"
              style={{ color: theme.colors.text.secondary }}
            >
              {t('settings.advancedSettings.dataPortability')}
            </Text>
            <SettingsCard
              icon={<Upload size={theme.iconSize.xl} color={theme.colors.accent.primary} />}
              iconContainerStyle={{
                width: theme.size['16'],
                height: theme.size['16'],
                borderRadius: theme.borderRadius.sm,
                backgroundColor: theme.colors.accent.primary20,
              }}
              title={t('settings.advancedSettings.exportFitnessData')}
              subtitle={t('settings.advancedSettings.exportFitnessDataSubtitle')}
              onPress={() => setExportModalVisible(true)}
              rightIcon={
                <ChevronRight size={theme.iconSize.lg} color={theme.colors.text.tertiary} />
              }
            />
            <SettingsCard
              icon={<Download size={theme.iconSize.xl} color={theme.colors.accent.primary} />}
              iconContainerStyle={{
                width: theme.size['16'],
                height: theme.size['16'],
                borderRadius: theme.borderRadius.sm,
                backgroundColor: theme.colors.accent.primary20,
              }}
              title={t('settings.advancedSettings.importFitnessData')}
              subtitle={t('settings.advancedSettings.importFitnessDataSubtitle')}
              onPress={() => setImportModalVisible(true)}
              rightIcon={
                <ChevronRight size={theme.iconSize.lg} color={theme.colors.text.tertiary} />
              }
            />
          </View>

          {/* Privacy & Diagnostics Section */}
          <View>
            <Text
              className="mb-2 px-5 text-xs font-bold uppercase tracking-wider"
              style={{ color: theme.colors.text.secondary }}
            >
              {t('settings.advancedSettings.privacyDiagnostics')}
            </Text>
            <ToggleInput items={bugReportItems} />
          </View>

          {/* Charts Section */}
          <View>
            <Text
              className="mb-2 px-5 text-xs font-bold uppercase tracking-wider"
              style={{ color: theme.colors.text.secondary }}
            >
              {t('settings.advancedSettings.charts')}
            </Text>
            <ToggleInput items={chartTooltipPositionItems} />
          </View>

          {/* Data Management Section */}
          <View>
            <Text
              className="mb-2 px-5 text-xs font-bold uppercase tracking-wider"
              style={{ color: theme.colors.text.secondary }}
            >
              {t('settings.advancedSettings.dataManagement')}
            </Text>
            <SettingsCard
              icon={<Utensils size={theme.iconSize.xl} color={theme.colors.accent.primary} />}
              iconContainerStyle={{
                width: theme.size['16'],
                height: theme.size['16'],
                borderRadius: theme.borderRadius.sm,
                backgroundColor: theme.colors.accent.primary20,
              }}
              title={t('settings.advancedSettings.manageFoodData')}
              subtitle={t('settings.advancedSettings.manageFoodDataSubtitle')}
              onPress={() => setShowFoodDataModal(true)}
              rightIcon={
                <ChevronRight size={theme.iconSize.lg} color={theme.colors.text.tertiary} />
              }
            />
            <SettingsCard
              icon={<Apple size={theme.iconSize.xl} color={theme.colors.accent.primary} />}
              iconContainerStyle={{
                width: theme.size['16'],
                height: theme.size['16'],
                borderRadius: theme.borderRadius.sm,
                backgroundColor: theme.colors.accent.primary20,
              }}
              title={t('settings.advancedSettings.manageNutritionLogsData')}
              subtitle={t('settings.advancedSettings.manageNutritionLogsDataSubtitle')}
              onPress={() => setShowNutritionLogsModal(true)}
              rightIcon={
                <ChevronRight size={theme.iconSize.lg} color={theme.colors.text.tertiary} />
              }
            />
            <SettingsCard
              icon={<Coffee size={theme.iconSize.xl} color={theme.colors.accent.primary} />}
              iconContainerStyle={{
                width: theme.size['16'],
                height: theme.size['16'],
                borderRadius: theme.borderRadius.sm,
                backgroundColor: theme.colors.accent.primary20,
              }}
              title={t('settings.advancedSettings.manageMealsData')}
              subtitle={t('settings.advancedSettings.manageMealsDataSubtitle')}
              onPress={() => setShowMealsModal(true)}
              rightIcon={
                <ChevronRight size={theme.iconSize.lg} color={theme.colors.text.tertiary} />
              }
            />
            <SettingsCard
              icon={<Database size={theme.iconSize.xl} color={theme.colors.accent.primary} />}
              iconContainerStyle={{
                width: theme.size['16'],
                height: theme.size['16'],
                borderRadius: theme.borderRadius.sm,
                backgroundColor: theme.colors.accent.primary20,
              }}
              title={t('settings.advancedSettings.managePortionsData')}
              subtitle={t('settings.advancedSettings.managePortionsDataSubtitle')}
              onPress={() => setShowPortionsModal(true)}
              rightIcon={
                <ChevronRight size={theme.iconSize.lg} color={theme.colors.text.tertiary} />
              }
            />
            <SettingsCard
              icon={<Dumbbell size={theme.iconSize.xl} color={theme.colors.accent.primary} />}
              iconContainerStyle={{
                width: theme.size['16'],
                height: theme.size['16'],
                borderRadius: theme.borderRadius.sm,
                backgroundColor: theme.colors.accent.primary20,
              }}
              title={t('settings.advancedSettings.manageWorkoutsData')}
              subtitle={t('settings.advancedSettings.manageWorkoutsDataSubtitle')}
              onPress={() => setShowWorkoutsModal(true)}
              rightIcon={
                <ChevronRight size={theme.iconSize.lg} color={theme.colors.text.tertiary} />
              }
            />
            <SettingsCard
              icon={<Target size={theme.iconSize.xl} color={theme.colors.accent.primary} />}
              iconContainerStyle={{
                width: theme.size['16'],
                height: theme.size['16'],
                borderRadius: theme.borderRadius.sm,
                backgroundColor: theme.colors.accent.primary20,
              }}
              title={t('settings.advancedSettings.manageWorkoutsLogData')}
              subtitle={t('settings.advancedSettings.manageWorkoutsLogDataSubtitle')}
              onPress={() => setShowWorkoutLogsModal(true)}
              rightIcon={
                <ChevronRight size={theme.iconSize.lg} color={theme.colors.text.tertiary} />
              }
            />
            <SettingsCard
              icon={<TrendingUp size={theme.iconSize.xl} color={theme.colors.accent.primary} />}
              iconContainerStyle={{
                width: theme.size['16'],
                height: theme.size['16'],
                borderRadius: theme.borderRadius.sm,
                backgroundColor: theme.colors.accent.primary20,
              }}
              title={t('settings.advancedSettings.manageMetricsData')}
              subtitle={t('settings.advancedSettings.manageMetricsDataSubtitle')}
              onPress={() => setShowMetricsModal(true)}
              rightIcon={
                <ChevronRight size={theme.iconSize.lg} color={theme.colors.text.tertiary} />
              }
            />
            <SettingsCard
              icon={<Activity size={theme.iconSize.xl} color={theme.colors.accent.primary} />}
              iconContainerStyle={{
                width: theme.size['16'],
                height: theme.size['16'],
                borderRadius: theme.borderRadius.sm,
                backgroundColor: theme.colors.accent.primary20,
              }}
              title={t('settings.advancedSettings.manageExercisesData')}
              subtitle={t('settings.advancedSettings.manageExercisesDataSubtitle')}
              onPress={() => setShowExercisesModal(true)}
              rightIcon={
                <ChevronRight size={theme.iconSize.lg} color={theme.colors.text.tertiary} />
              }
            />
            <SettingsCard
              icon={<Flag size={theme.iconSize.xl} color={theme.colors.accent.primary} />}
              iconContainerStyle={{
                width: theme.size['16'],
                height: theme.size['16'],
                borderRadius: theme.borderRadius.sm,
                backgroundColor: theme.colors.accent.primary20,
              }}
              title={t('settings.advancedSettings.manageGoalsData')}
              subtitle={t('settings.advancedSettings.manageGoalsDataSubtitle')}
              onPress={() => setShowNutritionGoalsModal(true)}
              rightIcon={
                <ChevronRight size={theme.iconSize.lg} color={theme.colors.text.tertiary} />
              }
            />
            <SettingsCard
              icon={<CalendarCheck size={theme.iconSize.xl} color={theme.colors.accent.primary} />}
              iconContainerStyle={{
                width: theme.size['16'],
                height: theme.size['16'],
                borderRadius: theme.borderRadius.sm,
                backgroundColor: theme.colors.accent.primary20,
              }}
              title={t('settings.advancedSettings.manageCheckinsData')}
              subtitle={t('settings.advancedSettings.manageCheckinsDataSubtitle')}
              onPress={() => setShowNutritionCheckinsModal(true)}
              rightIcon={
                <ChevronRight size={theme.iconSize.lg} color={theme.colors.text.tertiary} />
              }
            />
            <SettingsCard
              icon={<MessageSquare size={theme.iconSize.xl} color={theme.colors.accent.primary} />}
              iconContainerStyle={{
                width: theme.size['16'],
                height: theme.size['16'],
                borderRadius: theme.borderRadius.sm,
                backgroundColor: theme.colors.accent.primary20,
              }}
              title={t('settings.chatMessages.title', 'Chat Messages')}
              subtitle={t(
                'settings.chatMessages.subtitle',
                'View and edit your conversation history'
              )}
              onPress={() => setShowChatMessagesModal(true)}
              rightIcon={
                <ChevronRight size={theme.iconSize.lg} color={theme.colors.text.tertiary} />
              }
            />
          </View>

          <Text
            className="mb-2 px-5 text-xs font-bold uppercase tracking-wider"
            style={{ color: theme.colors.status.error }}
          >
            {t('settings.advancedSettings.dangerZone')}
          </Text>
          {/* Clear App Data - Android only */}
          <SettingsCard
            icon={<Database size={theme.iconSize.xl} color={theme.colors.status.error} />}
            iconContainerStyle={{
              width: theme.size['16'],
              height: theme.size['16'],
              borderRadius: theme.borderRadius.sm,
              backgroundColor: theme.colors.status.error20,
            }}
            title={t('settings.advancedSettings.clearAppData')}
            subtitle={t('settings.advancedSettings.clearAppDataSubtitle')}
            titleColor={theme.colors.status.error}
            onPress={handleOpenAppSettings}
            rightIcon={<ChevronRight size={theme.iconSize.lg} color={theme.colors.status.error} />}
          />
          <LegalLinksCard />
        </View>
      </FullScreenModal>

      {/* Export confirmation modal */}
      <CenteredModal
        visible={exportModalVisible}
        onClose={() => {
          if (!loading) {
            setExportModalVisible(false);
            setEncryptionPhrase('');
          }
        }}
        title={t('settings.advancedSettings.confirmExport')}
        subtitle={t('settings.advancedSettings.exportConfirmationSubtitle')}
        footer={
          <View className="flex-row" style={{ gap: theme.spacing.gap.md }}>
            <Button
              label={t('common.cancel')}
              variant="outline"
              size="sm"
              width="flex-1"
              onPress={() => {
                setExportModalVisible(false);
                setEncryptionPhrase('');
              }}
              disabled={loading}
            />
            <Button
              label={t('common.confirm')}
              variant="accent"
              size="sm"
              width="flex-1"
              onPress={handleExportConfirm}
              disabled={loading}
              loading={loading}
            />
          </View>
        }
      >
        <View className="gap-4">
          <TextInput
            label={t('settings.advancedSettings.enterEncryptionPhrase')}
            value={encryptionPhrase}
            onChangeText={setEncryptionPhrase}
            placeholder={t('settings.advancedSettings.encryptionPhrasePlaceholder')}
            secureTextEntry
          />
        </View>
      </CenteredModal>

      {/* Import confirmation modal */}
      <CenteredModal
        visible={importModalVisible}
        onClose={() => {
          if (!loading) {
            setImportModalVisible(false);
            setDecryptionPhrase('');
          }
        }}
        title={t('settings.advancedSettings.confirmImport')}
        subtitle={t('settings.advancedSettings.importConfirmationSubtitle')}
        footer={
          <View className="flex-row" style={{ gap: theme.spacing.gap.md }}>
            <Button
              label={t('common.cancel')}
              variant="outline"
              size="sm"
              width="flex-1"
              onPress={() => {
                setImportModalVisible(false);
                setDecryptionPhrase('');
              }}
              disabled={loading}
            />
            <Button
              label={t('common.confirm')}
              variant="accent"
              size="sm"
              width="flex-1"
              onPress={handleImportConfirm}
              disabled={loading}
              loading={loading}
            />
          </View>
        }
      >
        <View className="gap-4">
          <TextInput
            label={t('settings.advancedSettings.enterDecryptionPhrase')}
            value={decryptionPhrase}
            onChangeText={setDecryptionPhrase}
            placeholder={t('settings.advancedSettings.decryptionPhrasePlaceholder')}
            secureTextEntry
          />
        </View>
      </CenteredModal>

      {/* Data log modals – opened from the Data Management rows */}
      <FoodDataModal visible={showFoodDataModal} onClose={() => setShowFoodDataModal(false)} />
      <NutritionLogModal
        visible={showNutritionLogsModal}
        onClose={() => setShowNutritionLogsModal(false)}
      />
      <MealDataModal visible={showMealsModal} onClose={() => setShowMealsModal(false)} />
      <FoodPortionDataModal
        visible={showPortionsModal}
        onClose={() => setShowPortionsModal(false)}
      />
      <WorkoutTemplateDataModal
        visible={showWorkoutsModal}
        onClose={() => setShowWorkoutsModal(false)}
      />
      <WorkoutLogDataModal
        visible={showWorkoutLogsModal}
        onClose={() => setShowWorkoutLogsModal(false)}
      />
      <UserMetricDataModal visible={showMetricsModal} onClose={() => setShowMetricsModal(false)} />
      <ExerciseDataModal
        visible={showExercisesModal}
        onClose={() => setShowExercisesModal(false)}
      />
      <NutritionGoalDataModal
        visible={showNutritionGoalsModal}
        onClose={() => setShowNutritionGoalsModal(false)}
      />
      <NutritionCheckinDataModal
        visible={showNutritionCheckinsModal}
        onClose={() => setShowNutritionCheckinsModal(false)}
      />
      <ChatMessageDataModal
        visible={showChatMessagesModal}
        onClose={() => setShowChatMessagesModal(false)}
      />
    </>
  );
}
