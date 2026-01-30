import { View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { UtensilsCrossed, Moon, RefreshCw, Scale, Heart } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { theme } from '../../theme';
import { GradientText } from '../../components/GradientText';
import { Button } from '../../components/theme/Button';
import { HealthCategoryCard } from '../../components/cards/HealthCategoryCard';
import { HealthConnectIllustration } from '../../components/HealthConnectIllustration';
import { MaybeLaterButton } from '../../components/MaybeLaterButton';

export default function HealthConnectScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  return (
    <View className="flex-1 bg-bg-primary">
      <SafeAreaView edges={['top']} className="flex-1">
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
            {/* Primary Button */}
            <Button
              label={t('onboarding.healthConnect.allowHealthAccess')}
              onPress={() => {
                // Handle health access permission
                console.log('Allow Health Access');
              }}
              icon={RefreshCw}
              iconPosition="left"
              variant="gradientCta"
              size="md"
              width="full"
              style={{
                ...theme.shadows.lg,
                shadowColor: theme.colors.status.emeraldLight,
                shadowOpacity: theme.colors.opacity.subtle,
              }}
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
      </SafeAreaView>
    </View>
  );
}
