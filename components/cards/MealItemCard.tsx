import React from 'react';
import { View, Text, Image, Pressable, ImageSourcePropType } from 'react-native';
import { Plus } from 'lucide-react-native';
import { theme } from '../../theme';

type MacroProps = {
  label: string;
  value: string;
  color: string;
};

const Macro = ({ label, value, color }: MacroProps) => (
  <View className="gap-0.5">
    <Text
      style={{
        fontSize: 10,
        fontWeight: theme.typography.fontWeight.bold,
        color,
        textTransform: 'uppercase',
      }}>
      {label}
    </Text>
    <Text
      style={{
        fontSize: theme.typography.fontSize.sm,
        fontWeight: theme.typography.fontWeight.bold,
        color: theme.colors.text.primary,
      }}>
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
  image: ImageSourcePropType;
  onTrackPress?: () => void;
};

export function MealItemCard({
  title,
  tags,
  calories,
  macros,
  image,
  onTrackPress,
}: MealItemCardProps) {
  return (
    <View
      style={{
        flexDirection: 'row',
        padding: theme.spacing.padding.md,
        backgroundColor: theme.colors.background.card,
        borderRadius: theme.borderRadius.xl,
        borderWidth: theme.borderWidth.thin,
        borderColor: theme.colors.border.light,
        gap: theme.spacing.gap.base,
      }}>
      {/* Image Container */}
      <View style={{ position: 'relative' }}>
        <View
          style={{
            width: 100,
            height: 100,
            borderRadius: theme.borderRadius.lg,
            overflow: 'hidden',
            backgroundColor: theme.colors.background.cardDark,
          }}>
          <Image source={image} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
        </View>
        {/* Calories Badge */}
        <View
          style={{
            position: 'absolute',
            bottom: -8,
            right: -8,
            backgroundColor: theme.colors.accent.primary,
            paddingHorizontal: theme.spacing.padding.sm,
            paddingVertical: 2,
            borderRadius: theme.borderRadius.full,
            borderWidth: 2,
            borderColor: theme.colors.background.card,
          }}>
          <Text
            style={{
              fontSize: 10,
              fontWeight: theme.typography.fontWeight.bold,
              color: theme.colors.text.black,
            }}>
            {calories} kcal
          </Text>
        </View>
      </View>

      {/* Content */}
      <View style={{ flex: 1, justifyContent: 'space-between' }}>
        <View>
          <Text
            style={{
              fontSize: theme.typography.fontSize.base,
              fontWeight: theme.typography.fontWeight.bold,
              color: theme.colors.text.primary,
              marginBottom: 2,
            }}>
            {title}
          </Text>
          <Text
            style={{
              fontSize: theme.typography.fontSize.xs,
              color: theme.colors.text.accent,
              fontWeight: theme.typography.fontWeight.medium,
            }}>
            {tags.join(' • ')}
          </Text>
        </View>

        <View
          style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', gap: theme.spacing.gap.md }}>
            <Macro label="PROT" value={macros.protein} color={theme.colors.macros.protein.text} />
            <View
              style={{
                width: 1,
                height: 20,
                backgroundColor: theme.colors.border.light,
                alignSelf: 'center',
              }}
            />
            <Macro label="CARB" value={macros.carbs} color={theme.colors.macros.carbs.text} />
            <View
              style={{
                width: 1,
                height: 20,
                backgroundColor: theme.colors.border.light,
                alignSelf: 'center',
              }}
            />
            <Macro label="FAT" value={macros.fat} color={theme.colors.macros.fat.text} />
          </View>

          <Pressable
            onPress={onTrackPress}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: theme.colors.accent.primary10,
              paddingHorizontal: theme.spacing.padding.md,
              paddingVertical: 6,
              borderRadius: theme.borderRadius.full,
              gap: 4,
              opacity: pressed ? 0.7 : 1,
            })}>
            <Plus size={14} color={theme.colors.accent.primary} strokeWidth={3} />
            <Text
              style={{
                fontSize: theme.typography.fontSize.xs,
                fontWeight: theme.typography.fontWeight.bold,
                color: theme.colors.accent.primary,
              }}>
              Track
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
