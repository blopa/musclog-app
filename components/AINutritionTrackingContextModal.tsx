import { useState } from 'react';
import { View, Text, Pressable, TextInput as RNTextInput } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Sparkles, CheckCircle } from 'lucide-react-native';
import { theme } from '../theme';
import { BottomPopUpMenu } from './BottomPopUpMenu';

type AINutritionTrackingContextModalProps = {
  visible: boolean;
  onClose: () => void;
  onApply?: (context: { description: string; tags: string[] }) => void;
};

const quickTags = ['High Protein', 'Low Carb', 'Large Serving', 'Eating Out', 'Vegan'];

export function AINutritionTrackingContextModal({
  visible,
  onClose,
  onApply,
}: AINutritionTrackingContextModalProps) {
  const [mealDescription, setMealDescription] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

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
    <BottomPopUpMenu
      visible={visible}
      onClose={handleCancel}
      title="Add Context for AI"
      maxHeight="85%"
      headerIcon={
        <View
          className="h-10 w-10 items-center justify-center rounded-xl"
          style={{
            backgroundColor: 'transparent',
          }}>
          <LinearGradient
            colors={['#6366f1', '#29e08e']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            className="absolute inset-0 rounded-xl"
          />
          <Sparkles size={24} color="#ffffff" />
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
            DESCRIBE YOUR MEAL
          </Text>
          <View
            className="w-full rounded-lg border p-4"
            style={{
              backgroundColor: 'rgba(17, 20, 19, 0.5)',
              borderColor: 'rgba(255, 255, 255, 0.1)',
            }}
            collapsable={false}>
            <RNTextInput
              className="min-h-[100px] w-full bg-transparent text-[15px] text-text-primary"
              style={{
                color: theme.colors.text.primary,
                textAlignVertical: 'top',
              }}
              placeholder="e.g. This is a homemade dish with olive oil, about 2 cups of pasta..."
              placeholderTextColor="rgba(255, 255, 255, 0.2)"
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
            QUICK TAGS
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
                      ? 'rgba(255, 255, 255, 0.1)'
                      : 'rgba(42, 50, 46, 1)',
                    borderColor: 'rgba(255, 255, 255, 0.05)',
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
              backgroundColor: 'rgba(42, 50, 46, 1)',
              borderColor: 'rgba(255, 255, 255, 0.05)',
            }}>
            <Text className="text-center text-sm font-bold text-text-primary">Cancel</Text>
          </Pressable>
          <Pressable
            onPress={handleApply}
            className="flex-[2] rounded-xl px-6 py-4 active:scale-[0.98]"
            style={{
              overflow: 'hidden',
            }}>
            <LinearGradient
              colors={['#6366f1', '#29e08e']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              className="absolute inset-0"
            />
            <View className="flex-row items-center justify-center gap-2">
              <Text className="text-sm font-bold text-white">Apply Context</Text>
              <CheckCircle size={18} color="#ffffff" />
            </View>
          </Pressable>
        </View>
      </View>
    </BottomPopUpMenu>
  );
}
