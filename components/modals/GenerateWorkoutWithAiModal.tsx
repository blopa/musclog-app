import { Dumbbell, Sparkles } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { AiOutputNotice } from '@/components/ai/AiOutputNotice';
import { Button } from '@/components/theme/Button';
import { TextInput } from '@/components/theme/TextInput';
import { useSnackbar } from '@/context/SnackbarContext';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { useKeepScreenAwake } from '@/hooks/useKeepScreenAwake';
import { useSettings } from '@/hooks/useSettings';
import { useTheme } from '@/hooks/useTheme';
import AiService from '@/services/AiService';
import { type ChatHistoryEntry, generateWorkoutPlan } from '@/utils/coachAI';
import { handleError } from '@/utils/handleError';
import { kgToDisplay } from '@/utils/unitConversion';
import { getWeightUnit } from '@/utils/units';
import { type PreparedWorkoutPlan, prepareWorkoutPlan, saveWorkoutPlan } from '@/utils/workoutAI';

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
  // What the model wrote, waiting for the person to read it. Nothing is stored until they save.
  const [draft, setDraft] = useState<PreparedWorkoutPlan | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const { units } = useSettings();
  const { formatInteger } = useFormatAppNumber();

  useKeepScreenAwake('generate-workout-ai', isGenerating);

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

      const prepared = await prepareWorkoutPlan(result);
      if (prepared.templates.length === 0) {
        showSnackbar('error', t('workouts.aiGeneration.errorMessage'));
        return;
      }

      setDraft(prepared);
    } catch {
      showSnackbar('error', t('workouts.aiGeneration.errorMessage'));
    } finally {
      setIsGenerating(false);
    }
  }, [preferences, showSnackbar, t]);

  const handleClose = useCallback(() => {
    setDraft(null);
    onClose();
  }, [onClose]);

  const handleSave = useCallback(async () => {
    if (!draft) {
      return;
    }

    setIsSaving(true);
    try {
      const { templateIds, planName } = await saveWorkoutPlan(draft);
      showSnackbar(
        'success',
        t('workouts.aiGeneration.successMessageWithPlan', {
          count: templateIds.length,
          planName,
        })
      );
      setPreferences('');
      handleClose();
    } catch (error) {
      handleError(error, 'GenerateWorkoutWithAiModal.save', {
        snackbarMessage: t('workouts.aiGeneration.errorMessage'),
      });
    } finally {
      setIsSaving(false);
    }
  }, [draft, handleClose, showSnackbar, t]);

  const footer = draft ? (
    <View className="gap-2">
      <Button
        label={t('workouts.aiGeneration.saveButton')}
        variant="gradientCta"
        size="md"
        width="full"
        onPress={handleSave}
        loading={isSaving}
        disabled={isSaving}
      />
      <Button
        label={t('workouts.aiGeneration.discardButton')}
        variant="outline"
        size="md"
        width="full"
        onPress={() => setDraft(null)}
        disabled={isSaving}
      />
    </View>
  ) : (
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

  const renderForm = () => (
    <>
      <View className="items-center px-4 pb-6 pt-8">
        <View
          style={{
            width: 96,
            height: 96,
            borderRadius: 48,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: theme.colors.accent.primary10,
          }}
        >
          <Sparkles size={theme.iconSize['4xl']} color={theme.colors.accent.primary} />
        </View>
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
        <AiOutputNotice kind="plan" />
      </View>
    </>
  );

  const renderDraft = (plan: PreparedWorkoutPlan) => (
    <View className="gap-4 px-4 pb-6 pt-4">
      <Text
        className="font-bold"
        style={{ color: theme.colors.text.primary, fontSize: theme.typography.fontSize.lg }}
      >
        {plan.planName}
      </Text>
      <Text style={{ color: theme.colors.text.secondary, fontSize: theme.typography.fontSize.sm }}>
        {t('workouts.aiGeneration.reviewIntro')}
      </Text>
      <AiOutputNotice kind="plan" />
      {plan.templates.map(({ template }, templateIndex) => (
        <View
          key={`${template.name}-${templateIndex}`}
          className="gap-2 rounded-card p-4"
          style={{ backgroundColor: theme.colors.background.card }}
        >
          <Text
            className="font-semibold"
            style={{ color: theme.colors.text.primary, fontSize: theme.typography.fontSize.base }}
          >
            {template.name}
          </Text>
          {template.exercises.map((exercise, exerciseIndex) => (
            <View key={`${exercise.id}-${exerciseIndex}`} className="flex-row gap-3">
              <Text
                className="min-w-0 flex-1"
                style={{
                  color: theme.colors.text.secondary,
                  fontSize: theme.typography.fontSize.sm,
                }}
              >
                {exercise.label}
              </Text>
              <Text
                className="shrink-0"
                style={{
                  color: theme.colors.text.secondary,
                  fontSize: theme.typography.fontSize.sm,
                  fontVariant: ['tabular-nums'],
                }}
              >
                {`${formatInteger(exercise.sets)} × ${formatInteger(exercise.reps)}`}
                {exercise.weight
                  ? ` · ${formatInteger(Math.round(kgToDisplay(exercise.weight, units)))} ${getWeightUnit(units)}`
                  : ''}
              </Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );

  return (
    <FullScreenModal
      visible={visible}
      onClose={handleClose}
      title={t('workouts.aiGeneration.title')}
      subtitle={t('workouts.aiGeneration.subtitle')}
      closable={!(isGenerating || isSaving)}
      footer={footer}
      scrollable
    >
      {draft ? renderDraft(draft) : null}
      {draft ? null : renderForm()}
    </FullScreenModal>
  );
}
