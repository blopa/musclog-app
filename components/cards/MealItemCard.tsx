import React from 'react';
import { View, Text, Image, TouchableOpacity } from 'react-native';
import { Plus } from 'lucide-react-native';
import { GenericCard } from './GenericCard';
import { theme } from '../../theme';

type MacroProps = {
  label: string;
  value: string;
  color: string;
};

const Macro = ({ label, value, color }: MacroProps) => (
  <View className="flex-col gap-y-0.5">
    <Text className="text-[10px] font-bold uppercase" style={{ color }}>
      {label}
    </Text>
    <Text className="text-sm font-bold" style={{ color: theme.colors.text.gray300 }}>
      {value}
    </Text>
  </View>
);

type MealItemCardProps = {
  title: string;
  tags: string[];
  calories: number;
  macros: {
    protein: string;
    carbs: string;
    fat: string;
  };
  imageUrl?: string;
  onTrackPress: () => void;
};

export function MealItemCard({
  title,
  tags,
  calories,
  macros,
  imageUrl,
  onTrackPress,
}: MealItemCardProps) {
  return (
    <GenericCard variant="default" containerStyle={{}}>
      <View className="flex-row gap-x-4 p-4">
        <View className="relative">
          <View
            className="h-24 w-24 overflow-hidden rounded-lg"
            style={{ backgroundColor: theme.colors.background.separatorLight }}
          >
            <Image
              source={{ uri: imageUrl || 'https://via.placeholder.com/150' }}
              className="h-full w-full"
            />
          </View>

          <View
            className="absolute rounded-full px-2 py-1"
            style={{
              bottom: theme.offset.badge,
              right: theme.offset.badge,
              borderWidth: theme.borderWidth.medium,
              borderColor: theme.colors.background.separatorLight,
              backgroundColor: theme.colors.accent.primary,
            }}
          >
            <Text className="text-[10px] font-black" style={{ color: theme.colors.text.black }}>
              {calories} kcal
            </Text>
          </View>
        </View>

        {/* Content */}
        <View className="flex-1 justify-between">
          <View>
            <Text
              className="mb-0.5 text-base font-bold"
              style={{ color: theme.colors.text.gray300 }}
            >
              {title}
            </Text>
            <Text className="text-xs font-medium" style={{ color: theme.colors.text.gray500 }}>
              {tags.join(' • ')}
            </Text>
          </View>

          <View className="flex-row items-end justify-between">
            <View className="flex-row items-center gap-x-3">
              <Macro label="PROT" value={macros.protein} color={theme.colors.status.red400} />
              <View
                className="h-5 w-[1px]"
                style={{ backgroundColor: theme.colors.border.gray600 }}
              />
              <Macro label="CARBS" value={macros.carbs} color={theme.colors.status.teal400} />
              <View
                className="h-5 w-[1px]"
                style={{ backgroundColor: theme.colors.border.gray600 }}
              />
              <Macro label="FATS" value={macros.fat} color={theme.colors.status.amber} />
            </View>

            <TouchableOpacity
              onPress={onTrackPress}
              activeOpacity={0.7}
              className="flex-row items-center gap-x-1 rounded-lg"
              style={{
                backgroundColor: theme.colors.accent.primary20,
                paddingHorizontal: theme.spacing.padding.sm,
                paddingVertical: theme.spacing.padding.xs,
              }}
            >
              {/* For icons, we still use props for color/size for best performance */}
              <Plus size={14} color={theme.colors.accent.primary} strokeWidth={3} />
              <Text className="text-xs font-bold" style={{ color: theme.colors.status.greenDark }}>
                Track
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </GenericCard>
  );
}
