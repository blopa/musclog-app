import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LoggyPose, type LoggyPoseName } from '@/components/LoggyPose';
import { useTheme } from '@/hooks/useTheme';

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
  'running',
  'thinking',
  'trophy',
  'writing',
];

/** Every pose, still beside animated, to check the Reanimated layers against the drawn frame. */
export default function LoggyTestScreen() {
  const theme = useTheme();

  return (
    <SafeAreaView className="flex-1 bg-bg-primary" edges={['top']}>
      <ScrollView className="flex-1">
        <View className="gap-6 p-6">
          <Text className="text-2xl font-bold text-text-primary">Loggy</Text>
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
