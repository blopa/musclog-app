import { focusManager } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { ArrowLeft, ArrowRight, LucideIcon } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dimensions, ImageBackground, Platform, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GradientText } from '../../components/GradientText';
import { MasterLayout } from '../../components/MasterLayout';
import { MaybeLaterButton } from '../../components/MaybeLaterButton';
import { PagerView, type PagerViewRef } from '../../components/PagerView/PagerView';
import PreRegistrationIntro from '../../components/PreRegistrationIntro';
import { Button } from '../../components/theme/Button';
import { PageIndicators } from '../../components/theme/PageIndicators';
import { theme } from '../../theme';

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
    <View
      style={{
        flex: 1,
        flexDirection: 'column',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingBottom: 40,
      }}
    >
      {/* Illustration Section — grows/shrinks to fill leftover space */}
      <View
        style={{
          flex: 1,
          minHeight: 0,
          maxHeight: Dimensions.get('window').height * 0.5,
          width: '100%',
          marginBottom: 24,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Ambient Background Glow */}
        <View className="absolute inset-0 rounded-full opacity-60">
          <LinearGradient
            colors={theme.colors.gradients.onboardingAmbient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              flex: 1,
              borderRadius: theme.borderRadius.full,
            }}
          />
        </View>
        <PreRegistrationIntro />
      </View>

      {/* Typography Block — never shrinks */}
      <View style={{ width: '100%', gap: 16, flexShrink: 0 }}>
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
            letterSpacing: theme.typography.letterSpacing.tight,
          }}
        >
          {title}
        </GradientText>
        <Text
          className="px-2 text-base font-normal leading-relaxed"
          style={{ color: theme.colors.text.secondary }}
        >
          {description}
        </Text>
      </View>
    </View>
  );
}

function OnboardingStepThree({ imageUrl, title, description, badge }: OnboardingBodyProps) {
  return (
    <View
      style={{
        flex: 1,
        flexDirection: 'column',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingBottom: 40,
      }}
    >
      {/* Illustration Section — grows/shrinks to fill leftover space */}
      <View
        style={{
          flex: 1,
          minHeight: 0,
          maxHeight: Dimensions.get('window').height * 0.5,
          width: '100%',
          marginBottom: 24,
        }}
      >
        {/* Ambient Background Glow */}
        <View className="absolute inset-0 rounded-full opacity-60">
          <LinearGradient
            colors={theme.colors.gradients.onboardingAmbient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              flex: 1,
              borderRadius: theme.borderRadius.full,
            }}
          />
        </View>

        {/* Main Image Card */}
        <View
          className="relative z-10 h-full w-full rounded-3xl border"
          style={{
            ...theme.shadows.lg,
            borderColor: theme.colors.background.white10,
            overflow: 'hidden',
          }}
        >
          <ImageBackground
            source={require('../../assets/app-insights.png')}
            style={{
              width: '100%',
              height: '100%',
              justifyContent: 'center',
              alignItems: 'center',
            }}
            resizeMode="cover"
            imageStyle={{
              resizeMode: 'cover',
            }}
          >
            {/* Gradient Overlay */}
            <LinearGradient
              colors={[theme.colors.overlay.backdrop90, 'transparent', 'transparent']}
              start={{ x: 0, y: 1 }}
              end={{ x: 0, y: 0 }}
              style={{ flex: 1 }}
            />

            {/* Floating Badge Overlay */}
            {badge ? (
              <View
                className="absolute bottom-6 left-6 right-6 flex-row items-center gap-4 rounded-xl border p-4"
                style={{ borderColor: theme.colors.background.white10 }}
              >
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
                  <badge.icon
                    size={theme.iconSize.xl}
                    color={theme.colors.text.black}
                    strokeWidth={theme.strokeWidth.thick}
                  />
                </View>
                <View className="relative z-10 flex-1 flex-col">
                  <Text className="text-sm font-bold" style={{ color: theme.colors.text.white }}>
                    {badge.title}
                  </Text>
                  <Text className="text-xs" style={{ color: theme.colors.overlay.white70 }}>
                    {badge.subtitle}
                  </Text>
                </View>
              </View>
            ) : null}
          </ImageBackground>
        </View>
      </View>

      {/* Typography Block — never shrinks */}
      <View style={{ width: '100%', gap: 16, flexShrink: 0 }}>
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
            letterSpacing: theme.typography.letterSpacing.tight,
          }}
        >
          {title}
        </GradientText>
        <Text
          className="px-2 text-base font-normal leading-relaxed"
          style={{ color: theme.colors.text.secondary }}
        >
          {description}
        </Text>
      </View>
    </View>
  );
}

function OnboardingStepTwo({ imageUrl, title, description, badge }: OnboardingBodyProps) {
  return (
    <View
      style={{
        flex: 1,
        flexDirection: 'column',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingBottom: 40,
      }}
    >
      {/* Illustration Section — grows/shrinks to fill leftover space */}
      <View
        style={{
          flex: 1,
          minHeight: 0,
          maxHeight: Dimensions.get('window').height * 0.5,
          width: '100%',
          marginBottom: 24,
        }}
      >
        {/* Ambient Background Glow */}
        <View className="absolute inset-0 rounded-full opacity-60">
          <LinearGradient
            colors={theme.colors.gradients.onboardingAmbient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              flex: 1,
              borderRadius: theme.borderRadius.full,
            }}
          />
        </View>

        {/* Main Image Card */}
        <View
          className="relative z-10 h-full w-full rounded-3xl border"
          style={{
            ...theme.shadows.lg,
            borderColor: theme.colors.background.white10,
            overflow: 'hidden',
          }}
        >
          <ImageBackground
            source={require('../../assets/nutrition-tracking.png')}
            style={{
              width: '100%',
              height: '100%',
              justifyContent: 'center',
              alignItems: 'center',
            }}
            resizeMode="cover"
            imageStyle={{
              resizeMode: 'cover',
            }}
          >
            {/* Gradient Overlay */}
            <LinearGradient
              colors={[theme.colors.overlay.backdrop90, 'transparent', 'transparent']}
              start={{ x: 0, y: 1 }}
              end={{ x: 0, y: 0 }}
              style={{ flex: 1 }}
            />

            {/* Floating Badge Overlay */}
            {badge ? (
              <View
                className="absolute bottom-6 left-6 right-6 flex-row items-center gap-4 rounded-xl border p-4"
                style={{ borderColor: theme.colors.background.white10 }}
              >
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
                  <badge.icon
                    size={theme.iconSize.xl}
                    color={theme.colors.text.black}
                    strokeWidth={theme.strokeWidth.thick}
                  />
                </View>
                <View className="relative z-10 flex-1 flex-col">
                  <Text className="text-sm font-bold" style={{ color: theme.colors.text.white }}>
                    {badge.title}
                  </Text>
                  <Text className="text-xs" style={{ color: theme.colors.overlay.white70 }}>
                    {badge.subtitle}
                  </Text>
                </View>
              </View>
            ) : null}
          </ImageBackground>
        </View>
      </View>

      {/* Typography Block — never shrinks */}
      <View style={{ width: '100%', gap: 16, flexShrink: 0 }}>
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
            letterSpacing: theme.typography.letterSpacing.tight,
          }}
        >
          {title}
        </GradientText>
        <Text
          className="px-2 text-base font-normal leading-relaxed"
          style={{ color: theme.colors.text.secondary }}
        >
          {description}
        </Text>
      </View>
    </View>
  );
}

function OnboardingStepOne({ imageUrl, title, description, badge }: OnboardingBodyProps) {
  return (
    <View
      style={{
        flex: 1,
        flexDirection: 'column',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingBottom: 40,
      }}
    >
      {/* Illustration Section — grows/shrinks to fill leftover space */}
      <View
        style={{
          flex: 1,
          minHeight: 0,
          maxHeight: Dimensions.get('window').height * 0.5,
          width: '100%',
          marginBottom: 24,
        }}
      >
        {/* Ambient Background Glow */}
        <View className="absolute inset-0 rounded-full opacity-60">
          <LinearGradient
            colors={theme.colors.gradients.onboardingAmbient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              flex: 1,
              borderRadius: theme.borderRadius.full,
            }}
          />
        </View>

        {/* Main Image Card */}
        <View
          className="relative z-10 h-full w-full rounded-3xl border"
          style={{
            ...theme.shadows.lg,
            borderColor: theme.colors.background.white10,
            overflow: 'hidden',
          }}
        >
          <ImageBackground
            source={require('../../assets/efordless-tracking.png')}
            style={{
              width: '100%',
              height: '100%',
              justifyContent: 'center',
              alignItems: 'center',
            }}
            resizeMode="cover"
            imageStyle={{
              resizeMode: 'cover',
            }}
          >
            {/* Gradient Overlay */}
            <LinearGradient
              colors={[theme.colors.overlay.backdrop90, 'transparent', 'transparent']}
              start={{ x: 0, y: 1 }}
              end={{ x: 0, y: 0 }}
              style={{ flex: 1, width: '100%' }}
            />

            {/* Floating Badge Overlay */}
            {badge ? (
              <View
                className="absolute bottom-6 left-6 right-6 flex-row items-center gap-4 rounded-xl border p-4"
                style={{ borderColor: theme.colors.background.white10 }}
              >
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
                  <badge.icon
                    size={theme.iconSize.xl}
                    color={theme.colors.text.black}
                    strokeWidth={theme.strokeWidth.thick}
                  />
                </View>
                <View className="relative z-10 flex-1 flex-col">
                  <Text className="text-sm font-bold" style={{ color: theme.colors.text.white }}>
                    {badge.title}
                  </Text>
                  <Text className="text-xs" style={{ color: theme.colors.overlay.white70 }}>
                    {badge.subtitle}
                  </Text>
                </View>
              </View>
            ) : null}
          </ImageBackground>
        </View>
      </View>

      {/* Typography Block — never shrinks */}
      <View style={{ width: '100%', gap: 16, flexShrink: 0 }}>
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
            letterSpacing: theme.typography.letterSpacing.tight,
          }}
        >
          {title}
        </GradientText>
        <Text
          className="px-2 text-base font-normal leading-relaxed"
          style={{ color: theme.colors.text.secondary }}
        >
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
  const pagerRef = useRef<PagerViewRef>(null);

  const handleNext = () => {
    if (currentStep < 3) {
      const nextStep = currentStep + 1;
      setCurrentStep(nextStep); // Update state optimistically
      pagerRef.current?.setPage(nextStep);
    } else {
      // Navigate to home when on last step
      if (!__DEV__ && Platform.OS === 'web') {
        router.push('/onboarding/connect-with-google');
      } else {
        router.push('/onboarding/health-connect');
      }
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      const prevStep = currentStep - 1;
      setCurrentStep(prevStep); // Update state optimistically
      pagerRef.current?.setPage(prevStep);
    } else {
      router.back();
    }
  };

  return (
    <MasterLayout showNavigationMenu={false}>
      {/* Top Bar */}
      <SafeAreaView edges={['top']} className="z-20">
        <View className="flex-row items-center justify-between p-6">
          <View style={{ width: theme.size['12'] }} />
          <MaybeLaterButton
            onPress={() => {
              // Navigate to home or skip onboarding
              if (!__DEV__ && Platform.OS === 'web') {
                router.push('/onboarding/connect-with-google');
              } else {
                router.push('/onboarding/health-connect');
              }
            }}
            text={t('onboarding.skip')}
            fullWidth={false}
          />
        </View>
      </SafeAreaView>

      {/* Main Content Area - Swipeable Container */}
      <View className="flex-1" style={{ overflow: 'hidden' }}>
        <PagerView
          ref={pagerRef}
          style={{ flex: 1 }}
          initialPage={0}
          onPageSelected={(e) => {
            const newStep = e.nativeEvent.position;
            setCurrentStep(newStep);
          }}
          scrollEnabled={true}
          overdrag={false}
        >
          {/* Step 1 */}
          <View key="step1" style={{ flex: 1 }}>
            <OnboardingStepOne
              title={t('onboarding.steps.step1.title')}
              description={t('onboarding.steps.step1.description')}
            />
          </View>

          {/* Step 2 */}
          <View key="step2" style={{ flex: 1 }}>
            <OnboardingStepTwo
              title={t('onboarding.steps.step2.title')}
              description={t('onboarding.steps.step2.description')}
            />
          </View>

          {/* Step 3 */}
          <View key="step3" style={{ flex: 1 }}>
            <OnboardingStepThree
              title={t('onboarding.steps.step3.title')}
              description={t('onboarding.steps.step3.description')}
            />
          </View>

          {/* Step 4 */}
          <View key="step4" style={{ flex: 1 }}>
            <OnboardingStepFour
              title={t('onboarding.steps.step4.title')}
              description={t('onboarding.steps.step4.description')}
            />
          </View>
        </PagerView>
      </View>

      {/* Footer / Navigation */}
      <View className="w-full max-w-md self-center">
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
                shadowOpacity: theme.colors.opacity.subtle,
              }}
            />
          </View>
        </View>
      </View>
    </MasterLayout>
  );
}
