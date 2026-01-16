import { View, Text, Pressable, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Shield,
  Dumbbell,
  Scale,
  Apple,
  Heart,
  UtensilsCrossed,
  Moon,
  RefreshCw,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { theme } from '../../theme';
import { GradientText } from '../../components/GradientText';
import { Button } from '../../components/theme/Button';
import Svg, {
  Path,
  Circle,
  Defs,
  LinearGradient as SvgLinearGradient,
  Stop,
} from 'react-native-svg';
import { HealthCategoryCard } from '../../components/HealthCategoryCard';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ILLUSTRATION_SIZE = SCREEN_WIDTH * 0.4; // 40% of screen width

export default function HealthConnectScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  return (
    <View className="flex-1 bg-bg-primary">
      {/* Top Spacer */}
      <SafeAreaView edges={['top']}>
        <View style={{ height: theme.spacing.padding.sm }} />
      </SafeAreaView>

      {/* Main Content */}
      <View className="flex-1 flex-col items-center overflow-hidden px-6 pb-32">
        {/* Illustration Section */}
        <View
          className="relative mb-8 mt-4 w-full items-center justify-center"
          style={{
            aspectRatio: 1,
            minHeight: ILLUSTRATION_SIZE,
          }}>
          {/* Ambient Background Glows */}
          <View
            className="absolute rounded-full"
            style={{
              width: 256,
              height: 256,
              left: -48,
              top: -32,
              backgroundColor: theme.colors.status.indigo10,
              opacity: 0.6,
            }}
          />
          <View
            className="absolute rounded-full"
            style={{
              width: 256,
              height: 256,
              right: -48,
              bottom: -32,
              backgroundColor: theme.colors.status.emerald20,
              opacity: 0.6,
            }}
          />

          {/* Central Health Shield */}
          <View
            className="relative z-10 items-center justify-center"
            style={{
              width: ILLUSTRATION_SIZE,
              height: ILLUSTRATION_SIZE,
              ...theme.shadows.lg,
              shadowColor: theme.colors.status.indigo,
              shadowOpacity: 0.3,
            }}>
            <LinearGradient
              colors={[theme.colors.status.indigo, theme.colors.status.emeraldLight]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                width: '100%',
                height: '100%',
                borderRadius: theme.borderRadius['3xl'],
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: theme.colors.background.white20,
              }}>
              <Shield
                size={ILLUSTRATION_SIZE * 0.5}
                color={theme.colors.text.white}
                strokeWidth={2}
              />
            </LinearGradient>
          </View>

          {/* Floating Icons */}
          {/* Top Left - Dumbbell */}
          <View
            className="absolute items-center justify-center rounded-2xl border border-white/5"
            style={{
              width: 56,
              height: 56,
              top: '10%',
              left: '20%',
              backgroundColor: theme.colors.background.card,
              ...theme.shadows.lg,
            }}>
            <Dumbbell size={24} color={theme.colors.status.indigoLight} strokeWidth={2} />
          </View>

          {/* Top Right - Scale */}
          <View
            className="absolute items-center justify-center rounded-2xl border border-white/5"
            style={{
              width: 48,
              height: 48,
              top: '15%',
              right: '15%',
              backgroundColor: theme.colors.background.card,
              ...theme.shadows.lg,
            }}>
            <Scale size={20} color={theme.colors.status.emerald} strokeWidth={2} />
          </View>

          {/* Bottom Left - Apple/Nutrition */}
          <View
            className="absolute items-center justify-center rounded-2xl border border-white/5"
            style={{
              width: 48,
              height: 48,
              bottom: '20%',
              left: '10%',
              backgroundColor: theme.colors.background.card,
              ...theme.shadows.lg,
            }}>
            <Apple size={20} color={theme.colors.status.emeraldLight} strokeWidth={2} />
          </View>

          {/* Bottom Right - Heart */}
          <View
            className="absolute items-center justify-center rounded-2xl border border-white/5"
            style={{
              width: 64,
              height: 64,
              bottom: '10%',
              right: '20%',
              backgroundColor: theme.colors.background.card,
              ...theme.shadows.lg,
            }}>
            <Heart size={28} color={theme.colors.status.purple} strokeWidth={2} />
          </View>

          {/* Dashed Lines SVG */}
          <Svg
            className="absolute inset-0 h-full w-full"
            style={{ opacity: 0.2 }}
            viewBox="0 0 400 400"
            preserveAspectRatio="none">
            <Defs>
              <SvgLinearGradient id="lineGradient" x1="60" y1="60" x2="340" y2="340">
                <Stop offset="0" stopColor={theme.colors.status.indigo} />
                <Stop offset="1" stopColor={theme.colors.status.emeraldLight} />
              </SvgLinearGradient>
            </Defs>
            <Path
              d="M120 100C160 80 240 80 280 120"
              stroke="white"
              strokeDasharray="4 4"
              strokeWidth="1"
              fill="none"
            />
            <Path
              d="M300 280C260 320 180 340 100 280"
              stroke="white"
              strokeDasharray="4 4"
              strokeWidth="1"
              fill="none"
            />
            <Circle
              cx="200"
              cy="200"
              r="140"
              stroke="url(#lineGradient)"
              strokeWidth="0.5"
              fill="none"
              opacity="0.3"
            />
          </Svg>
        </View>

        {/* Typography Block */}
        <View className="mb-8 w-full gap-4 text-center">
          <View className="flex-row flex-wrap items-center justify-center">
            <Text
              className="text-center font-bold tracking-tight text-white"
              style={{
                fontSize: theme.typography.fontSize['3xl'],
                lineHeight: theme.typography.fontSize['3xl'] * 1.1,
              }}>
              {t('onboarding.healthConnect.connectYour')}{' '}
            </Text>
            <GradientText
              colors={[theme.colors.status.indigoLight, theme.colors.status.emeraldLight]}
              style={{
                fontSize: theme.typography.fontSize['3xl'],
                fontWeight: theme.typography.fontWeight.bold,
                lineHeight: theme.typography.fontSize['3xl'] * 1.1,
              }}>
              {t('onboarding.healthConnect.health')}
            </GradientText>
          </View>
          <Text
            className="text-center font-normal leading-relaxed"
            style={{
              fontSize: theme.typography.fontSize.base,
              color: theme.colors.text.gray400,
              maxWidth: '85%',
              alignSelf: 'center',
            }}>
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

      {/* Footer - Fixed Bottom */}
      <View className="absolute bottom-0 left-0 right-0">
        <LinearGradient
          colors={[theme.colors.background.primary, theme.colors.background.primary, 'transparent']}
          start={{ x: 0, y: 1 }}
          end={{ x: 0, y: 0 }}
          style={{ paddingTop: theme.spacing.padding['3xl'] }}>
          <SafeAreaView edges={['bottom']}>
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
                  shadowOpacity: 0.2,
                }}
              />

              {/* Maybe Later Button */}
              <Pressable
                className="w-full items-center py-2 active:opacity-70"
                onPress={() => {
                  // Navigate away or skip
                  router.push('/');
                }}>
                <Text className="text-sm font-medium" style={{ color: theme.colors.text.gray500 }}>
                  {t('onboarding.healthConnect.maybeLater')}
                </Text>
              </Pressable>

              {/* Privacy Statement */}
              <Text
                className="mt-4 text-center leading-relaxed"
                style={{
                  fontSize: 11,
                  color: theme.colors.text.gray500,
                }}>
                {t('onboarding.healthConnect.privacyStatement')}
              </Text>
            </View>
          </SafeAreaView>
        </LinearGradient>
      </View>
    </View>
  );
}
