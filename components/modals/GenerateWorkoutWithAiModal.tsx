import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { LinearGradient } from 'expo-linear-gradient';
import { Dumbbell, Sparkles } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Button } from '@/components/theme/Button';
import { TextInput } from '@/components/theme/TextInput';
import { useSnackbar } from '@/context/SnackbarContext';
import { useTheme } from '@/hooks/useTheme';
import AiService from '@/services/AiService';
import { type ChatHistoryEntry, generateWorkoutPlan } from '@/utils/coachAI';
import { processWorkoutPlanResponse } from '@/utils/workoutAI';

import { FullScreenModal } from './FullScreenModal';

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function GenerateWorkoutWithAiModal({ visible, onClose }: Props) {
  const { t } = useTranslation();
  const { showSnackbar } = useSnackbar();
  const theme = useTheme();
  const [preferences, setPreferences] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  // Keep screen awake during AI workout generation
  useEffect(() => {
    if (isGenerating) {
      activateKeepAwakeAsync('generate-workout-ai').catch(() => {});
    } else {
      deactivateKeepAwake('generate-workout-ai').catch(() => {});
    }

    return () => {
      deactivateKeepAwake('generate-workout-ai').catch(() => {});
    };
  }, [isGenerating]);

  const handleGenerate = useCallback(async () => {
    const aiConfig = await AiService.getAiConfig();
    if (!aiConfig) {
      showSnackbar('error', t('workouts.aiGeneration.aiNotConfigured'));
      return;
    }

    setIsGenerating(true);
    try {
      const history: ChatHistoryEntry[] = preferences.trim()
        ? [{ role: 'user', content: preferences.trim() }]
        : [];

      const result = await generateWorkoutPlan(aiConfig, history, 'exercise');
      if (!result) {
        showSnackbar('error', t('workouts.aiGeneration.errorMessage'));
        return;
      }

      const { templateIds } = await processWorkoutPlanResponse(result);
      showSnackbar(
        'success',
        t('workouts.aiGeneration.successMessage', { count: templateIds.length })
      );
      setPreferences('');
      onClose();
    } catch {
      showSnackbar('error', t('workouts.aiGeneration.errorMessage'));
    } finally {
      setIsGenerating(false);
    }
  }, [preferences, onClose, showSnackbar, t]);

  const footer = (
    <Button
      label={t('workouts.aiGeneration.generateButton')}
      variant="gradientCta"
      size="md"
      width="full"
      icon={Dumbbell}
      onPress={handleGenerate}
      loading={isGenerating}
      disabled={isGenerating}
    />
  );

  return (
    <FullScreenModal
      visible={visible}
      onClose={onClose}
      title={t('workouts.aiGeneration.title')}
      subtitle={t('workouts.aiGeneration.subtitle')}
      closable={!isGenerating}
      withGradient
      footer={footer}
      scrollable
    >
      <View className="items-center px-4 pt-8 pb-6">
        <LinearGradient
          colors={theme.colors.gradients.progress}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{
            width: 96,
            height: 96,
            borderRadius: 48,
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          <View
            style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(255,255,255,0.1)',
            }}
          >
            <Sparkles size={theme.iconSize['4xl']} color={theme.colors.text.primary} />
          </View>
        </LinearGradient>
      </View>
      <View className="px-4 pb-6">
        <TextInput
          label={t('workouts.aiGeneration.preferencesLabel')}
          value={preferences}
          onChangeText={setPreferences}
          placeholder={t('workouts.aiGeneration.preferencesPlaceholder')}
          multiline
          numberOfLines={8}
        />
      </View>
    </FullScreenModal>
  );
}
