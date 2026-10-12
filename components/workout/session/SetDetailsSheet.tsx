import { SkipForward } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { BottomPopUp } from '@/components/BottomPopUp';
import { Button } from '@/components/theme/Button';
import { NumericTextField } from '@/components/theme/NumericTextField';
import type { SessionDraft } from '@/hooks/useWorkoutSessionController';

/**
 * The optional part of logging a set: effort (RIR/RPE) and partial reps, plus skipping it. Nothing
 * here is needed to complete a set; leaving RIR empty records the set as unrated rather than as 0.
 */
export function SetDetailsSheet({
  title,
  draft,
  editable,
  canSkip,
  busy,
  onChange,
  onSkip,
  onClose,
}: {
  title: string;
  draft: SessionDraft;
  editable: boolean;
  canSkip: boolean;
  busy: boolean;
  onChange: (draft: SessionDraft) => void;
  onSkip: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const field = (key: 'rir' | 'rpe' | 'partials', label: string, hint?: string) => (
    <View className="min-w-24 flex-1 gap-1">
      <Text className="text-xs font-semibold uppercase text-text-secondary">{label}</Text>
      <NumericTextField
        accessibilityLabel={label}
        value={draft[key] ?? ''}
        editable={editable}
        onChangeText={(text) => onChange({ ...draft, [key]: text })}
        integer={key === 'partials'}
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
          {field('rpe', t('trainingFlow.rpe'))}
          {field('partials', t('trainingFlow.partials'))}
        </View>
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
        <Button label={t('trainingFlow.done')} width="full" onPress={onClose} />
      </View>
    </BottomPopUp>
  );
}
