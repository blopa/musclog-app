import { LinearGradient } from 'expo-linear-gradient';
import { CheckCircle, Sparkles } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, Text, TextInput as RNTextInput, View } from 'react-native';

import { BottomPopUp } from '@/components/BottomPopUp';
import { useTheme } from '@/hooks/useTheme';

type AINutritionTrackingContextModalProps = {
  visible: boolean;
  onClose: () => void;
  onApply?: (context: { description: string; tags: string[] }) => void;
  title?: string;
  describeLabel?: string;
  placeholder?: string;
  applyLabel?: string;
};

export function AINutritionTrackingContextModal({
  visible,
  onClose,
  onApply,
  title,
  describeLabel,
  placeholder,
  applyLabel,
}: AINutritionTrackingContextModalProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [mealDescription, setMealDescription] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const quickTags = [
    t('food.aiNutritionContext.quickTagHighProtein'),
    t('food.aiNutritionContext.quickTagLowCarb'),
    t('food.aiNutritionContext.quickTagLargeServing'),
    t('food.aiNutritionContext.quickTagEatingOut'),
    t('food.aiNutritionContext.quickTagVegan'),
  ];

  const handleToggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleApply = () => {
    if (onApply) {
      onApply({ description: mealDescription, tags: selectedTags });
    }
    // Reset state
    setMealDescription('');
    setSelectedTags([]);
    onClose();
  };

  const handleCancel = () => {
    // Reset state
    setMealDescription('');
    setSelectedTags([]);
    onClose();
  };

  return (
    <BottomPopUp
      visible={visible}
      onClose={handleCancel}
      title={title ?? t('food.aiNutritionContext.title')}
      maxHeight="85%"
      headerIcon={
        <View
          className="h-10 w-10 items-center justify-center rounded-xl"
          style={{
            backgroundColor: 'transparent',
          }}
        >
          <LinearGradient
            colors={theme.colors.gradients.cta}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              borderRadius: 12,
              overflow: 'hidden',
            }}
          />
          <Sparkles size={theme.iconSize.xl} color={theme.colors.text.white} />
        </View>
      }
    >
      <View className="pt-2">
        {/* Describe Your Meal Section */}
        <View className="mb-6">
          <Text className="text-text-secondary mb-2 ml-1 text-xs font-bold tracking-widest uppercase">
            {describeLabel ?? t('food.aiNutritionContext.describeYourMeal')}
          </Text>
          <View
            className="w-full rounded-lg border p-4"
            style={{
              backgroundColor: theme.colors.background.darkGraySolid,
              borderColor: theme.colors.background.white10,
            }}
            collapsable={false}
          >
            <RNTextInput
              className="text-text-primary w-full bg-transparent"
              style={{
                minHeight: theme.size['100'],
                fontSize: theme.typography.fontSize.sm,
                color: theme.colors.text.primary,
                textAlignVertical: 'top',
              }}
              placeholder={placeholder ?? t('food.aiNutritionContext.placeholder')}
              placeholderTextColor={theme.colors.background.white20}
              value={mealDescription}
              onChangeText={setMealDescription}
              multiline
              numberOfLines={4}
            />
          </View>
        </View>

        {/* Quick Tags Section */}
        <View className="mb-8">
          <Text className="text-text-secondary mb-3 ml-1 text-xs font-bold tracking-widest uppercase">
            {t('food.aiNutritionContext.quickTags')}
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {quickTags.map((tag) => {
              const isSelected = selectedTags.includes(tag);
              return (
                <Pressable
                  key={tag}
                  onPress={() => handleToggleTag(tag)}
                  className={`flex-row items-center rounded-full px-4 py-2.5 ${
                    isSelected ? 'bg-accent-primary' : 'border-border-light bg-bg-filterTab border'
                  }`}
                  {...(Platform.OS === 'android' && { unstable_pressDelay: 130 })}
                >
                  <Text
                    className={`text-sm font-medium ${isSelected ? 'font-semibold' : ''}`}
                    style={{
                      color: isSelected ? theme.colors.text.black : theme.colors.text.gray300,
                    }}
                  >
                    {tag}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Action Buttons */}
        <View className="flex-row gap-3">
          <Pressable
            onPress={handleCancel}
            className="flex-1 rounded-xl border px-6 py-4"
            {...(Platform.OS === 'android' && { unstable_pressDelay: 130 })}
            style={{
              backgroundColor: theme.colors.background.darkGreenSolidAlt,
              borderColor: theme.colors.background.white5,
            }}
          >
            <Text className="text-text-primary text-center text-sm font-bold">
              {t('food.aiNutritionContext.cancel')}
            </Text>
          </Pressable>
          <Pressable
            onPress={handleApply}
            className="flex-[2] rounded-xl px-6 py-4 active:scale-[0.98]"
            {...(Platform.OS === 'android' && { unstable_pressDelay: 130 })}
            style={{
              overflow: 'hidden',
            }}
          >
            <LinearGradient
              colors={theme.colors.gradients.cta}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
              }}
            />
            <View className="flex-row items-center justify-center gap-2">
              <Text className="text-sm font-bold text-white">
                {applyLabel ?? t('food.aiNutritionContext.applyContext')}
              </Text>
              <CheckCircle size={theme.iconSize.md} color={theme.colors.text.white} />
            </View>
          </Pressable>
        </View>
      </View>
    </BottomPopUp>
  );
}
