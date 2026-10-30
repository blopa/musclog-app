import { Annoyed, Frown, Laugh, type LucideIcon, Meh, Smile } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';

import { Slider } from '@/components/theme/Slider';
import { useTheme } from '@/hooks/useTheme';

import { GenericCard } from './GenericCard';

type MoodSelectorCardProps = {
  disabled?: boolean;
  value: number; // -1: unrecorded; 0-4: Poor, Low, Okay, Good, Great
  onChange: (value: number) => void;
  /** `default` shows icon mood chips only; `enhanced` adds the slider above them. */
  variant?: 'default' | 'enhanced';
  /** Tighter padding and smaller icons, for the home prompt. */
  compact?: boolean;
};

const MOOD_ICONS: LucideIcon[] = [Frown, Annoyed, Meh, Smile, Laugh];

export function MoodSelectorCard({
  value,
  onChange,
  variant = 'default',
  disabled = false,
  compact = false,
}: MoodSelectorCardProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <GenericCard variant="flat">
      <View className={compact ? 'px-3 py-2.5' : 'p-4'}>
        <View
          className={`${compact ? 'mb-2' : 'mb-6'} flex-row items-center justify-between gap-2`}
        >
          <View className="flex-1 flex-row items-center gap-3" style={{ minWidth: 0 }}>
            <Text className="flex-1 text-xs font-semibold text-text-secondary">
              {t('bodyMetrics.addEntry.moodQuestion')}
            </Text>
          </View>
          <View
            className="flex-shrink-0 rounded-tag px-2 py-0.5"
            style={{ backgroundColor: theme.colors.accent.primary10 }}
          >
            <Text className="text-xs font-semibold text-accent-primary" numberOfLines={1}>
              {value < 0
                ? t('cycle.personalize.moodUnlogged')
                : t(`bodyMetrics.addEntry.moods.${value}`)}
            </Text>
          </View>
        </View>

        <View className="relative px-2">
          {variant === 'enhanced' ? (
            <Slider
              value={value}
              min={0}
              max={4}
              step={1}
              onChange={onChange}
              variant="solid"
              trackColor={theme.colors.background.cardElevated}
              solidColor={theme.colors.accent.primary}
              thumbColor={theme.colors.accent.primary}
              useGradient={false}
            />
          ) : null}

          <View className={`flex-row justify-between px-1 ${variant === 'enhanced' ? 'mt-4' : ''}`}>
            {[0, 1, 2, 3, 4].map((moodValue) => {
              const isSelected = value === moodValue;
              const MoodIcon = MOOD_ICONS[moodValue];
              return (
                <Pressable
                  key={moodValue}
                  disabled={disabled}
                  onPress={() => onChange(moodValue)}
                  accessibilityRole="button"
                  accessibilityLabel={t(`bodyMetrics.addEntry.moods.${moodValue}`)}
                  accessibilityState={{ selected: isSelected, disabled }}
                  className={`flex-col items-center ${compact ? 'gap-0.5' : 'gap-1'}`}
                >
                  <MoodIcon
                    size={compact ? theme.iconSize.lg : theme.iconSize.xl}
                    color={isSelected ? theme.colors.accent.primary : theme.colors.text.tertiary}
                    strokeWidth={isSelected ? 2.5 : 2}
                  />
                  <Text
                    className={`text-xs font-semibold ${
                      isSelected ? 'text-accent-primary' : 'text-text-tertiary'
                    }`}
                    style={{ opacity: isSelected ? 1 : 0.4 }}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.7}
                  >
                    {t(`bodyMetrics.addEntry.moods.${moodValue}`)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </GenericCard>
  );
}
