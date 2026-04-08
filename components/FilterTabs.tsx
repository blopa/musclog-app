import { Check } from 'lucide-react-native';
import { Platform, Pressable, ScrollView, Text, View, ViewStyle } from 'react-native';

import { useTheme } from '@/hooks/useTheme';

type FilterTab = {
  id: string;
  label: string;
};

type FilterTabsProps = {
  tabs: FilterTab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  containerClassName?: string;
  scrollViewContentContainerStyle?: ViewStyle;
  showContainer?: boolean;
  withCheckmark?: boolean;
  inactiveTextColor?: string;
  inactiveBackgroundColor?: string;
};

export function FilterTabs({
  tabs,
  activeTab,
  onTabChange,
  containerClassName,
  scrollViewContentContainerStyle,
  showContainer = true,
  withCheckmark = false,
  inactiveTextColor,
  inactiveBackgroundColor,
}: FilterTabsProps) {
  const theme = useTheme();
  const content = (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={
        scrollViewContentContainerStyle || { paddingHorizontal: theme.spacing.padding.xl }
      }
      className="flex-row"
    >
      {tabs.map((tab, index) => {
        const isActive = activeTab === tab.id;

        return (
          <Pressable
            key={tab.id}
            className={`flex-row items-center rounded-full px-6 py-2.5 ${
              isActive ? 'bg-accent-primary' : 'border border-border-light bg-bg-filterTab'
            }`}
            style={{
              marginRight: index < tabs.length - 1 ? theme.spacing.gap.md : 0,
              ...(isActive || !inactiveBackgroundColor
                ? undefined
                : { backgroundColor: inactiveBackgroundColor }),
            }}
            onPress={() => onTabChange(tab.id)}
            {...(Platform.OS === 'android' && { unstable_pressDelay: 130 })}
          >
            <Text
              className={`text-sm font-medium ${isActive ? 'font-semibold' : ''}`}
              style={{
                color: isActive
                  ? theme.colors.text.black
                  : (inactiveTextColor ?? theme.colors.text.gray300),
              }}
            >
              {tab.label}
            </Text>
            {isActive && withCheckmark ? (
              <Check
                size={theme.iconSize.sm}
                color={theme.colors.text.black}
                style={{ marginLeft: theme.spacing.margin['1half'] }}
              />
            ) : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );

  if (!showContainer) {
    return content;
  }

  return <View className={containerClassName || 'mb-6'}>{content}</View>;
}
