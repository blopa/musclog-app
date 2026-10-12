import { ChevronLeft, LayoutList, MoreVertical, Square } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';

import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { useTheme } from '@/hooks/useTheme';

export type SessionView = 'inline' | 'guided';

/** The two presentations, always visible: switching is a display choice, never a new session. */
function ViewToggle({
  value,
  onChange,
}: {
  value: SessionView;
  onChange: (value: SessionView) => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const options = [
    { value: 'inline' as const, label: t('trainingFlow.inline'), icon: LayoutList },
    { value: 'guided' as const, label: t('trainingFlow.guided'), icon: Square },
  ];
  return (
    <View className="flex-row rounded-full bg-bg-overlay p-1" accessibilityRole="radiogroup">
      {options.map((option) => {
        const selected = option.value === value;
        const Icon = option.icon;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityLabel={option.label}
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            hitSlop={{ top: 4, bottom: 4 }}
            className={`min-h-9 flex-row items-center gap-1.5 rounded-full px-3 ${selected ? 'bg-accent-primary' : ''}`}
          >
            <Icon
              size={theme.iconSize.sm}
              color={selected ? theme.colors.text.onAccent : theme.colors.text.secondary}
            />
            <Text
              className={`text-sm font-semibold ${selected ? 'text-text-on-accent' : 'text-text-secondary'}`}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function SessionTopBar({
  title,
  duration,
  done,
  total,
  view,
  onViewChange,
  onPause,
  onMore,
}: {
  title: string;
  duration: string;
  done: number;
  total: number;
  view: SessionView;
  onViewChange: (value: SessionView) => void;
  onPause: () => void;
  onMore: () => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { formatInteger } = useFormatAppNumber();
  const fraction = total > 0 ? done / total : 0;
  return (
    <View className="gap-1 border-b border-border-light bg-bg-primary px-2 pb-2 pt-1">
      <View className="flex-row items-center gap-1">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('trainingFlow.pause')}
          onPress={onPause}
          className="h-12 w-12 items-center justify-center"
        >
          <ChevronLeft size={theme.iconSize.lg} color={theme.colors.text.primary} />
        </Pressable>
        <View className="min-w-0 flex-1">
          <Text className="text-base font-bold text-text-primary" numberOfLines={1}>
            {title}
          </Text>
          <Text className="text-xs text-text-secondary" numberOfLines={1}>
            <Text className="font-semibold text-accent-primary">{duration}</Text>
            {` · ${t('trainingFlow.progress', { done: formatInteger(done), total: formatInteger(total) })}`}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('trainingFlow.actions.more')}
          onPress={onMore}
          className="h-12 w-12 items-center justify-center"
        >
          <MoreVertical size={theme.iconSize.lg} color={theme.colors.text.primary} />
        </Pressable>
      </View>
      <View className="flex-row items-center gap-3 pl-3">
        <View className="h-1.5 flex-1 overflow-hidden rounded-full bg-bg-overlay">
          <View
            className="h-full rounded-full bg-accent-primary"
            style={{ width: `${fraction * 100}%` }}
          />
        </View>
        <ViewToggle value={view} onChange={onViewChange} />
      </View>
    </View>
  );
}
