import { useRouter } from 'expo-router';
import { Check, CircleOff, Waves } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomButtonWrapper } from '@/components/BottomButtonWrapper';
import { MasterLayout } from '@/components/MasterLayout';
import { QuickSetupProgressBar } from '@/components/QuickSetupProgressBar';
import { Button } from '@/components/theme/Button';
import { useTheme } from '@/hooks/useTheme';
import { setCurrentOnboardingStep } from '@/utils/onboardingService';

const NUTRITION_RESULTS_ROUTE =
  '/app/onboarding/nutrition-goals-results?aiGenerated=true&personalizedSetup=true';
const MUSCLOG_API_DIRECT_ROUTE = `/app/onboarding/musclog-api?nextRoute=${encodeURIComponent(NUTRITION_RESULTS_ROUTE)}&quickStep=8&quickTotal=9`;
const MUSCLOG_API_AFTER_CYCLE_ROUTE = `/app/onboarding/musclog-api?nextRoute=${encodeURIComponent(NUTRITION_RESULTS_ROUTE)}&quickStep=9&quickTotal=9`;

export default function PersonalizedCycleScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const router = useRouter();

  const [menstruates, setMenstruates] = useState<boolean | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleContinue = async () => {
    if (menstruates === null) {
      return;
    }

    setIsSaving(true);
    try {
      await setCurrentOnboardingStep('/app/onboarding/personalized-cycle');

      if (menstruates) {
        const nextRoute = encodeURIComponent(MUSCLOG_API_AFTER_CYCLE_ROUTE);
        router.navigate(
          `/app/onboarding/cycle-setup?nextRoute=${nextRoute}&quickStep=8&quickTotal=9`
        );
      } else {
        router.navigate(MUSCLOG_API_DIRECT_ROUTE);
      }
    } catch (e) {
      console.error('Error in personalized cycle screen:', e);
    } finally {
      setIsSaving(false);
    }
  };

  const options = [
    {
      value: true,
      label: t('onboarding.personalizedCycle.yes'),
      desc: t('onboarding.personalizedCycle.yesDesc'),
      icon: Waves,
    },
    {
      value: false,
      label: t('onboarding.personalizedCycle.no'),
      desc: t('onboarding.personalizedCycle.noDesc'),
      icon: CircleOff,
    },
  ];

  return (
    <MasterLayout showNavigationMenu={false}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <QuickSetupProgressBar current={7} total={9} />

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
        >
          <View className="px-6 pt-6">
            <Text
              className="mb-1 text-3xl font-black tracking-tight"
              style={{ color: theme.colors.text.white }}
            >
              {t('onboarding.personalizedCycle.title')}
            </Text>
            <Text
              className="mb-8"
              style={{
                color: theme.colors.text.secondary,
                fontSize: theme.typography.fontSize.sm,
              }}
            >
              {t('onboarding.personalizedCycle.subtitle')}
            </Text>

            <Text className="mb-4 text-lg font-semibold" style={{ color: theme.colors.text.white }}>
              {t('onboarding.personalizedCycle.question')}
            </Text>

            <View className="gap-3">
              {options.map((opt) => {
                const isSelected = menstruates === opt.value;
                return (
                  <Pressable
                    key={String(opt.value)}
                    onPress={() => setMenstruates(opt.value)}
                    className="flex-row items-center justify-between rounded-xl px-4 py-4"
                    style={{
                      backgroundColor: theme.colors.background.cardElevated,
                      borderWidth: 1.5,
                      borderColor: isSelected ? theme.colors.accent.primary : 'transparent',
                    }}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: isSelected }}
                  >
                    <View className="flex-row items-center gap-3">
                      <View
                        className="items-center justify-center rounded-full"
                        style={{
                          width: 36,
                          height: 36,
                          backgroundColor: isSelected
                            ? theme.colors.accent.primary + '22'
                            : theme.colors.background.card,
                        }}
                      >
                        <opt.icon
                          size={18}
                          color={
                            isSelected ? theme.colors.accent.primary : theme.colors.text.secondary
                          }
                        />
                      </View>
                      <View>
                        <Text
                          className="font-semibold"
                          style={{
                            color: isSelected
                              ? theme.colors.accent.primary
                              : theme.colors.text.primary,
                            fontSize: theme.typography.fontSize.base,
                          }}
                        >
                          {opt.label}
                        </Text>
                        <Text
                          style={{
                            color: theme.colors.text.secondary,
                            fontSize: theme.typography.fontSize.xs,
                          }}
                        >
                          {opt.desc}
                        </Text>
                      </View>
                    </View>

                    <View
                      className="items-center justify-center rounded-full"
                      style={{
                        width: 24,
                        height: 24,
                        borderWidth: 2,
                        borderColor: isSelected
                          ? theme.colors.accent.primary
                          : theme.colors.border.light,
                        backgroundColor: isSelected ? theme.colors.accent.primary : 'transparent',
                      }}
                    >
                      {isSelected ? <Check size={14} color={theme.colors.text.white} /> : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </ScrollView>

        <BottomButtonWrapper>
          <Button
            label={t('onboarding.personalizedCycle.continue')}
            onPress={handleContinue}
            variant="gradientCta"
            size="md"
            width="full"
            disabled={menstruates === null || isSaving}
            loading={isSaving}
          />
          <View style={{ height: theme.spacing.margin.md }} />
        </BottomButtonWrapper>
      </SafeAreaView>
    </MasterLayout>
  );
}
