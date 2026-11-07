import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LoggyPose, type LoggyPoseName } from '@/components/LoggyPose';
import { THEME_IDS } from '@/constants/settings';
import { ThemeScope } from '@/context/ThemeContext';
import { useTheme } from '@/hooks/useTheme';
import { THEMES } from '@/theme';

const POSES: LoggyPoseName[] = [
  'default',
  'wave',
  'celebrating',
  'coffee',
  'creatine',
  'drinking',
  'eating',
  'flex',
  'lifting',
  'magnify',
  'nutrition',
  'panic',
  'pointing',
  'reading',
  'running',
  'salad',
  'shrug',
  'thinking',
  'trophy',
  'writing',
];

/** The poses shown in every theme: the body, the stripes and props, and food that must stay green. */
const THEME_POSES: LoggyPoseName[] = ['wave', 'lifting', 'salad'];

/**
 * Every pose, still beside animated, to check the Reanimated layers against the drawn frame, and
 * then a few poses in every theme, to check his greens follow it and the lettuce does not.
 */
export default function LoggyTestScreen() {
  const theme = useTheme();

  return (
    <SafeAreaView className="flex-1 bg-bg-primary" edges={['top']}>
      <ScrollView className="flex-1">
        <View className="gap-6 p-6">
          <Text className="text-2xl font-bold text-text-primary">Loggy</Text>
          <View className="gap-2" testID="loggy-by-theme">
            <Text className="text-base font-semibold text-text-primary">By theme</Text>
            {THEME_IDS.map((themeId) => (
              <View
                key={themeId}
                className="rounded-card p-3"
                style={{ backgroundColor: THEMES[themeId].colors.background.primary }}
                testID={`loggy-theme-${themeId}`}
              >
                <ThemeScope themeId={themeId}>
                  <View className="flex-row items-end gap-4">
                    {THEME_POSES.map((pose) => (
                      <LoggyPose key={pose} pose={pose} height={110} animated={false} visible />
                    ))}
                  </View>
                </ThemeScope>
              </View>
            ))}
          </View>
          {POSES.map((pose) => (
            <View key={pose} className="gap-2" testID={`loggy-${pose}`}>
              <Text className="text-base font-semibold text-text-primary">{pose}</Text>
              <View className="flex-row items-end gap-6">
                <LoggyPose pose={pose} height={180} animated={false} visible />
                <LoggyPose pose={pose} height={180} animated visible />
              </View>
              <View style={{ height: 1, backgroundColor: theme.colors.border.light }} />
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
