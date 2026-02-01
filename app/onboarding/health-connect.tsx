import { useRouter } from 'expo-router';
import { Heart, Moon, RefreshCw, Scale, UtensilsCrossed } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HealthCategoryCard } from '../../components/cards/HealthCategoryCard';
import { GradientText } from '../../components/GradientText';
import { HealthConnectIllustration } from '../../components/HealthConnectIllustration';
import { MaybeLaterButton } from '../../components/MaybeLaterButton';
import { Button } from '../../components/theme/Button';
import { useHealthConnect } from '../../hooks/useHealthConnect';
import { useSyncTracking } from '../../hooks/useSyncTracking';
import { theme } from '../../theme';

/**
 * Health Connect Onboarding Screen
 * Allows users to connect and sync health data from Health Connect
 *
 * Implemented features:
 * - SDK availability check and initialization
 * - Permission request for all required data types:
 *   - Height (read)
 *   - Weight (read)
 *   - BodyFat (read)
 *   - Nutrition (read/write)
 *   - TotalCaloriesBurned (read/write)
 *   - ActiveCaloriesBurned (read/write)
 *   - BasalMetabolicRate (read)
 *   - ExerciseSession (read/write)
 *   - LeanBodyMass (read/write)
 * - Data sync orchestration with error handling
 * - Retry logic and offline support
 * - Data validation and deduplication
 */
export default function HealthConnectScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState(false);
  const [permissionsRequested, setPermissionsRequested] = useState(false);
  const insets = useSafeAreaInsets();

  // Health Connect initialization and permissions
  const {
    isAvailable,
    isInitializing,
    hasAnyPermission,
    permissionStats,
    requestPermissions,
    openSettings,
    error: hcError,
  } = useHealthConnect();

  // Sync tracking
  const { enableSync, isSyncing, error: syncError } = useSyncTracking();

  return (
    <View className="flex-1 bg-bg-primary" style={{ paddingTop: insets.top }}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Main Content */}
        <View className="flex-col items-center px-6 pt-4">
          {/* Illustration Section */}
          <HealthConnectIllustration />

          {/* Typography Block */}
          <View className="mb-8 w-full gap-4 text-center">
            <View className="flex-row flex-wrap items-center justify-center">
              <Text
                className="text-center font-bold tracking-tight text-white"
                style={{
                  fontSize: theme.typography.fontSize['3xl'],
                  lineHeight: theme.typography.fontSize['3xl'] * 1.1,
                }}
              >
                {t('onboarding.healthConnect.connectYour')}{' '}
              </Text>
              <GradientText
                colors={[theme.colors.status.indigoLight, theme.colors.status.emeraldLight]}
                style={{
                  fontSize: theme.typography.fontSize['3xl'],
                  fontWeight: theme.typography.fontWeight.bold,
                  lineHeight: theme.typography.fontSize['3xl'] * 1.1,
                }}
              >
                {t('onboarding.healthConnect.health')}
              </GradientText>
            </View>
            <Text
              className="text-center font-normal leading-relaxed"
              style={{
                fontSize: theme.typography.fontSize.base,
                color: theme.colors.text.secondary,
                maxWidth: '85%',
                alignSelf: 'center',
              }}
            >
              {t('onboarding.healthConnect.description')}
            </Text>
          </View>

          {/* Category Buttons Grid */}
          <View className="mb-8 w-full flex-row flex-wrap gap-3">
            {/* Nutrition */}
            <HealthCategoryCard
              icon={UtensilsCrossed}
              label={t('onboarding.healthConnect.categories.nutrition')}
              backgroundColor={theme.colors.status.indigo10}
              iconColor={theme.colors.status.indigoLight}
            />

            {/* Weight */}
            <HealthCategoryCard
              icon={Scale}
              label={t('onboarding.healthConnect.categories.weight')}
              backgroundColor={theme.colors.status.emerald20}
              iconColor={theme.colors.status.emeraldLight}
            />

            {/* Sleep */}
            <HealthCategoryCard
              icon={Moon}
              label={t('onboarding.healthConnect.categories.sleep')}
              backgroundColor={theme.colors.status.emerald10}
              iconColor={theme.colors.status.emerald}
            />

            {/* Vitals */}
            <HealthCategoryCard
              icon={Heart}
              label={t('onboarding.healthConnect.categories.vitals')}
              backgroundColor={theme.colors.status.purple10}
              iconColor={theme.colors.status.purple}
            />
          </View>
        </View>
        <View className="px-6 pb-6">
          {/* Error Display */}
          {hcError || syncError ? (
            <View
              className="mb-4 rounded-lg p-3"
              style={{ backgroundColor: theme.colors.status.error10 }}
            >
              <Text
                style={{
                  fontSize: theme.typography.fontSize.sm,
                  color: theme.colors.status.error,
                }}
              >
                {hcError?.getUserMessage() || syncError?.getUserMessage()}
              </Text>
            </View>
          ) : null}

          {/* Loading State */}
          {isInitializing || isSyncing || isProcessing ? (
            <View className="mb-4 flex-row items-center justify-center gap-2">
              <ActivityIndicator size="small" color={theme.colors.status.emeraldLight} />
              <Text
                style={{
                  fontSize: theme.typography.fontSize.sm,
                  color: theme.colors.text.secondary,
                }}
              >
                {isInitializing ? 'Initializing Health Connect...' : null}
                {isSyncing ? 'Syncing health data...' : null}
                {isProcessing ? 'Processing...' : null}
              </Text>
            </View>
          ) : null}

          {/* Primary Button */}
          <Button
            label={
              hasAnyPermission
                ? // TODO: move the "Connect 9/9" count to an external <Text> using t for translations
                // and make the button say "Continue"
                  `Connected (${permissionStats?.granted || 0}/${permissionStats?.total || 0})`
                : permissionsRequested
                ? t('onboarding.healthConnect.continue') || 'Continue'
                : t('onboarding.healthConnect.allowHealthAccess')
            }
            onPress={async () => {
              setIsProcessing(true);
              try {
                if (!isAvailable) {
                  // Not available, show settings to install
                  await openSettings();
                  return;
                }

                if (hasAnyPermission) {
                  // Already has at least one permission, navigate to next screen
                  router.push('/onboarding/connect-with-google');
                  return;
                }

                // Request permissions
                setPermissionsRequested(true);
                const granted = await requestPermissions();

                // Enable sync only if all required permissions were granted
                if (granted) {
                  await enableSync();
                }

                // Navigate to next screen regardless of granted permissions
                router.push('/onboarding/connect-with-google');
              } catch (error) {
                console.error('Error setting up Health Connect:', error);
              } finally {
                setIsProcessing(false);
              }
            }}
            icon={hasAnyPermission ? undefined : RefreshCw}
            iconPosition="left"
            variant="gradientCta"
            size="md"
            width="full"
            disabled={isInitializing || isSyncing || isProcessing}
          />
          <MaybeLaterButton
            onPress={() => {
              // Navigate away or skip
              router.push('/onboarding/connect-with-google');
            }}
            text={t('onboarding.healthConnect.maybeLater')}
          />

          {/* Privacy Statement */}
          <Text
            className="mt-4 text-center leading-relaxed"
            style={{
              fontSize: theme.typography.fontSize.xs,
              color: theme.colors.text.gray500,
            }}
          >
            {t('onboarding.healthConnect.privacyStatement')}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
