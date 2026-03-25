import { Smile } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';

import { useTheme } from '../../hooks/useTheme';
import { Slider } from '../theme/Slider';
import { GenericCard } from './GenericCard';

type MoodSelectorCardProps = {
  value: number; // 0-4: Poor, Low, Okay, Good, Great
  onChange: (value: number) => void;
};

const MOOD_EMOJIS = ['😫', '😔', '😐', '😊', '🤩'];

export function MoodSelectorCard({ value, onChange }: MoodSelectorCardProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <GenericCard variant="card" size="default">
      <View className="p-4">
        <View className="mb-6 flex-row items-start justify-between gap-2">
          <View className="flex-1 flex-row items-start gap-3" style={{ minWidth: 0 }}>
            <Smile size={theme.iconSize.xl} color={theme.colors.text.tertiary} style={{ flexShrink: 0 }} />
            <Text className="flex-1 text-xs font-bold uppercase tracking-wider text-text-secondary">
              {t('bodyMetrics.addEntry.moodQuestion')}
            </Text>
          </View>
          <View
            className="flex-shrink-0 rounded px-2 py-0.5"
            style={{ backgroundColor: theme.colors.accent.primary10 }}
          >
            <Text className="text-xs font-bold text-accent-primary" numberOfLines={1}>
              {t(`bodyMetrics.addEntry.moods.${value}`)}
            </Text>
          </View>
        </View>

        {/* Slider */}
        <View className="relative px-2">
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

          {/* Mood Labels */}
          <View className="mt-4 flex-row justify-between px-1">
            {[0, 1, 2, 3, 4].map((moodValue) => {
              const isSelected = value === moodValue;
              return (
                <Pressable
                  key={moodValue}
                  onPress={() => onChange(moodValue)}
                  className="flex-col items-center gap-1"
                >
                  <Text className="text-xl">{MOOD_EMOJIS[moodValue]}</Text>
                  <Text
                    className={`text-[10px] font-bold uppercase ${
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
