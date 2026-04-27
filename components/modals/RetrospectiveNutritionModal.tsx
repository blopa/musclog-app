import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/hooks/useTheme';
import AiService from '@/services/AiService';
import { formatLocalCalendarDayIso } from '@/utils/calendarDate';
import { parseRetrospectiveNutrition } from '@/utils/coachAI';
import { handleError } from '@/utils/handleError';
import { showSnackbar } from '@/utils/snackbarService';

import { FullScreenModal } from './FullScreenModal';

type RetrospectiveNutritionModalProps = {
  visible: boolean;
  onClose: () => void;
  targetDate?: Date;
  onNutritionEntered?: (entries: any[]) => void;
};

// TODO: improve UI, remove mocked data and implement usage of this component
export function RetrospectiveNutritionModal({
  visible,
  onClose,
  targetDate = new Date(),
  onNutritionEntered,
}: RetrospectiveNutritionModalProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [description, setDescription] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Keep screen awake during AI retrospective nutrition processing
  useEffect(() => {
    if (isProcessing) {
      activateKeepAwakeAsync('retrospective-nutrition').catch(() => {});
    } else {
      deactivateKeepAwake('retrospective-nutrition').catch(() => {});
    }

    return () => {
      deactivateKeepAwake('retrospective-nutrition').catch(() => {});
    };
  }, [isProcessing]);

  const handleProcessDescription = useCallback(async () => {
    if (!description.trim()) {
      showSnackbar('error', t('nutrition.emptyDescription'));
      return;
    }

    setIsProcessing(true);
    try {
      const aiConfig = await AiService.getAiConfig();
      if (!aiConfig) {
        showSnackbar('error', t('ai.settings.notConfigured'));
        setIsProcessing(false);
        return;
      }

      const targetDateStr = formatLocalCalendarDayIso(targetDate);
      const parsed = await parseRetrospectiveNutrition(aiConfig, description.trim(), targetDateStr);
      if (!parsed || parsed.length === 0) {
        showSnackbar('error', t('nutrition.processingFailed'));
        setIsProcessing(false);
        return;
      }

      showSnackbar('success', t('nutrition.processingDescription'));
      onNutritionEntered?.(parsed);
      onClose();
    } catch (error) {
      handleError(error, 'RetrospectiveNutritionModal.handleProcess', {
        snackbarMessage: t('nutrition.processingFailed'),
      });
    } finally {
      setIsProcessing(false);
    }
  }, [description, targetDate, t, onNutritionEntered, onClose]);

  const handleClose = useCallback(() => {
    setDescription('');
    onClose();
  }, [onClose]);

  const dateString = targetDate.toLocaleDateString();

  return (
    <FullScreenModal
      visible={visible}
      onClose={handleClose}
      title={t('nutrition.logPastDay')}
      scrollable={false}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
        style={{ paddingBottom: insets.bottom }}
      >
        <ScrollView className="flex-1" contentContainerStyle={{ flexGrow: 1 }}>
          <View className="flex-1 px-4 py-6">
            {/* Date Display */}
            <View
              className="mb-6 rounded-lg p-4"
              style={{ backgroundColor: theme.colors.background.card }}
            >
              <Text className="text-xs font-medium text-text-secondary">
                {t('nutrition.dateLabel')}
              </Text>
              <Text className="mt-1 text-lg font-bold text-text-primary">{dateString}</Text>
            </View>

            {/* Instructions */}
            <Text className="mb-4 text-sm text-text-secondary">
              {t('nutrition.retrospectiveInstructions')}
            </Text>

            {/* Description Input */}
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder={t('nutrition.mealDescriptionPlaceholder')}
              placeholderTextColor={theme.colors.text.tertiary}
              multiline
              numberOfLines={6}
              className="mb-4 rounded-lg p-4 text-base text-text-primary"
              style={{
                backgroundColor: theme.colors.background.card,
                borderWidth: theme.borderWidth.thin,
                borderColor: theme.colors.border.light,
                textAlignVertical: 'top',
              }}
              editable={!isProcessing}
            />

            {/* Example */}
            <View className="mb-6 rounded-lg bg-blue-500/10 p-4">
              <Text className="mb-2 text-xs font-semibold text-blue-500">
                {t('nutrition.example')}
              </Text>
              <Text className="text-xs text-text-secondary">
                {t('nutrition.retrospectiveExample')}
              </Text>
            </View>
          </View>
        </ScrollView>

        {/* Action Buttons */}
        <View className="border-t px-4 py-4" style={{ borderColor: theme.colors.border.light }}>
          <Pressable
            onPress={handleProcessDescription}
            disabled={!description.trim() || isProcessing}
            className="mb-2 rounded-lg px-4 py-3"
            style={{
              backgroundColor: theme.colors.accent.primary,
              opacity: !description.trim() || isProcessing ? 0.5 : 1,
            }}
          >
            {isProcessing ? (
              <View className="flex-row items-center justify-center gap-2">
                <ActivityIndicator color={theme.colors.text.black} size="small" />
                <Text className="font-semibold" style={{ color: theme.colors.text.black }}>
                  {t('nutrition.processing')}
                </Text>
              </View>
            ) : (
              <Text
                className="text-center font-semibold"
                style={{ color: theme.colors.text.black }}
              >
                {t('nutrition.analyze')}
              </Text>
            )}
          </Pressable>

          <Pressable
            onPress={handleClose}
            disabled={isProcessing}
            className="rounded-lg border px-4 py-3"
            style={{
              borderColor: theme.colors.border.light,
              opacity: isProcessing ? 0.5 : 1,
            }}
          >
            <Text className="text-center font-semibold text-text-primary">
              {t('common.cancel')}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </FullScreenModal>
  );
}
