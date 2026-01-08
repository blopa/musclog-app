import { View, Text, Pressable, ScrollView } from 'react-native';
import { theme } from '../theme';

type FilterTab = {
  id: string;
  label: string;
};

type FilterTabsProps = {
  tabs: FilterTab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
};

export function FilterTabs({ tabs, activeTab, onTabChange }: FilterTabsProps) {
  return (
    <View className="mb-6">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 24 }}
        className="flex-row">
        {tabs.map((tab, index) => {
          const isActive = activeTab === tab.id;
          return (
            <Pressable
              key={tab.id}
              className={`rounded-full px-6 py-2.5 ${
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
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
