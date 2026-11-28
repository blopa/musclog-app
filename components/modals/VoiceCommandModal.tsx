import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Text, View } from 'react-native';

import type { MealEstimateReview } from '@/components/camera/mealEstimateReview';
import { CenteredModal } from '@/components/modals/CenteredModal';
import { type LogCardioInitial, LogCardioModal } from '@/components/modals/LogCardioModal';
import { type LogMealData, LogMealModal } from '@/components/modals/LogMealModal';
import { type VoiceWeighIn, VoiceWeightSheet } from '@/components/modals/VoiceWeightSheet';
import { Button } from '@/components/theme/Button';
import { ListRow } from '@/components/theme/ListRow';
import type { MealType } from '@/database/models/NutritionLog';
import { useTheme } from '@/hooks/useTheme';
import type { MealEstimateProgressLine } from '@/utils/mealEstimateProgress';
import { VOICE_TOOLS } from '@/utils/voiceCommand/tools';
import type { VoiceActionTool } from '@/utils/voiceCommand/types';
import type { WorkoutChoice } from '@/utils/voiceCommand/workoutMatch';

export type VoiceCommandModalState =
  /** The model is working out what the sentence asks for. */
  | { kind: 'working'; transcript: string }
  /** No tool could be run from what was said: the person says which one they meant. */
  | { kind: 'pick'; transcript: string; offered: VoiceActionTool[] }
  /** A weigh-in waits to be confirmed. */
  | { kind: 'weight'; transcript: string; weighIn: VoiceWeighIn }
  /** The spoken meal is being estimated. */
  | { kind: 'estimating'; transcript: string }
  /** The estimated meal waits to be reviewed and logged. */
  | {
      kind: 'mealReview';
      transcript: string;
      review: MealEstimateReview;
      day: Date;
      mealType: MealType;
    }
  /** Which workout was meant cannot be told: the person picks one to preview. */
  | { kind: 'workoutChoice'; transcript: string; workouts: WorkoutChoice[] }
  /** A walk or run waits to be checked and saved. */
  | { kind: 'cardio'; transcript: string; initial: LogCardioInitial };

const TITLE_KEYS: Record<VoiceCommandModalState['kind'], string> = {
  working: 'voiceInput.command.workingTitle',
  pick: 'voiceInput.command.pickTitle',
  weight: 'voiceInput.command.weight.title',
  estimating: 'voiceInput.command.mealTitle',
  mealReview: 'voiceInput.command.mealTitle',
  workoutChoice: 'voiceInput.command.workoutTitle',
  cardio: 'cardio.title',
};

type VoiceCommandModalProps = {
  /** The modal is open exactly while this is set. */
  state: VoiceCommandModalState | null;
  /** The step a meal estimate is on. */
  progress?: MealEstimateProgressLine | null;
  /** Abandons the request while working, and closes the modal. */
  onCancel: () => void;
  onAskCoach: (transcript: string) => void;
  onPickTool: (transcript: string, tool: VoiceActionTool) => void;
  /** The weigh-in sheet closed; `saved` says whether the weight was written. */
  onWeighInClose: (saved: boolean) => void;
  onLogMeal: (data: LogMealData) => Promise<void>;
  /** The meal review closed, after logging or without it. */
  onMealReviewClose: () => void;
  onPickWorkout: (workout: WorkoutChoice) => void;
  /** The walk or run was saved; the sheet closes right after. */
  onCardioLogged: () => void;
  /** The walk or run sheet closed, after saving or without it. */
  onCardioClose: () => void;
};

/**
 * Every stage of a voice command that needs the person's attention, in one modal: waiting for the
 * answer (cancellable), picking the tool they meant when no command could be run or the workout they
 * meant when several could be, and the sheets a command opens here (the weigh-in, the meal review
 * and the walk or run). Those are its children, never siblings: iOS drops a second modal presented
 * beside the first.
 */
export function VoiceCommandModal({
  state,
  progress,
  onCancel,
  onAskCoach,
  onPickTool,
  onWeighInClose,
  onLogMeal,
  onMealReviewClose,
  onPickWorkout,
  onCardioLogged,
  onCardioClose,
}: VoiceCommandModalProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const isPicking = state?.kind === 'pick';

  const cancelButton = (
    <Button
      label={t('common.cancel')}
      variant="outline"
      size="md"
      width="full"
      onPress={onCancel}
    />
  );

  const footer = isPicking ? (
    <View className="flex-row flex-wrap gap-3">
      <View className="grow basis-[140px]">{cancelButton}</View>
      <View className="grow basis-[140px]">
        <Button
          label={t('voiceInput.command.askCoach')}
          variant="outline"
          size="md"
          width="full"
          onPress={() => (state ? onAskCoach(state.transcript) : undefined)}
        />
      </View>
    </View>
  ) : (
    cancelButton
  );

  return (
    <CenteredModal
      visible={state !== null}
      onClose={onCancel}
      title={t(TITLE_KEYS[state?.kind ?? 'working'])}
      footer={footer}
      scrollable
    >
      <View className="gap-4">
        <Text selectable className="text-base text-text-primary">
          {state?.transcript}
        </Text>
        {state?.kind === 'working' || state?.kind === 'estimating' ? (
          <ActivityIndicator color={theme.colors.accent.primary} />
        ) : null}
        {state?.kind === 'estimating' && progress ? (
          <Text
            accessibilityLiveRegion="polite"
            className="text-center text-sm text-text-secondary"
          >
            {t(progress.key, progress.options)}
          </Text>
        ) : null}
        {state?.kind === 'pick' ? (
          <View className="gap-2">
            <Text className="text-sm text-text-secondary">{t('voiceInput.command.pickHint')}</Text>
            {state.offered
              // The footer's button asks the coach already.
              .filter((name) => name !== 'ask_coach')
              .map((name) => (
                <ListRow
                  key={name}
                  variant="filled"
                  title={t(VOICE_TOOLS[name].titleKey)}
                  subtitle={t(VOICE_TOOLS[name].labelKey)}
                  onPress={() => onPickTool(state.transcript, name)}
                />
              ))}
          </View>
        ) : null}
        {state?.kind === 'workoutChoice' ? (
          <View className="gap-2">
            {state.workouts.map((workout) => (
              <ListRow
                key={`${workout.templateId}:${workout.planId ?? ''}`}
                variant="filled"
                title={workout.name}
                subtitle={workout.planName}
                onPress={() => onPickWorkout(workout)}
              />
            ))}
          </View>
        ) : null}
      </View>
      {state?.kind === 'weight' ? (
        <VoiceWeightSheet weighIn={state.weighIn} onClose={onWeighInClose} />
      ) : null}
      {state?.kind === 'mealReview' ? (
        <LogMealModal
          visible
          onClose={onMealReviewClose}
          meal={state.review.meal}
          ingredients={state.review.ingredients}
          initialDate={state.day}
          initialMealType={state.mealType}
          onLogMeal={onLogMeal}
        />
      ) : null}
      {state?.kind === 'cardio' ? (
        <LogCardioModal
          visible
          initial={state.initial}
          onLogged={onCardioLogged}
          onClose={onCardioClose}
        />
      ) : null}
    </CenteredModal>
  );
}
