import { View, Text, Pressable, ScrollView, ViewStyle } from 'react-native';
import { Check } from 'lucide-react-native';
import { theme } from '../theme';

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
};

export function FilterTabs({
  tabs,
  activeTab,
  onTabChange,
  containerClassName,
  scrollViewContentContainerStyle,
  showContainer = true,
  withCheckmark = false,
}: FilterTabsProps) {
  const content = (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={scrollViewContentContainerStyle || { paddingHorizontal: theme.spacing.padding.xl }}
      className="flex-row">
      {tabs.map((tab, index) => {
        const isActive = activeTab === tab.id;

        return (
          <Pressable
            key={tab.id}
            className={`flex-row items-center rounded-full px-6 py-2.5 ${
              isActive ? 'bg-accent-primary' : 'border border-border-light bg-bg-filterTab'
            }`}
            style={{ marginRight: index < tabs.length - 1 ? 12 : 0 }}
            onPress={() => onTabChange(tab.id)}>
            <Text
              className={`text-sm font-medium ${isActive ? 'font-semibold' : ''}`}
              style={{
                color: isActive ? theme.colors.text.black : theme.colors.text.gray300,
              }}>
              {tab.label}
            </Text>
            {isActive && withCheckmark && (
              <Check size={14} color={theme.colors.text.black} style={{ marginLeft: theme.spacing.margin['1half'] }} />
            )}
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
