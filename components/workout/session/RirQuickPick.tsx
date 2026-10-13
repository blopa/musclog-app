import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { Chip } from '@/components/theme/Chip';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';

/** Reps in reserve the quick pick offers; the last one stands for "three or more". */
export const RIR_QUICK_VALUES = [0, 1, 2, 3] as const;

/**
 * One tap to rate a set's effort: reps in reserve is what the automatic progression runs on, and
 * buried behind a details sheet most sets went unrated. Tapping the chosen value again clears it
 * (unrated, never a silent 0).
 */
export function RirQuickPick({
  value,
  disabled,
  onChange,
  testID,
}: {
  /** The draft's RIR text; empty or blank means unrated. */
  value: string | undefined;
  disabled?: boolean;
  onChange: (rir: string) => void;
  testID?: string;
}) {
  const { t } = useTranslation();
  const { formatInteger } = useFormatAppNumber();
  const selected = value?.trim() ? Number(value) : null;

  return (
    <View className="gap-2" testID={testID}>
      <Text className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
        {t('trainingFlow.rirQuickLabel')}
      </Text>
      <View className="flex-row flex-wrap gap-2">
        {RIR_QUICK_VALUES.map((rir) => {
          const isLast = rir === RIR_QUICK_VALUES[RIR_QUICK_VALUES.length - 1];
          const number = formatInteger(rir, { useGrouping: false });
          return (
            <Chip
              key={rir}
              variant="solid"
              role="radio"
              label={isLast ? `${number}+` : number}
              accessibilityLabel={t(isLast ? 'trainingFlow.rirOrMore' : 'trainingFlow.rir', {
                value: number,
              })}
              selected={selected === rir}
              disabled={disabled}
              testID={`rir-quick-${rir}`}
              onPress={() => onChange(selected === rir ? '' : String(rir))}
            />
          );
        })}
      </View>
    </View>
  );
}
