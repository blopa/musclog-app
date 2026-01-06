import { View, Text, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { ChevronLeft, CheckCircle, AlertTriangle } from 'lucide-react-native';
import { theme } from '../../theme';
import { useSnackbar } from '../../components/SnackbarContext';

export default function SnackbarTestScreen() {
  const router = useRouter();
  const { showSnackbar } = useSnackbar();

  const triggerSuccessSnackbar = () => {
    showSnackbar('success', 'Workout saved successfully!', {
      action: 'VIEW',
    });
  };

  const triggerErrorSnackbar = () => {
    showSnackbar('error', 'Failed to save workout', {
      subtitle: 'Please check your connection and try again.',
      action: 'RETRY',
    });
  };

  return (
    <SafeAreaView className="flex-1 bg-bg-primary" edges={['top']}>
      <StatusBar style="light" />

      {/* Header */}
      <View className="border-b border-[#1a3530] bg-bg-primary">
        <View className="relative flex-row items-center justify-center px-4 py-4">
          <Pressable
            onPress={() => router.back()}
            className="absolute left-0 -ml-2 rounded-full p-2 active:bg-white/5">
            <ChevronLeft size={24} color={theme.colors.text.primary} />
          </Pressable>
          <Text className="text-xl font-bold text-white">Snackbar Examples</Text>
        </View>
      </View>

      {/* Content */}
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="space-y-8 px-4 py-8">
          {/* Feedback States Section */}
          <View className="gap-6">
            <Text className="text-4xl font-bold text-white">Feedback States</Text>

            <Text className="text-lg leading-relaxed text-gray-400">
              Tap the buttons below to trigger the success and error feedback notifications. These
              non-intrusive messages appear at the bottom of the screen.
            </Text>

            {/* Buttons */}
            <View className="gap-4 pt-4">
              {/* Success Button */}
              <Pressable
                onPress={triggerSuccessSnackbar}
                className="flex-row items-center gap-4 rounded-2xl bg-[#1a3530] p-6 active:bg-[#1f4039]">
                <View className="h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-[#22c55e]/20">
                  <CheckCircle size={24} color="#22c55e" />
                </View>
                <Text className="flex-1 text-left text-xl font-semibold text-white">
                  Simulate Successful Save
                </Text>
                <ChevronLeft
                  size={24}
                  color={theme.colors.text.tertiary}
                  style={{ transform: [{ rotate: '180deg' }] }}
                />
              </Pressable>

              {/* Error Button */}
              <Pressable
                onPress={triggerErrorSnackbar}
                className="flex-row items-center gap-4 rounded-2xl bg-[#1a3530] p-6 active:bg-[#1f4039]">
                <View className="h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-red-500/20">
                  <AlertTriangle size={24} color="#ef4444" />
                </View>
                <Text className="flex-1 text-left text-xl font-semibold text-white">
                  Simulate Sync Error
                </Text>
                <ChevronLeft
                  size={24}
                  color={theme.colors.text.tertiary}
                  style={{ transform: [{ rotate: '180deg' }] }}
                />
              </Pressable>
            </View>
          </View>

          {/* Live Preview Section */}
          <View className="gap-4 pt-8">
            <View className="flex-row items-center gap-4">
              <View className="h-px flex-1 bg-gray-700" />
              <Text className="text-sm font-semibold tracking-wider text-gray-500">
                LIVE PREVIEW
              </Text>
              <View className="h-px flex-1 bg-gray-700" />
            </View>

            <Text className="text-center text-gray-400">
              Active snackbars are displayed below.{'\n'}Swipe to dismiss.
            </Text>
          </View>
        </View>

        {/* Bottom spacing for snackbars */}
        <View className="h-64" />
      </ScrollView>
    </SafeAreaView>
  );
}
