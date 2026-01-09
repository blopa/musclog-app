import React from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import { theme } from '../../theme';
import { StandardInputs } from './components/StandardInputs';
import { NumericalSteppers } from './components/NumericalSteppers';
import { SpecializedNumeric } from './components/SpecializedNumeric';
import { SelectionControls } from './components/SelectionControls';
import { InteractiveSliders } from './components/InteractiveSliders';
import { IconsAndPickers } from './components/IconsAndPickers';

export default function InputsTestScreen() {
  return (
    <SafeAreaView className="flex-1 bg-bg-primary" edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center justify-between bg-bg-primary/90 px-4 pb-2 pt-4">
        <Pressable className="h-12 w-12 shrink-0 items-center justify-center rounded-full active:bg-white/10">
          <ArrowLeft size={24} color={theme.colors.text.primary} />
        </Pressable>
        <Text className="flex-1 pr-12 text-center text-lg font-bold leading-tight tracking-tight text-text-primary">
          Design System
        </Text>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Title Section */}
        <View className="px-6 pb-2 pt-6">
          <Text className="text-[32px] font-extrabold leading-tight tracking-tight text-text-primary">
            Input Components
          </Text>
          <Text className="pt-3 text-base font-normal leading-relaxed text-text-secondary">
            Comprehensive data entry patterns for the Musclog app, following Material 3 and 12px
            rounded aesthetics.
          </Text>
        </View>

        <View className="h-8" />

        <StandardInputs />
        <NumericalSteppers />
        <SpecializedNumeric />
        <SelectionControls />
        <InteractiveSliders />
        <IconsAndPickers />

        <View className="h-8" />
      </ScrollView>
    </SafeAreaView>
  );
}
