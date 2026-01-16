import { View, Text, Pressable, ImageBackground, Dimensions, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Check, ArrowLeft, ArrowRight, LucideIcon } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useState, useRef, useEffect } from 'react';
import { theme } from '../../theme';
import { GradientText } from '../../components/GradientText';
import { PageIndicators } from '../../components/theme/PageIndicators';
import { Button } from '../../components/theme/Button';
import PreRegistrationIntro from '../../components/PreRegistrationIntro';

const PHONE_MOCKUP_IMAGE_URL =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuCvPgrOeONs-O17Ju_HUwmNT_-Sv1SdtaoahIETdH1VPVF1sOdhGUVQPfGCSQc40hRRzo9Pk8XBan5A2gVZ7YsZusBCI8VD_Aw0SdNRgiwKnFsCdF55c3RaEo-hfwVzYVvQAcOFGNF_8EImiOV6GZmWmjqekRUfuW_a5LbmALIn-K55kdyBu4zo7vTYlHSHWQg4CElJfLX2KtzBWBN-Pqi_XccbCd6syoCCx_4xrZegtQNP1Re7Vt15261Ddj7edCPGTd3GNZO7MmHY';

type OnboardingBodyProps = {
  imageUrl?: string;
  title: string;
  description: string;
  badge?: {
    icon: LucideIcon;
    title: string;
    subtitle: string;
  };
};

function OnboardingStepFour({ title, description }: OnboardingBodyProps) {
  return (
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
            colors={theme.colors.gradients.onboardingAmbient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              flex: 1,
              borderRadius: 9999,
            }}
          />
        </View>
        <PreRegistrationIntro />
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
          {title}
        </GradientText>
        <Text
          className="px-2 text-base font-normal leading-relaxed"
          style={{ color: theme.colors.text.gray400 }}>
          {description}
        </Text>
      </View>
    </View>
  );
}

function OnboardingStepThree({ imageUrl, title, description, badge }: OnboardingBodyProps) {
  return (
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
            colors={theme.colors.gradients.onboardingAmbient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              flex: 1,
              borderRadius: 9999,
            }}
          />
        </View>

        {/* Main Image Card - TODO move to separate file maybe? */}
        <View
          className="relative z-10 h-full w-full overflow-hidden rounded-3xl border border-white/10"
          style={theme.shadows.lg}>
          <ImageBackground source={{ uri: imageUrl }} className="h-full w-full" resizeMode="cover">
            {/* Gradient Overlay */}
            <LinearGradient
              colors={[theme.colors.overlay.backdrop90, 'transparent', 'transparent']}
              start={{ x: 0, y: 1 }}
              end={{ x: 0, y: 0 }}
              style={{ flex: 1 }}
            />

            {/* Floating Badge Overlay */}
            {badge && (
              <View className="absolute bottom-6 left-6 right-6 flex-row items-center gap-4 rounded-xl border border-white/10 p-4">
                <LinearGradient
                  colors={theme.colors.gradients.whiteSubtle}
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
                  <badge.icon size={24} color={theme.colors.text.black} strokeWidth={3} />
                </View>
                <View className="relative z-10 flex-1 flex-col">
                  <Text className="text-sm font-bold text-white">{badge.title}</Text>
                  <Text className="text-xs" style={{ color: theme.colors.overlay.white70 }}>
                    {badge.subtitle}
                  </Text>
                </View>
              </View>
            )}
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
          {title}
        </GradientText>
        <Text
          className="px-2 text-base font-normal leading-relaxed"
          style={{ color: theme.colors.text.gray400 }}>
          {description}
        </Text>
      </View>
    </View>
  );
}

function OnboardingStepTwo({ imageUrl, title, description, badge }: OnboardingBodyProps) {
  return (
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
            colors={theme.colors.gradients.onboardingAmbient}
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
          <ImageBackground source={{ uri: imageUrl }} className="h-full w-full" resizeMode="cover">
            {/* Gradient Overlay */}
            <LinearGradient
              colors={[theme.colors.overlay.backdrop90, 'transparent', 'transparent']}
              start={{ x: 0, y: 1 }}
              end={{ x: 0, y: 0 }}
              style={{ flex: 1 }}
            />

            {/* Floating Badge Overlay */}
            {badge && (
              <View className="absolute bottom-6 left-6 right-6 flex-row items-center gap-4 rounded-xl border border-white/10 p-4">
                <LinearGradient
                  colors={theme.colors.gradients.whiteSubtle}
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
                  <badge.icon size={24} color={theme.colors.text.black} strokeWidth={3} />
                </View>
                <View className="relative z-10 flex-1 flex-col">
                  <Text className="text-sm font-bold text-white">{badge.title}</Text>
                  <Text className="text-xs" style={{ color: theme.colors.overlay.white70 }}>
                    {badge.subtitle}
                  </Text>
                </View>
              </View>
            )}
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
          {title}
        </GradientText>
        <Text
          className="px-2 text-base font-normal leading-relaxed"
          style={{ color: theme.colors.text.gray400 }}>
          {description}
        </Text>
      </View>
    </View>
  );
}

function OnboardingStepOne({ imageUrl, title, description, badge }: OnboardingBodyProps) {
  return (
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
            colors={theme.colors.gradients.onboardingAmbient}
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
          <ImageBackground source={{ uri: imageUrl }} className="h-full w-full" resizeMode="cover">
            {/* Gradient Overlay */}
            <LinearGradient
              colors={[theme.colors.overlay.backdrop90, 'transparent', 'transparent']}
              start={{ x: 0, y: 1 }}
              end={{ x: 0, y: 0 }}
              style={{ flex: 1 }}
            />

            {/* Floating Badge Overlay */}
            {badge && (
              <View className="absolute bottom-6 left-6 right-6 flex-row items-center gap-4 rounded-xl border border-white/10 p-4">
                <LinearGradient
                  colors={theme.colors.gradients.whiteSubtle}
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
                  <badge.icon size={24} color={theme.colors.text.black} strokeWidth={3} />
                </View>
                <View className="relative z-10 flex-1 flex-col">
                  <Text className="text-sm font-bold text-white">{badge.title}</Text>
                  <Text className="text-xs" style={{ color: theme.colors.overlay.white70 }}>
                    {badge.subtitle}
                  </Text>
                </View>
              </View>
            )}
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
          {title}
        </GradientText>
        <Text
          className="px-2 text-base font-normal leading-relaxed"
          style={{ color: theme.colors.text.gray400 }}>
          {description}
        </Text>
      </View>
    </View>
  );
}

export default function OnboardingScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const screenWidth = Dimensions.get('window').width;

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: -currentStep * screenWidth,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [currentStep, slideAnim, screenWidth]);

  const handleNext = () => {
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1);
    } else {
      // Navigate to home when on last step
      router.push('/');
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    } else {
      router.back();
    }
  };

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
              {t('onboarding.skip')}
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>

      {/* Main Content Area - Sliding Container */}
      <View className="flex-1" style={{ overflow: 'hidden' }}>
        <Animated.View
          style={{
            flexDirection: 'row',
            transform: [{ translateX: slideAnim }],
            width: screenWidth * 4,
            height: '100%',
          }}>
          {/* Step 1 */}
          <View style={{ width: screenWidth }}>
            <OnboardingStepOne
              imageUrl={PHONE_MOCKUP_IMAGE_URL}
              title={t('onboarding.steps.step1.title')}
              description={t('onboarding.steps.step1.description')}
              badge={{
                icon: Check,
                title: t('onboarding.steps.step1.badge.title'),
                subtitle: t('onboarding.steps.step1.badge.subtitle'),
              }}
            />
          </View>

          {/* Step 2 */}
          <View style={{ width: screenWidth }}>
            <OnboardingStepTwo
              imageUrl={PHONE_MOCKUP_IMAGE_URL}
              title={t('onboarding.steps.step2.title')}
              description={t('onboarding.steps.step2.description')}
            />
          </View>

          {/* Step 3 */}
          <View style={{ width: screenWidth }}>
            <OnboardingStepThree
              imageUrl={PHONE_MOCKUP_IMAGE_URL}
              title={t('onboarding.steps.step3.title')}
              description={t('onboarding.steps.step3.description')}
            />
          </View>

          {/* Step 4 */}
          <View style={{ width: screenWidth }}>
            <OnboardingStepFour
              title={t('onboarding.steps.step4.title')}
              description={t('onboarding.steps.step4.description')}
            />
          </View>
        </Animated.View>
      </View>

      {/* Footer / Navigation */}
      <View className="z-20 w-full max-w-md self-center">
        <SafeAreaView edges={['bottom']}>
          <View className="flex-col items-center gap-8 px-6 pb-8 pt-4">
            {/* Page Indicators */}
            <PageIndicators totalPages={4} currentPage={currentStep} />

            {/* Navigation Buttons */}
            <View className="w-full flex-row items-center justify-between">
              {currentStep > 0 ? (
                <Button
                  label={t('onboarding.back')}
                  variant="outline"
                  size="sm"
                  icon={ArrowLeft}
                  iconPosition="left"
                  onPress={handleBack}
                  style={{
                    borderColor: theme.colors.background.white10,
                  }}
                />
              ) : (
                <View style={{ width: theme.size['14'] }} />
              )}

              <Button
                label={currentStep === 3 ? t('onboarding.getStarted') : t('onboarding.next')}
                variant="gradientCta"
                size="sm"
                icon={ArrowRight}
                iconPosition="right"
                onPress={handleNext}
                style={{
                  backgroundColor: theme.colors.status.emeraldLight,
                  ...theme.shadows.lg,
                  shadowColor: theme.colors.status.emeraldLight,
                  shadowOpacity: 0.2,
                }}
              />
            </View>
          </View>
        </SafeAreaView>
      </View>
    </View>
  );
}
