import { type ReactNode, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, View } from 'react-native';
import {
  KeyboardAwareScrollView,
  type KeyboardAwareScrollViewRef,
} from 'react-native-keyboard-controller';

import { Button } from '@/components/theme/Button';
import { SegmentedControl } from '@/components/theme/SegmentedControl';
import type Exercise from '@/database/models/Exercise';
import { WorkoutProgressionService } from '@/database/services/WorkoutProgressionService';
import type { EnrichedWorkoutLogSet } from '@/database/services/WorkoutService';
import { useActiveGym } from '@/hooks/useActiveGym';
import { useExerciseUserSettings } from '@/hooks/useExerciseUserSettings';
import { useWorkoutSessionController } from '@/hooks/useWorkoutSessionController';
import { isBarLoadedEquipment } from '@/utils/gym';
import { platesPerSide } from '@/utils/plateCalculator';
import { parseProgressionRule, parseSessionProgressionState } from '@/utils/progressionRules';
import { parseSetPrescription } from '@/utils/setPrescription';
import { getFirstUnloggedInEffectiveOrder } from '@/utils/workoutSupersetOrder';

import { SessionSetRow } from './SessionSetRow';
import { SetAdjustmentNotice } from './SetAdjustmentNotice';

type Controller = ReturnType<typeof useWorkoutSessionController>;
export function WorkoutTrainingView({
  sets,
  exercises,
  controller,
  selectedExercise,
  onSelect,
  onAction,
  onFinish,
  children,
}: {
  sets: EnrichedWorkoutLogSet[];
  exercises: Exercise[];
  controller: Controller;
  selectedExercise?: string;
  onSelect: (id: string) => void;
  onAction: (id: string, action: 'guidance' | 'warmup' | 'swap' | 'notes' | 'more') => void;
  onFinish: () => void;
  children?: ReactNode;
}) {
  const { t } = useTranslation();
  const { gym } = useActiveGym();
  const { unitsFor } = useExerciseUserSettings();
  const [undoError, setUndoError] = useState(false);
  const [timerExpanded, setTimerExpanded] = useState(false);
  const scroll = useRef<KeyboardAwareScrollViewRef>(null);
  const cardPositions = useRef(new Map<string, number>());
  const rowPositions = useRef(new Map<string, number>());
  const insightsHeight = useRef(0);
  const next = getFirstUnloggedInEffectiveOrder(sets);
  const current = selectedExercise ?? next?.exerciseId ?? exercises[0]?.id;
  useEffect(() => {
    const block = selectedExercise ? sets.find((set) => set.exerciseId === selectedExercise) : next;
    const y = block ? cardPositions.current.get(block.logExerciseId) : undefined;
    if (controller.view === 'inline' && y != null) {
      scroll.current?.scrollTo({
        y:
          insightsHeight.current +
          y +
          (selectedExercise ? 0 : (rowPositions.current.get(next!.id) ?? 0)),
        animated: true,
      });
    }
  }, [next?.id, controller.view, selectedExercise, sets]);
  const blocks = [...new Set(sets.map((set) => set.logExerciseId))];
  return (
    <View className="flex-1 gap-3">
      <View className="px-4">
        <SegmentedControl
          options={[
            { value: 'inline', label: t('trainingFlow.inline') },
            { value: 'guided', label: t('trainingFlow.guided') },
          ]}
          value={controller.view}
          onValueChange={(value) => controller.changeView(value === 'inline' ? 'inline' : 'guided')}
        />
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0, flexShrink: 0, height: 56 }}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
      >
        {exercises.map((exercise) => (
          <Pressable
            key={exercise.id}
            accessibilityRole="button"
            onPress={() => onSelect(exercise.id)}
            className={`min-h-12 justify-center rounded-xl px-3 ${exercise.id === current ? 'bg-accent-primary10' : 'bg-bg-cardElevated'}`}
          >
            <Text className="text-text-primary">{exercise.name}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <KeyboardAwareScrollView
        ref={scroll}
        bottomOffset={16}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
      >
        <View
          onLayout={(event) => {
            insightsHeight.current = event.nativeEvent.layout.height;
          }}
        >
          {children}
        </View>
        <View className="gap-4">
          {blocks.map((blockId) => {
            const blockSets = sets
              .filter((set) => set.logExerciseId === blockId)
              .sort((a, b) => a.setOrder - b.setOrder);
            const exercise = exercises.find((ex) => ex.id === blockSets[0].exerciseId);
            if (!exercise || (controller.view === 'guided' && exercise.id !== current)) {
              return null;
            }
            const rule = parseProgressionRule(blockSets[0].progressionJson);
            const previous = parseSetPrescription(blockSets[0].prescriptionJson)?.previous;
            const focus =
              blockSets.find((set) => set.completionStatus === 'planned') ?? blockSets[0];
            let source = rule ? 'rule' : previous ? 'suggested' : 'learning';
            if (
              rule?.type === 'percentage' &&
              !parseSessionProgressionState(blockSets[0].progressionJson)
            ) {
              source = 'learning';
            }
            if (gym && isBarLoadedEquipment(exercise.equipmentType)) {
              const load = platesPerSide(focus.weight, gym);
              if (load.belowBar || load.remainderKg > 0.05) {
                source = 'attention';
              }
            }
            const visible = controller.view === 'guided' ? [focus] : blockSets;
            return (
              <View
                key={blockId}
                onLayout={(e) => cardPositions.current.set(blockId, e.nativeEvent.layout.y)}
                className="gap-3 rounded-2xl bg-bg-card p-4"
              >
                <Text className="text-xl font-bold text-text-primary">{exercise.name}</Text>
                <Text className="text-sm text-accent-primary">
                  {t(`progression.states.${source}`)} ·{' '}
                  {t(`progression.methods.${rule?.type ?? 'automatic'}`)}
                  {rule && 'repMin' in rule ? ` · ${rule.repMin}–${rule.repMax}` : ''}
                </Text>
                <View className="flex-row flex-wrap gap-x-4">
                  {(['guidance', 'warmup', 'swap', 'notes', 'more'] as const).map((action) => (
                    <Pressable
                      key={action}
                      accessibilityRole="button"
                      className="min-h-11 justify-center"
                      onPress={() => onAction(exercise.id, action)}
                    >
                      <Text className="text-sm text-accent-primary">
                        {t(`trainingFlow.actions.${action}`)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                {focus.adjustment ? (
                  <SetAdjustmentNotice
                    adjustment={focus.adjustment}
                    units={unitsFor(exercise.id)}
                    onRevert={() =>
                      WorkoutProgressionService.revertStartAdjustment(blockId).catch(() =>
                        setUndoError(true)
                      )
                    }
                  />
                ) : (
                  <Text className="text-sm text-text-secondary">
                    {t(rule ? 'progression.followRule' : 'progression.learningHint')}
                  </Text>
                )}
                {visible.map((set) => (
                  <View
                    key={set.id}
                    onLayout={(event) => {
                      rowPositions.current.set(set.id, event.nativeEvent.layout.y);
                    }}
                  >
                    <SessionSetRow
                      set={set}
                      draft={controller.drafts[set.id]}
                      units={unitsFor(exercise.id)}
                      previous={parseSetPrescription(set.prescriptionJson)?.previous}
                      guided={controller.view === 'guided'}
                      busy={controller.busy}
                      onEdit={(draft) => controller.edit(set.id, draft)}
                      onComplete={(values) => controller.complete(set.id, values)}
                      onSkip={() => controller.skip(set.id)}
                    />
                  </View>
                ))}
              </View>
            );
          })}
        </View>
        {controller.error || undoError ? (
          <Text accessibilityRole="alert" className="py-3 text-status-error">
            {t('errors.somethingWentWrong')}
          </Text>
        ) : null}
        <View className="pt-4">
          <Button
            label={t('trainingFlow.finish')}
            onPress={onFinish}
            disabled={controller.busy}
            variant="accent"
            width="full"
          />
        </View>
      </KeyboardAwareScrollView>
      <View
        className="border-t border-border-light bg-bg-card px-4 py-2"
        testID="session-rest-timer"
      >
        <View className="flex-row items-center justify-between">
          <Pressable
            accessibilityRole="button"
            className="min-h-12 justify-center"
            onPress={() => setTimerExpanded(!timerExpanded)}
          >
            <Text className="text-lg font-semibold text-text-primary">
              {t(controller.restSeconds ? 'trainingFlow.rest' : 'trainingFlow.restReady')}{' '}
              {controller.restSeconds
                ? `${Math.floor(controller.restSeconds / 60)}:${String(controller.restSeconds % 60).padStart(2, '0')}`
                : ''}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            className="min-h-12 justify-center"
            onPress={() =>
              controller.restSeconds
                ? controller.stopRest()
                : controller.startRest(controller.defaultRest)
            }
          >
            <Text className="text-accent-primary">
              {t(controller.restSeconds ? 'trainingFlow.skipRest' : 'trainingFlow.startRest')}
            </Text>
          </Pressable>
        </View>
        {timerExpanded ? (
          <View className="gap-2 py-4">
            <Text className="text-center text-5xl font-bold text-text-primary">
              {controller.restSeconds}
            </Text>
            <Button
              label={t('trainingFlow.addRest')}
              variant="outline"
              onPress={() => controller.startRest(controller.restSeconds + 30)}
            />
          </View>
        ) : null}
      </View>
    </View>
  );
}
