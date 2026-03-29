import { useRouter } from 'expo-router';
import { AlertTriangle, CheckCircle, ChevronLeft } from 'lucide-react-native';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSnackbar } from '../../context/SnackbarContext';
import { useTheme } from '../../hooks/useTheme';

export default function SnackbarTestScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { showSnackbar } = useSnackbar();

  const triggerSuccessSnackbar = () => {
    showSnackbar('success', 'Workout saved successfully!');
  };

  const triggerErrorSnackbar = () => {
    showSnackbar('error', 'Failed to save workout', {
      subtitle: 'Please check your connection and try again.',
    });
  };

  return (
    <SafeAreaView className="flex-1 bg-bg-primary" edges={['top']}>
      {/* Header */}
      <View
        className="border-b bg-bg-primary"
        style={{ borderColor: theme.colors.background.buttonCard }}
      >
        <View className="relative flex-row items-center justify-center px-4 py-4">
          <Pressable
            onPress={() => router.back()}
            className="absolute left-0 -ml-2 rounded-full p-2"
            style={{ backgroundColor: theme.colors.overlay.white5 }}
          >
            <ChevronLeft size={theme.iconSize.xl} color={theme.colors.text.primary} />
          </Pressable>
          <Text className="text-xl font-bold text-text-primary">Snackbar Examples</Text>
        </View>
      </View>

      {/* Content */}
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="space-y-8 px-4 py-8">
          {/* Feedback States Section */}
          <View className="gap-6">
            <Text className="text-4xl font-bold text-text-primary">Feedback States</Text>

            <Text
              className="text-lg leading-relaxed"
              style={{ color: theme.colors.text.secondary }}
            >
              Tap the buttons below to trigger the success and error feedback notifications. These
              non-intrusive messages appear at the bottom of the screen.
            </Text>

            {/* Buttons */}
            <View className="gap-4 pt-4">
              {/* Success Button */}
              <Pressable
                onPress={triggerSuccessSnackbar}
                className="flex-row items-center gap-4 rounded-2xl p-6"
                style={{
                  backgroundColor: theme.colors.background.buttonCard,
                }}
              >
                <View
                  className="h-12 w-12 flex-shrink-0 items-center justify-center rounded-full"
                  style={{
                    backgroundColor: theme.colors.status.success20,
                  }}
                >
                  <CheckCircle size={theme.iconSize.xl} color={theme.colors.status.success} />
                </View>
                <Text className="flex-1 text-left text-xl font-semibold text-text-primary">
                  Simulate Successful Save
                </Text>
                <ChevronLeft
                  size={theme.iconSize.xl}
                  color={theme.colors.text.tertiary}
                  style={{ transform: [{ rotate: '180deg' }] }}
                />
              </Pressable>

              {/* Error Button */}
              <Pressable
                onPress={triggerErrorSnackbar}
                className="flex-row items-center gap-4 rounded-2xl p-6"
                style={{
                  backgroundColor: theme.colors.background.buttonCard,
                }}
              >
                <View
                  className="h-12 w-12 flex-shrink-0 items-center justify-center rounded-full"
                  style={{
                    backgroundColor: theme.colors.status.error20,
                  }}
                >
                  <AlertTriangle size={theme.iconSize.xl} color={theme.colors.status.error} />
                </View>
                <Text className="flex-1 text-left text-xl font-semibold text-text-primary">
                  Simulate Sync Error
                </Text>
                <ChevronLeft
                  size={theme.iconSize.xl}
                  color={theme.colors.text.tertiary}
                  style={{ transform: [{ rotate: '180deg' }] }}
                />
              </Pressable>
            </View>
          </View>

          {/* Live Preview Section */}
          <View className="gap-4 pt-8">
            <View className="flex-row items-center gap-4">
              <View
                className="h-px flex-1"
                style={{ backgroundColor: theme.colors.border.dashed }}
              />
              <Text
                className="text-sm font-semibold tracking-wider"
                style={{ color: theme.colors.text.tertiary }}
              >
                LIVE PREVIEW
              </Text>
              <View
                className="h-px flex-1"
                style={{ backgroundColor: theme.colors.border.dashed }}
              />
            </View>

            <Text className="text-center" style={{ color: theme.colors.text.secondary }}>
              Active snackbars are displayed below.{'\n'}Swipe to dismiss.
            </Text>
          </View>
        </View>

        {/* Bottom spacing for snackbars */}
        <View style={{ height: theme.size['64'] }} />
      </ScrollView>
    </SafeAreaView>
  );
}
