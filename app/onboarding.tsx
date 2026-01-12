import { View, Text, Pressable, ImageBackground, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Check, ArrowLeft, ArrowRight } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { theme } from '../theme';
import { Button } from '../components/theme/Button';
import { GradientText } from '../components/GradientText';
import { PageIndicators } from '../components/theme/PageIndicators';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PHONE_MOCKUP_IMAGE_URL =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuCvPgrOeONs-O17Ju_HUwmNT_-Sv1SdtaoahIETdH1VPVF1sOdhGUVQPfGCSQc40hRRzo9Pk8XBan5A2gVZ7YsZusBCI8VD_Aw0SdNRgiwKnFsCdF55c3RaEo-hfwVzYVvQAcOFGNF_8EImiOV6GZmWmjqekRUfuW_a5LbmALIn-K55kdyBu4zo7vTYlHSHWQg4CElJfLX2KtzBWBN-Pqi_XccbCd6syoCCx_4xrZegtQNP1Re7Vt15261Ddj7edCPGTd3GNZO7MmHY';

export default function OnboardingScreen() {
  const router = useRouter();

  return (
    <View className="flex-1 bg-bg-primary">
      {/* Top Bar */}
      <SafeAreaView edges={['top']} className="z-20">
        <View className="flex-row items-center justify-between p-6">
          <View style={{ width: theme.size['12'] }} />
          <Pressable
            className="flex-row items-center justify-center rounded-full px-4 py-2 active:opacity-70"
            onPress={() => {
              // Navigate to home or skip onboarding
              router.push('/');
            }}>
            <Text
              className="text-sm font-bold leading-normal tracking-wide"
              style={{ color: theme.colors.text.gray500 }}>
              Skip
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>

      {/* Main Content Area */}
      <View className="relative w-full max-w-md flex-1 flex-col items-center justify-center self-center px-6 pb-10">
        {/* Illustration Section */}
        <View
          className="relative mb-6 flex w-full items-center justify-center"
          style={{
            aspectRatio: 4 / 5,
            maxHeight: Dimensions.get('window').height * 0.45,
          }}>
          {/* Ambient Background Glow */}
          <View className="absolute inset-0 rounded-full opacity-60">
            <LinearGradient
              colors={[
                'rgba(99, 102, 241, 0.2)', // indigo-600/20
                'rgba(41, 224, 142, 0.2)', // primary/20
                'rgba(16, 185, 129, 0.2)', // emerald-400/20
              ]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                flex: 1,
                borderRadius: 9999,
              }}
            />
          </View>

          {/* Main Image Card */}
          <View
            className="relative z-10 h-full w-full overflow-hidden rounded-3xl border border-white/10"
            style={theme.shadows.lg}>
            <ImageBackground
              source={{ uri: PHONE_MOCKUP_IMAGE_URL }}
              className="h-full w-full"
              resizeMode="cover">
              {/* Gradient Overlay */}
              <LinearGradient
                colors={[
                  'rgba(10, 31, 26, 0.9)', // background-dark/90
                  'transparent',
                  'transparent',
                ]}
                start={{ x: 0, y: 1 }}
                end={{ x: 0, y: 0 }}
                style={{ flex: 1 }}
              />

              {/* Floating Badge Overlay */}
              <View className="absolute bottom-6 left-6 right-6 flex-row items-center gap-4 rounded-xl border border-white/10 p-4">
                <LinearGradient
                  colors={['rgba(255, 255, 255, 0.1)', 'rgba(255, 255, 255, 0.05)']}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    borderRadius: theme.borderRadius.xl,
                  }}
                />
                <View className="relative z-10 h-10 w-10 items-center justify-center rounded-full">
                  <View
                    className="absolute inset-0 rounded-full"
                    style={{ backgroundColor: theme.colors.status.emeraldLight }}
                  />
                  <Check size={24} color={theme.colors.text.black} strokeWidth={3} />
                </View>
                <View className="relative z-10 flex-1 flex-col">
                  <Text className="text-sm font-bold text-white">Workout Complete</Text>
                  <Text className="text-xs" style={{ color: theme.colors.overlay.white70 }}>
                    3 Personal Records set!
                  </Text>
                </View>
              </View>
            </ImageBackground>
          </View>
        </View>

        {/* Typography Block */}
        <View className="z-20 w-full gap-4 text-center">
          <GradientText
            colors={[
              theme.colors.text.white,
              theme.colors.status.emeraldLight,
              theme.colors.status.indigoLight,
            ]}
            style={{
              fontSize: theme.typography.fontSize['3xl'],
              fontWeight: theme.typography.fontWeight.extrabold,
              lineHeight: theme.typography.fontSize['3xl'] * 1.25,
              letterSpacing: -0.5,
            }}>
            Effortless Tracking
          </GradientText>
          <Text
            className="px-2 text-base font-normal leading-relaxed"
            style={{ color: theme.colors.text.gray400 }}>
            Ditch the notebook. Log your sets, reps, and weights in seconds and visualize your
            strength gains over time.
          </Text>
        </View>
      </View>

      {/* Footer / Navigation */}
      <View className="z-20 w-full max-w-md self-center">
        <SafeAreaView edges={['bottom']}>
          <View className="flex-col items-center gap-8 px-6 pb-8 pt-4">
            {/* Page Indicators */}
            <PageIndicators totalPages={3} currentPage={0} />

            {/* Navigation Buttons */}
            <View className="w-full flex-row items-center justify-between">
              {/* Back Button */}
              <Pressable
                className="h-14 w-14 items-center justify-center rounded-full border active:opacity-70"
                style={{
                  borderColor: theme.colors.background.white10,
                }}
                onPress={() => {
                  // Navigate back
                  router.back();
                }}>
                <ArrowLeft
                  size={theme.iconSize.lg}
                  color={theme.colors.text.gray500}
                  strokeWidth={theme.strokeWidth.normal}
                />
              </Pressable>

              {/* Next Button */}
              <Pressable
                className="h-14 flex-row items-center gap-2 rounded-full px-8 active:scale-95"
                style={{
                  backgroundColor: theme.colors.status.emeraldLight,
                  ...theme.shadows.lg,
                  shadowColor: theme.colors.status.emeraldLight,
                  shadowOpacity: 0.2,
                }}
                onPress={() => {
                  // Navigate to next onboarding screen or home
                  router.push('/');
                }}>
                <Text
                  className="text-lg font-bold"
                  style={{
                    color: '#11211a', // background-dark from HTML
                  }}>
                  Next
                </Text>
                <ArrowRight
                  size={theme.iconSize.lg}
                  color="#11211a"
                  strokeWidth={theme.strokeWidth.normal}
                />
              </Pressable>
            </View>
          </View>
        </SafeAreaView>
      </View>
    </View>
  );
}
