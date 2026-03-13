import { MaterialIcons } from '@expo/vector-icons';
import { ChevronDown } from 'lucide-react-native';
import type { ComponentProps } from 'react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, ScrollView, Text, View } from 'react-native';

import { useTheme } from '../../hooks/useTheme';
import { BottomPopUp } from '../BottomPopUp';

// Curated list of food-related MaterialIcons for portion sizes
const FOOD_ICONS: ComponentProps<typeof MaterialIcons>['name'][] = [
  'restaurant',
  'local-dining',
  'fastfood',
  'cake',
  'bakery-dining',
  'breakfast-dining',
  'lunch-dining',
  'dinner-dining',
  'icecream',
  'local-cafe',
  'coffee',
  'local-bar',
  'wine-bar',
  'set-meal',
  'ramen-dining',
  'rice-bowl',
  'soup-kitchen',
  'egg',
  'egg-alt',
  'apple',
  'local-grocery-store',
  'shopping-bag',
  'shopping-cart',
  'inventory',
  'scale',
  'monitor-weight',
];

type IconPickerProps = {
  value?: string;
  onSelect: (iconName: string) => void;
  label?: string;
};

export function IconPicker({ value, onSelect, label }: IconPickerProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [modalVisible, setModalVisible] = useState(false);
  const selectedIcon = value || 'restaurant';

  return (
    <View className="gap-2">
      {label ? <Text className="ml-1 text-sm font-medium text-text-secondary">{label}</Text> : null}
      <Pressable
        onPress={() => setModalVisible(true)}
        className="flex-row items-center justify-between rounded-lg border border-border-default bg-bg-overlay px-4 py-3 active:opacity-70"
      >
        <View className="flex-row items-center gap-3">
          <View
            className="h-10 w-10 items-center justify-center rounded-full"
            style={{ backgroundColor: theme.colors.accent.primary10 }}
          >
            <MaterialIcons
              name={selectedIcon as any}
              size={theme.iconSize.md}
              color={theme.colors.accent.primary}
            />
          </View>
          <Text className="text-base text-text-primary">{selectedIcon || t('common.selectIcon')}</Text>
        </View>
        <ChevronDown size={theme.iconSize.md} color={theme.colors.text.secondary} />
      </Pressable>

      <BottomPopUp
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        title={label || t('common.selectIconLabel')}
        maxHeight="80%"
      >
        <ScrollView className="p-6" showsVerticalScrollIndicator={false}>
          <View className="flex-row flex-wrap" style={{ gap: theme.spacing.gap.md }}>
            {FOOD_ICONS.map((iconName) => {
              const isSelected = iconName === selectedIcon;
              return (
                <Pressable
                  key={iconName}
                  onPress={() => {
                    onSelect(iconName);
                    setModalVisible(false);
                  }}
                  {...(Platform.OS === 'android' && { unstable_pressDelay: 130 })}
                  className={`h-14 w-14 items-center justify-center rounded-lg border ${
                    isSelected
                      ? 'bg-accent-primary10 border-accent-primary'
                      : 'border-border-default bg-bg-card'
                  } active:opacity-70`}
                  style={{
                    borderColor: isSelected
                      ? theme.colors.accent.primary
                      : theme.colors.border.default,
                    backgroundColor: isSelected
                      ? theme.colors.accent.primary10
                      : theme.colors.background.card,
                  }}
                >
                  <MaterialIcons
                    name={iconName}
                    size={theme.iconSize.lg}
                    color={isSelected ? theme.colors.accent.primary : theme.colors.text.secondary}
                  />
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      </BottomPopUp>
    </View>
  );
}
