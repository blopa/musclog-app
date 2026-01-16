import { useState } from 'react';
import { View, Text, Pressable, TextInput as RNTextInput } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Sparkles, CheckCircle } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { theme } from '../theme';
import { BottomPopUp } from './BottomPopUp';

type AINutritionTrackingContextModalProps = {
  visible: boolean;
  onClose: () => void;
  onApply?: (context: { description: string; tags: string[] }) => void;
};

export function AINutritionTrackingContextModal({
  visible,
  onClose,
  onApply,
}: AINutritionTrackingContextModalProps) {
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
      title={t('food.aiNutritionContext.title')}
      maxHeight="85%"
      headerIcon={
        <View
          className="h-10 w-10 items-center justify-center rounded-xl"
          style={{
            backgroundColor: 'transparent',
          }}>
          <LinearGradient
            colors={theme.colors.gradients.cta}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            className="absolute inset-0 rounded-xl"
          />
          <Sparkles size={theme.iconSize.xl} color={theme.colors.text.white} />
        </View>
      }>
      <View
        className="pt-2"
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderTerminationRequest={() => false}>
        {/* Describe Your Meal Section */}
        <View className="mb-6">
          <Text className="mb-2 ml-1 text-xs font-bold uppercase tracking-widest text-text-secondary">
            {t('food.aiNutritionContext.describeYourMeal')}
          </Text>
          <View
            className="w-full rounded-lg border p-4"
            style={{
              backgroundColor: theme.colors.background.darkGraySolid,
              borderColor: theme.colors.background.white10,
            }}
            collapsable={false}>
            <RNTextInput
              className="min-h-[100px] w-full bg-transparent text-[15px] text-text-primary"
              style={{
                color: theme.colors.text.primary,
                textAlignVertical: 'top',
              }}
              placeholder={t('food.aiNutritionContext.placeholder')}
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
          <Text className="mb-3 ml-1 text-xs font-bold uppercase tracking-widest text-text-secondary">
            {t('food.aiNutritionContext.quickTags')}
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {quickTags.map((tag) => {
              const isSelected = selectedTags.includes(tag);
              return (
                <Pressable
                  key={tag}
                  onPress={() => handleToggleTag(tag)}
                  className="rounded-full border px-4 py-2"
                  style={{
                    backgroundColor: isSelected
                      ? theme.colors.background.white10
                      : theme.colors.background.darkGreenSolidAlt,
                    borderColor: theme.colors.background.white5,
                  }}>
                  <Text className="text-sm font-medium text-text-primary">{tag}</Text>
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
            style={{
              backgroundColor: theme.colors.background.darkGreenSolidAlt,
              borderColor: theme.colors.background.white5,
            }}>
            <Text className="text-center text-sm font-bold text-text-primary">
              {t('food.aiNutritionContext.cancel')}
            </Text>
          </Pressable>
          <Pressable
            onPress={handleApply}
            className="flex-[2] rounded-xl px-6 py-4 active:scale-[0.98]"
            style={{
              overflow: 'hidden',
            }}>
            <LinearGradient
              colors={theme.colors.gradients.cta}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              className="absolute inset-0"
            />
            <View className="flex-row items-center justify-center gap-2">
              <Text className="text-sm font-bold text-white">
                {t('food.aiNutritionContext.applyContext')}
              </Text>
              <CheckCircle size={theme.iconSize.md} color={theme.colors.text.white} />
            </View>
          </Pressable>
        </View>
      </View>
    </BottomPopUp>
  );
}
