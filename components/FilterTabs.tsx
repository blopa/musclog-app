import { View, Text, Pressable } from 'react-native';
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
    <View className="mb-6 flex-row gap-3 px-6">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <Pressable
            key={tab.id}
            className={`rounded-full px-6 py-2.5 ${
              isActive ? 'bg-accent-primary' : 'border border-border-light bg-bg-filterTab'
            }`}
            onPress={() => onTabChange(tab.id)}>
            <Text
              className={`text-sm font-medium ${
                isActive ? 'font-semibold text-black' : 'text-gray-300'
              }`}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
