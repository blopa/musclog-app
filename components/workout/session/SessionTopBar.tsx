import { ChevronLeft, LayoutList, MoreVertical, Square } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { IconButton } from '@/components/theme/IconButton';
import { SegmentedControl } from '@/components/theme/SegmentedControl';
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
  ].map(({ icon: Icon, ...option }) => ({
    ...option,
    icon: (selected: boolean) => (
      <Icon
        size={theme.iconSize.sm}
        color={selected ? theme.colors.text.onAccent : theme.colors.text.secondary}
      />
    ),
  }));
  return (
    <SegmentedControl
      variant="pill"
      options={options}
      value={value}
      onValueChange={(next) => onChange(next as SessionView)}
    />
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
  const { formatInteger } = useFormatAppNumber();
  const fraction = total > 0 ? done / total : 0;
  return (
    <View className="gap-1 border-b border-border-light bg-bg-primary px-2 pb-2 pt-1">
      <View className="flex-row items-center gap-1">
        <IconButton
          icon={ChevronLeft}
          accessibilityLabel={t('trainingFlow.pause')}
          onPress={onPause}
          size="lg"
          variant="ghost"
        />
        <View className="min-w-0 flex-1">
          <Text className="text-base font-semibold text-text-primary" numberOfLines={1}>
            {title}
          </Text>
          <Text className="text-xs text-text-secondary" numberOfLines={1}>
            <Text className="font-semibold tabular-nums text-accent-primary">{duration}</Text>
            {` · ${t('trainingFlow.progress', { done: formatInteger(done), total: formatInteger(total) })}`}
          </Text>
        </View>
        <IconButton
          icon={MoreVertical}
          accessibilityLabel={t('trainingFlow.actions.more')}
          onPress={onMore}
          size="lg"
          variant="ghost"
        />
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
