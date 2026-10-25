import { SkipForward } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { BottomPopUp } from '@/components/BottomPopUp';
import { Button } from '@/components/theme/Button';
import { NumericTextField } from '@/components/theme/NumericTextField';
import type { SessionDraft } from '@/hooks/useWorkoutSessionController';

import { type EffortDraftField, effortDraftProblems } from './setDraft';

/** What to tell the user when an effort field is out of range; whole keys, never built. */
const EFFORT_PROBLEM_KEYS = {
  rir: 'trainingFlow.invalidRir',
  rpe: 'trainingFlow.invalidRpe',
  partials: 'trainingFlow.invalidPartials',
} as const satisfies Record<EffortDraftField, string>;

/**
 * The optional part of logging a set: effort (RIR/RPE) and partial reps, plus skipping it. Nothing
 * here is needed to complete a set; leaving RIR empty records the set as unrated rather than as 0.
 */
export function SetDetailsSheet({
  title,
  draft,
  locale,
  editable,
  canSkip,
  busy,
  onChange,
  onSkip,
  onClose,
}: {
  title: string;
  draft: SessionDraft;
  locale: string;
  editable: boolean;
  canSkip: boolean;
  busy: boolean;
  onChange: (patch: Partial<SessionDraft>) => void;
  onSkip: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const problems = effortDraftProblems(draft, locale);
  const field = (key: EffortDraftField, label: string, hint?: string) => (
    <View className="min-w-24 flex-1 gap-1">
      <Text className="text-xs font-semibold text-text-secondary">{label}</Text>
      <NumericTextField
        accessibilityLabel={label}
        value={draft[key] ?? ''}
        editable={editable}
        onChangeText={(text) => onChange({ [key]: text })}
        integer={key === 'partials'}
        invalid={problems.includes(key)}
        placeholder="–"
      />
      {hint ? <Text className="text-xs text-text-tertiary">{hint}</Text> : null}
    </View>
  );
  return (
    <BottomPopUp visible onClose={onClose} title={title} subtitle={t('trainingFlow.detailsHint')}>
      <View className="gap-5 pb-6">
        <View className="flex-row flex-wrap gap-3">
          {field('rir', t('trainingFlow.rirLabel'), t('trainingFlow.rirHint'))}
          {field('rpe', t('trainingFlow.rpe'), t('trainingFlow.rpeHint'))}
          {field('partials', t('trainingFlow.partials'))}
        </View>
        {problems.map((key) => (
          <Text key={key} className="text-sm text-status-error" accessibilityRole="alert">
            {t(EFFORT_PROBLEM_KEYS[key])}
          </Text>
        ))}
        {canSkip ? (
          <Button
            label={t('trainingFlow.skipSet')}
            icon={SkipForward}
            variant="outline"
            width="full"
            disabled={busy}
            onPress={onSkip}
          />
        ) : null}
        <Button
          label={t('trainingFlow.done')}
          width="full"
          disabled={problems.length > 0}
          onPress={onClose}
        />
      </View>
    </BottomPopUp>
  );
}
