import { CheckCircle, Sparkles } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, Text, View } from 'react-native';

import { BottomPopUp } from '@/components/BottomPopUp';
import { MealContextFields } from '@/components/camera/MealContextFields';
import { useTheme } from '@/hooks/useTheme';

type AINutritionTrackingContextModalProps = {
  visible: boolean;
  onClose: () => void;
  onApply?: (context: { description: string; tags: string[] }) => void;
  title?: string;
  describeLabel?: string;
  placeholder?: string;
  applyLabel?: string;
  initialDescription?: string;
  initialTags?: string[];
  onDraftChange?: (context: { description: string; tags: string[] }) => void;
};

export function AINutritionTrackingContextModal({
  visible,
  onClose,
  onApply,
  title,
  describeLabel,
  placeholder,
  applyLabel,
  initialDescription = '',
  initialTags = [],
  onDraftChange,
}: AINutritionTrackingContextModalProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [mealDescription, setMealDescription] = useState(initialDescription);
  const [selectedTags, setSelectedTags] = useState<string[]>(initialTags);

  const handleToggleTag = (tag: string) => {
    const newTags = selectedTags.includes(tag)
      ? selectedTags.filter((t) => t !== tag)
      : [...selectedTags, tag];
    setSelectedTags(newTags);
    onDraftChange?.({ description: mealDescription, tags: newTags });
  };

  const handleApply = () => {
    onApply?.({ description: mealDescription, tags: selectedTags });
    onClose();
  };

  const handleCancel = () => {
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
          className="h-10 w-10 items-center justify-center rounded-control"
          style={{
            backgroundColor: 'transparent',
          }}
        >
          <View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              borderRadius: 12,
              backgroundColor: theme.colors.accent.primary,
            }}
          />
          <Sparkles size={theme.iconSize.xl} color={theme.colors.text.onAccent} />
        </View>
      }
    >
      <View className="pt-2" style={{ gap: theme.spacing.gap.xl }}>
        <MealContextFields
          description={mealDescription}
          onDescriptionChange={(text) => {
            setMealDescription(text);
            onDraftChange?.({ description: text, tags: selectedTags });
          }}
          descriptionLabel={describeLabel ?? t('food.aiNutritionContext.describeYourMeal')}
          descriptionPlaceholder={placeholder ?? t('food.aiNutritionContext.placeholder')}
          numberOfLines={4}
          tags={selectedTags}
          onToggleTag={handleToggleTag}
          tagsLabel={t('food.aiNutritionContext.quickTags')}
        />

        {/* Action Buttons */}
        <View className="flex-row flex-wrap gap-3">
          <Pressable
            onPress={handleCancel}
            className="grow basis-[110px] rounded-control border px-4 py-4"
            {...(Platform.OS === 'android' && { unstable_pressDelay: 130 })}
            style={{
              backgroundColor: theme.colors.background.neutralWashStrong,
              borderColor: theme.colors.background.ink5,
            }}
          >
            <Text className="text-center text-sm font-semibold text-text-primary">
              {t('food.aiNutritionContext.cancel')}
            </Text>
          </Pressable>
          <Pressable
            onPress={handleApply}
            className="grow-[2] basis-[150px] rounded-control px-4 py-4 active:scale-[0.98]"
            {...(Platform.OS === 'android' && { unstable_pressDelay: 130 })}
            style={{ backgroundColor: theme.colors.accent.primary }}
          >
            <View className="flex-row items-center justify-center gap-2">
              <Text
                className="min-w-0 shrink text-center text-sm font-semibold"
                style={{ color: theme.colors.text.onAccent }}
              >
                {applyLabel ?? t('food.aiNutritionContext.applyContext')}
              </Text>
              <View className="shrink-0">
                <CheckCircle size={theme.iconSize.md} color={theme.colors.text.onAccent} />
              </View>
            </View>
          </Pressable>
        </View>
      </View>
    </BottomPopUp>
  );
}
