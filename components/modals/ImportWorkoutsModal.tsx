import { useCallback, useState } from 'react';
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

import { ExerciseService, GoogleAuthService } from '../../database/services';
import { SettingsService } from '../../database/services/SettingsService';
import { useTheme } from '../../hooks/useTheme';
import { type CoachAIConfig, parsePastWorkouts } from '../../utils/coachAI';
import { getAccessToken } from '../../utils/googleAuth';
import { showSnackbar } from '../../utils/snackbarService';
import { processParsedWorkouts } from '../../utils/workoutAI';
import { FullScreenModal } from './FullScreenModal';

type ImportWorkoutsModalProps = {
  visible: boolean;
  onClose: () => void;
  /** Called with parsed entries and the created workout log IDs (for navigation or refresh). */
  onWorkoutsImported?: (entries: any[], workoutLogIds: string[]) => void;
};

// TODO: improve UI, remove mocked data and implement usage of this component
export function ImportWorkoutsModal({
  visible,
  onClose,
  onWorkoutsImported,
}: ImportWorkoutsModalProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [rawText, setRawText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleProcessText = useCallback(async () => {
    if (!rawText.trim()) {
      showSnackbar('error', t('workout.import.emptyData'));
      return;
    }

    setIsProcessing(true);
    try {
      const resolveAIConfig = async (): Promise<CoachAIConfig | null> => {
        try {
          const oauthGeminiEnabled = await GoogleAuthService.getOAuthGeminiEnabled();
          if (oauthGeminiEnabled) {
            const accessToken = await getAccessToken();
            if (accessToken) {
              return {
                provider: 'gemini',
                accessToken,
                model: (await SettingsService.getGoogleGeminiModel()) || 'gemini-2.5-flash',
              };
            }
          }
          const enableGemini = await SettingsService.getEnableGoogleGemini();
          const geminiKey = await SettingsService.getGoogleGeminiApiKey();
          if (enableGemini && geminiKey) {
            return {
              provider: 'gemini',
              apiKey: geminiKey,
              model: (await SettingsService.getGoogleGeminiModel()) || 'gemini-2.5-flash',
            };
          }
          const enableOpenAi = await SettingsService.getEnableOpenAi();
          const openAiKey = await SettingsService.getOpenAiApiKey();
          if (enableOpenAi && openAiKey) {
            return {
              provider: 'openai',
              apiKey: openAiKey,
              model: (await SettingsService.getOpenAiModel()) || 'gpt-4o',
            };
          }
          return null;
        } catch {
          return null;
        }
      };

      const aiConfig = await resolveAIConfig();
      if (!aiConfig) {
        showSnackbar('error', t('ai.settings.notConfigured'));
        setIsProcessing(false);
        return;
      }

      const exercises = await ExerciseService.getAllExercises();
      const exerciseNames = exercises.map((e) => e.name ?? '').filter(Boolean);
      const parsed = await parsePastWorkouts(aiConfig, rawText.trim(), exerciseNames);

      if (!parsed || parsed.length === 0) {
        showSnackbar('error', t('workout.import.processingFailed'));
        setIsProcessing(false);
        return;
      }

      const { workoutLogIds, count } = await processParsedWorkouts(parsed);
      showSnackbar('success', t('workout.import.processingData'));
      onWorkoutsImported?.(parsed, workoutLogIds);
      if (count > 0) {
        onClose();
      }
    } catch (error) {
      console.error('[ImportWorkouts] Error:', error);
      showSnackbar('error', t('workout.import.processingFailed'));
    } finally {
      setIsProcessing(false);
    }
  }, [rawText, t, onWorkoutsImported, onClose]);

  const handleClose = useCallback(() => {
    setRawText('');
    onClose();
  }, [onClose]);

  return (
    <FullScreenModal
      visible={visible}
      onClose={handleClose}
      title={t('workout.import.importWorkouts')}
      scrollable={false}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
        style={{ paddingBottom: insets.bottom }}
      >
        <ScrollView className="flex-1" contentContainerStyle={{ flexGrow: 1 }}>
          <View className="flex-1 px-4 py-6">
            {/* Instructions */}
            <Text className="mb-4 text-sm text-text-secondary">
              {t('workout.import.instructions')}
            </Text>

            {/* Text Input */}
            <TextInput
              value={rawText}
              onChangeText={setRawText}
              placeholder={t('workout.import.pasteWorkoutDataPlaceholder')}
              placeholderTextColor={theme.colors.text.tertiary}
              multiline
              numberOfLines={8}
              className="mb-4 rounded-lg p-4 text-base text-text-primary"
              style={{
                backgroundColor: theme.colors.background.card,
                borderWidth: theme.borderWidth.thin,
                borderColor: theme.colors.border.light,
                textAlignVertical: 'top',
              }}
              editable={!isProcessing}
            />

            {/* Format Info */}
            <View className="mb-6 rounded-lg bg-amber-500/10 p-4">
              <Text className="mb-2 text-xs font-semibold text-amber-600">
                {t('workout.import.supportedFormats')}
              </Text>
              <Text className="text-xs text-text-secondary">{t('workout.import.formatInfo')}</Text>
            </View>

            {/* Character Count */}
            <Text className="mb-4 text-xs text-text-tertiary">
              {t('workout.import.characters')}: {rawText.length}
            </Text>
          </View>
        </ScrollView>

        {/* Action Buttons */}
        <View className="border-t px-4 py-4" style={{ borderColor: theme.colors.border.light }}>
          <Pressable
            onPress={handleProcessText}
            disabled={!rawText.trim() || isProcessing}
            className="mb-2 rounded-lg px-4 py-3"
            style={{
              backgroundColor: theme.colors.accent.primary,
              opacity: !rawText.trim() || isProcessing ? 0.5 : 1,
            }}
          >
            {isProcessing ? (
              <View className="flex-row items-center justify-center gap-2">
                <ActivityIndicator color={theme.colors.text.black} size="small" />
                <Text className="font-semibold" style={{ color: theme.colors.text.black }}>
                  {t('workout.import.processing')}
                </Text>
              </View>
            ) : (
              <Text
                className="text-center font-semibold"
                style={{ color: theme.colors.text.black }}
              >
                {t('workout.import.import')}
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
