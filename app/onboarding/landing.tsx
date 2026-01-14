import { View, Text, Pressable, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Dumbbell, ArrowRight } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { theme } from '../../theme';
import { Button } from '../../components/theme/Button';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function LandingScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  return (
    <View className="flex-1">
      {/* Main Background Gradient */}
      <LinearGradient
        colors={['#11211a', '#0a1f1a', '#0f251f']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        className="absolute inset-0"
      />

      {/* Ambient Background Effects */}
      <View className="absolute inset-0 overflow-hidden" pointerEvents="none">
        {/* Top left blob */}
        <View
          className="absolute rounded-full opacity-60"
          style={{
            top: -SCREEN_HEIGHT * 0.2,
            left: -SCREEN_WIDTH * 0.1,
            width: SCREEN_WIDTH * 1.2,
            height: SCREEN_HEIGHT * 0.6,
            backgroundColor: theme.colors.status.indigo10, // indigo-600/20 equivalent
          }}
        />
        {/* Bottom right blob */}
        <View
          className="absolute rounded-full opacity-60"
          style={{
            bottom: -SCREEN_HEIGHT * 0.1,
            right: -SCREEN_WIDTH * 0.2,
            width: SCREEN_WIDTH * 0.8,
            height: SCREEN_HEIGHT * 0.5,
            backgroundColor: theme.colors.status.emerald20, // primary/10 equivalent
          }}
        />
      </View>

      {/* Main Content */}
      <SafeAreaView className="flex-1" edges={['top', 'bottom']}>
        <View className="w-full max-w-md flex-1 justify-between self-center px-6">
          {/* Top Spacer */}
          <View style={{ height: theme.size['12'] }} />

          {/* Hero Section */}
          <View className="flex-1 items-center justify-center gap-8 py-6">
            {/* Logo Icon with Gradient Background */}
            <View className="mb-4">
              <LinearGradient
                colors={theme.colors.gradients.cta}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                className="items-center justify-center rounded-xl"
                style={{
                  width: theme.size['12'],
                  height: theme.size['12'],
                  ...theme.shadows.lg,
                }}>
                <Dumbbell size={theme.iconSize['3xl']} color={theme.colors.text.white} />
              </LinearGradient>
            </View>

            {/* Typography Section */}
            <View className="mt-4 items-center gap-2">
              {/* App Name */}
              <Text
                className="font-black leading-none tracking-tight text-white"
                style={{
                  fontSize: theme.typography.fontSize['4xl'],
                  letterSpacing: -0.5,
                  lineHeight: theme.typography.fontSize['4xl'] * 1.1,
                }}>
                Musclog
              </Text>

              {/* Tagline */}
              <Text
                className="font-medium tracking-wide text-gray-400"
                style={{
                  fontSize: theme.typography.fontSize.lg,
                  letterSpacing: 0.5,
                }}>
                Lift, Log, Repeat
              </Text>

              {/* Description */}
              <Text
                className="mt-2 text-center text-gray-500"
                style={{
                  fontSize: theme.typography.fontSize.sm,
                  maxWidth: 280,
                  lineHeight: theme.typography.fontSize.sm * 1.5,
                }}>
                Track your progress with data-driven insights and crush your fitness goals.
              </Text>
            </View>
          </View>

          {/* Action Section */}
          <View className="gap-3 pb-8 pt-4">
            {/* Primary Button */}
            <Button
              label={t('onboarding.landing.getStarted')}
              onPress={() => {
                // Navigate to home or onboarding
                router.push('/');
              }}
              icon={ArrowRight}
              iconPosition="right"
              variant="gradientCta"
              size="lg"
              width="full"
            />

            {/* Secondary Action */}
            <Pressable
              className="h-10 items-center justify-center"
              onPress={() => {
                // Navigate to login
                console.log('Navigate to login');
              }}>
              <Text className="text-sm font-medium text-gray-400">
                {t('onboarding.landing.alreadyHaveAccount')}{' '}
                <Text style={{ color: theme.colors.status.emeraldLight }}>
                  {t('onboarding.landing.logIn')}
                </Text>
              </Text>
            </Pressable>

            {/* Terms / Footer Text */}
            <Text className="mt-2 text-center text-gray-500" style={{ fontSize: 10 }}>
              {t('onboarding.landing.termsAndPrivacy')}
            </Text>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}
