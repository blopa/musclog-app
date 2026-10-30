import { useRouter } from 'expo-router';
import { Check } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomButtonWrapper } from '@/components/BottomButtonWrapper';
import { MasterLayout } from '@/components/MasterLayout';
import { FITNESS_OPTIONS, WEIGHT_OPTIONS } from '@/components/onboarding/onboardingOptions';
import { QuickSetupProgressBar } from '@/components/QuickSetupProgressBar';
import { Button } from '@/components/theme/Button';
import { type FitnessGoal, type WeightGoal } from '@/database/models/User';
import { useTheme } from '@/hooks/useTheme';
import { mergePersonalizedSetup, readPersonalizedSetup } from '@/utils/onboardingDraft';
import { setCurrentOnboardingStep } from '@/utils/onboardingService';

export default function PersonalizedGoalsScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const router = useRouter();

  const [fitnessGoal, setFitnessGoal] = useState<FitnessGoal>('general');
  const [weightGoal, setWeightGoal] = useState<WeightGoal>('maintain');
  const [isSaving, setIsSaving] = useState(false);

  // Answers given earlier (including through the AI setup) come back prefilled instead of reset.
  useEffect(() => {
    let cancelled = false;
    readPersonalizedSetup().then((saved) => {
      if (cancelled) {
        return;
      }

      if (saved.fitnessGoal) {
        setFitnessGoal(saved.fitnessGoal);
      }

      if (saved.weightGoal) {
        setWeightGoal(saved.weightGoal);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleContinue = async () => {
    setIsSaving(true);
    try {
      await mergePersonalizedSetup({ fitnessGoal, weightGoal });

      await setCurrentOnboardingStep('/app/onboarding/personalized-goals');
      router.navigate('/app/onboarding/personalized-body-stats');
    } catch (e) {
      console.error('Error saving personalized goals:', e);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <MasterLayout showNavigationMenu={false}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <QuickSetupProgressBar current={4} total={10} />

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
        >
          <View className="px-6 pt-6">
            <Text className="mb-1 text-2xl font-bold" style={{ color: theme.colors.text.primary }}>
              {t('onboarding.quickGoals.title')}
            </Text>
            <Text
              className="mb-8"
              style={{
                color: theme.colors.text.secondary,
                fontSize: theme.typography.fontSize.sm,
              }}
            >
              {t('onboarding.quickGoals.subtitle')}
            </Text>

            {/* Fitness Focus */}
            <View className="mb-8 gap-3">
              <Text className="text-xs font-semibold" style={{ color: theme.colors.text.tertiary }}>
                {t('onboarding.quickGoals.fitnessFocus').toUpperCase()}
              </Text>

              <View className="flex-row flex-wrap gap-3">
                {FITNESS_OPTIONS.map((opt) => {
                  const isSelected = fitnessGoal === opt.value;
                  const iconColor = isSelected
                    ? theme.colors.accent.primary
                    : theme.colors.text.secondary;
                  return (
                    <Pressable
                      key={opt.value}
                      onPress={() => setFitnessGoal(opt.value)}
                      style={{
                        width: '47%',
                        backgroundColor: theme.colors.background.cardElevated,
                        borderRadius: theme.borderRadius.xl,
                        borderWidth: 1.5,
                        borderColor: isSelected ? theme.colors.accent.primary : 'transparent',
                        padding: 16,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: isSelected }}
                    >
                      <View className="flex-row items-center gap-2">
                        <opt.icon size={18} color={iconColor} />
                        <Text
                          className="font-semibold"
                          style={{
                            color: isSelected
                              ? theme.colors.accent.primary
                              : theme.colors.text.primary,
                            fontSize: theme.typography.fontSize.sm,
                          }}
                        >
                          {t(opt.labelKey)}
                        </Text>
                      </View>
                      <View
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: 10,
                          borderWidth: 2,
                          borderColor: isSelected
                            ? theme.colors.accent.primary
                            : theme.colors.border.light,
                          backgroundColor: isSelected ? theme.colors.accent.primary : 'transparent',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {isSelected ? <Check size={12} color={theme.colors.text.primary} /> : null}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Weight Goal */}
            <View className="gap-3">
              <View className="flex-row items-center gap-1">
                <Text
                  className="text-xs font-semibold"
                  style={{ color: theme.colors.text.tertiary }}
                >
                  {t('onboarding.quickGoals.weightGoal').toUpperCase()}
                </Text>
                <Text style={{ color: theme.colors.status.error, fontSize: 12 }}>*</Text>
              </View>

              <View className="flex-row gap-3">
                {WEIGHT_OPTIONS.map((opt) => {
                  const isSelected = weightGoal === opt.value;
                  const iconColor = isSelected
                    ? theme.colors.accent.primary
                    : theme.colors.text.secondary;
                  return (
                    <Pressable
                      key={opt.value}
                      onPress={() => setWeightGoal(opt.value)}
                      className="flex-1 items-center justify-center rounded-control py-4"
                      style={{
                        backgroundColor: theme.colors.background.cardElevated,
                        borderWidth: 1.5,
                        borderColor: isSelected ? theme.colors.accent.primary : 'transparent',
                        gap: 6,
                      }}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: isSelected }}
                    >
                      <opt.icon size={20} color={iconColor} />
                      <Text
                        className="font-semibold"
                        style={{
                          color: isSelected
                            ? theme.colors.accent.primary
                            : theme.colors.text.primary,
                          fontSize: theme.typography.fontSize.sm,
                        }}
                      >
                        {t(opt.labelKey)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>
        </ScrollView>

        <BottomButtonWrapper>
          <Button
            label={t('onboarding.quickGoals.continue')}
            onPress={handleContinue}
            variant="gradientCta"
            size="md"
            width="full"
            disabled={isSaving}
            loading={isSaving}
          />
          <View style={{ height: theme.spacing.margin.md }} />
        </BottomButtonWrapper>
      </SafeAreaView>
    </MasterLayout>
  );
}
