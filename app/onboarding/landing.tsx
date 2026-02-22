import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { ArrowRight, Dumbbell } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Dimensions, Linking, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MasterLayout } from '../../components/MasterLayout';
import { Button } from '../../components/theme/Button';
import { seedDevData } from '../../database/seeders/dev';
import { seedProductionData } from '../../database/seeders/prod';
import { verifyDatabaseTables } from '../../database/verify';
import { theme } from '../../theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function LandingScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  // TODO: would be great to show different copies when `isInitializing` is true
  // - if we're only seeding the static data, show the current copy
  // - if the user has the old database, show a message saying that the old data is being migrated
  // - even better if we say exactly which table is being migrated in the copy while we show the progress indicator
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        if (__DEV__) {
          const result = await verifyDatabaseTables();
          if (!result.success) {
            console.error('⚠️  DATABASE NOT INITIALIZED PROPERLY');
            console.error('Missing tables:', result.missingTables);
            console.error('Solution: Uninstall the app completely and reinstall it.');
          }
        }

        await seedProductionData();

        if (__DEV__) {
          await seedDevData();
        }
      } catch (error) {
        console.error('Error initializing app:', error);
      } finally {
        setIsInitializing(false);
      }
    };

    initializeApp();
  }, []);

  return (
    <MasterLayout showNavigationMenu={false}>
      {/* Main Background Gradient */}
      <LinearGradient
        colors={theme.colors.gradients.landingBackground}
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
                }}
              >
                <Dumbbell size={theme.iconSize['3xl']} color={theme.colors.text.white} />
              </LinearGradient>
            </View>

            {/* Typography Section */}
            <View className="mt-4 items-center gap-2">
              {/* App Name */}
              <Text
                className="font-black leading-none tracking-tight"
                style={{
                  color: theme.colors.text.white,
                  fontSize: theme.typography.fontSize['4xl'],
                  letterSpacing: theme.typography.letterSpacing.tight,
                  lineHeight: theme.typography.fontSize['4xl'] * 1.1,
                }}
              >
                {t('onboarding.landing.appName')}
              </Text>

              {/* Tagline */}
              <Text
                className="font-medium tracking-wide"
                style={{
                  color: theme.colors.text.secondary,
                  fontSize: theme.typography.fontSize.lg,
                  letterSpacing: theme.typography.letterSpacing.wide,
                }}
              >
                {t('onboarding.landing.tagline')}
              </Text>

              {/* Description */}
              <Text
                className="mt-2 text-center"
                style={{
                  color: theme.colors.text.gray500,
                  fontSize: theme.typography.fontSize.sm,
                  maxWidth: theme.maxWidth.md,
                  lineHeight: theme.typography.fontSize.sm * 1.5,
                }}
              >
                {t('onboarding.landing.description')}
              </Text>
            </View>
          </View>

          {/* Loading state or button block */}
          <View className="gap-3 pb-8 pt-4">
            {isInitializing ? (
              <View className="items-center gap-4">
                <ActivityIndicator size="large" color={theme.colors.text.white} />
                <Text
                  className="text-center"
                  style={{
                    color: theme.colors.text.white,
                    fontSize: theme.typography.fontSize.lg,
                  }}
                >
                  {t('onboarding.landing.preparingApp') || 'Preparing the app for you...'}
                </Text>
              </View>
            ) : (
              <>
                {/* Primary Button */}
                <Button
                  label={t('onboarding.landing.getStarted')}
                  onPress={() => {
                    // Navigate to home or onboarding
                    router.push('/onboarding/onboarding');
                  }}
                  icon={ArrowRight}
                  iconPosition="right"
                  variant="gradientCta"
                  size="lg"
                  width="full"
                />

                {/* Terms / Footer Text */}
                <View className="mt-2">
                  <Text
                    className="text-center"
                    style={{
                      color: theme.colors.text.gray500,
                      fontSize: theme.typography.fontSize.xs,
                    }}
                  >
                    {t('onboarding.landing.termsAndPrivacy')}
                  </Text>

                  <Text
                    accessibilityRole="link"
                    onPress={async () => {
                      const url = 'https://werules.com/musclog/terms';
                      try {
                        await Linking.openURL(url);
                      } catch (e) {
                        console.error('Failed to open privacy link', e);
                      }
                    }}
                    className="mt-1 text-center"
                    style={{
                      color: theme.colors.accent.primary,
                      fontSize: theme.typography.fontSize.xs,
                      textDecorationLine: 'underline',
                    }}
                  >
                    {t('onboarding.landing.connectGoogle')}
                  </Text>
                </View>
              </>
            )}
          </View>
        </View>
      </SafeAreaView>
    </MasterLayout>
  );
}
