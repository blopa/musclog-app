import { View, Text, Pressable } from 'react-native';

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
              isActive ? 'bg-[#22c55e]' : 'border border-gray-700/30 bg-[#0f2f27]'
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
