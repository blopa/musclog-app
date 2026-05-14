import { useLocalSearchParams, useRouter } from 'expo-router';
import { AlertTriangle, Bot, Sparkles, TrendingUp } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomButtonWrapper } from '@/components/BottomButtonWrapper';
import { MasterLayout } from '@/components/MasterLayout';
import { MaybeLaterButton } from '@/components/MaybeLaterButton';
import { QuickSetupProgressBar } from '@/components/QuickSetupProgressBar';
import { Button } from '@/components/theme/Button';
import { SettingsService } from '@/database/services/SettingsService';
import { useTheme } from '@/hooks/useTheme';

const FEATURES = [
  {
    icon: Bot,
    titleKey: 'onboarding.musclogApi.features.coach.title',
    descKey: 'onboarding.musclogApi.features.coach.desc',
    colorKey: 'indigo10' as const,
    iconColorKey: 'indigoLight' as const,
  },
  {
    icon: TrendingUp,
    titleKey: 'onboarding.musclogApi.features.insights.title',
    descKey: 'onboarding.musclogApi.features.insights.desc',
    colorKey: 'emerald20' as const,
    iconColorKey: 'emeraldLight' as const,
  },
  {
    icon: Sparkles,
    titleKey: 'onboarding.musclogApi.features.recommendations.title',
    descKey: 'onboarding.musclogApi.features.recommendations.desc',
    colorKey: 'purple10' as const,
    iconColorKey: 'purple' as const,
  },
];

const PRIVACY_POLICY_URL = 'https://musclog.app/privacy';

export default function MusclogApiScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);

  const { nextRoute, quickStep, quickTotal } = useLocalSearchParams<{
    nextRoute?: string;
    quickStep?: string;
    quickTotal?: string;
  }>();

  const resolvedNextRoute = nextRoute ? decodeURIComponent(nextRoute) : '/app';
  const quickStepNum = quickStep ? Number(quickStep) : null;
  const quickTotalNum = quickTotal ? Number(quickTotal) : 6;

  const handleChoice = async (enable: boolean) => {
    setIsSaving(true);
    try {
      await SettingsService.setUseMusclogFreeTier(enable);
      router.navigate(resolvedNextRoute as never);
    } catch (e) {
      console.error('Error saving musclog API preference:', e);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <MasterLayout showNavigationMenu={false}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        {quickStepNum != null ? (
          <QuickSetupProgressBar current={quickStepNum} total={quickTotalNum} />
        ) : null}

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 140 }}
          showsVerticalScrollIndicator={false}
        >
          <View className="px-6 pt-6">
            {/* Icon + Badge Row */}
            <View className="mb-5 flex-row items-center gap-4">
              <View
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: theme.borderRadius.xl,
                  backgroundColor: theme.colors.status.purple10,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Sparkles size={32} color={theme.colors.status.purple} />
              </View>

              <View>
                <View className="flex-row items-center gap-2">
                  <Text
                    className="text-2xl font-black tracking-tight"
                    style={{ color: theme.colors.text.white }}
                  >
                    {t('onboarding.musclogApi.title')}
                  </Text>
                  <View
                    style={{
                      backgroundColor: theme.colors.status.emerald20,
                      borderRadius: theme.borderRadius.sm,
                      paddingHorizontal: 8,
                      paddingVertical: 2,
                    }}
                  >
                    <Text
                      className="text-xs font-bold"
                      style={{ color: theme.colors.status.emeraldLight }}
                    >
                      {t('onboarding.musclogApi.freeBadge')}
                    </Text>
                  </View>
                </View>
                <Text
                  className="mt-1"
                  style={{
                    color: theme.colors.text.secondary,
                    fontSize: theme.typography.fontSize.sm,
                  }}
                >
                  {t('onboarding.musclogApi.subtitle')}
                </Text>
              </View>
            </View>

            {/* Feature List */}
            <View className="mb-6 gap-3">
              {FEATURES.map((feature) => (
                <View
                  key={feature.titleKey}
                  style={{
                    backgroundColor: theme.colors.background.cardElevated,
                    borderRadius: theme.borderRadius.xl,
                    padding: 16,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 14,
                  }}
                >
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: theme.borderRadius.lg,
                      backgroundColor: theme.colors.status[feature.colorKey],
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <feature.icon size={20} color={theme.colors.status[feature.iconColorKey]} />
                  </View>
                  <View className="flex-1">
                    <Text
                      className="font-semibold"
                      style={{
                        color: theme.colors.text.primary,
                        fontSize: theme.typography.fontSize.sm,
                      }}
                    >
                      {t(feature.titleKey)}
                    </Text>
                    <Text
                      style={{
                        color: theme.colors.text.secondary,
                        fontSize: theme.typography.fontSize.xs,
                        marginTop: 2,
                      }}
                    >
                      {t(feature.descKey)}
                    </Text>
                  </View>
                </View>
              ))}
            </View>

            {/* Data Sharing Notice */}
            <View
              style={{
                backgroundColor: theme.colors.status.amber10,
                borderRadius: theme.borderRadius.xl,
                padding: 16,
                borderWidth: 1,
                borderColor: theme.colors.status.amber20,
              }}
            >
              <View className="mb-2 flex-row items-center gap-2">
                <AlertTriangle size={16} color={theme.colors.status.amber} />
                <Text
                  className="font-semibold"
                  style={{
                    color: theme.colors.status.amber,
                    fontSize: theme.typography.fontSize.sm,
                  }}
                >
                  {t('onboarding.musclogApi.dataSharingTitle')}
                </Text>
              </View>
              <Text
                style={{
                  color: theme.colors.text.secondary,
                  fontSize: theme.typography.fontSize.xs,
                  lineHeight: 18,
                }}
              >
                {t('onboarding.musclogApi.dataSharingBody')}
              </Text>
              <Text
                className="mt-2 font-semibold"
                style={{
                  color: theme.colors.status.amber,
                  fontSize: theme.typography.fontSize.xs,
                }}
                onPress={() => Linking.openURL(PRIVACY_POLICY_URL)}
              >
                {t('onboarding.musclogApi.readPrivacyPolicy')}
              </Text>
            </View>
          </View>
        </ScrollView>

        <BottomButtonWrapper>
          <Button
            label={t('onboarding.musclogApi.enable')}
            onPress={() => handleChoice(true)}
            variant="gradientCta"
            size="md"
            width="full"
            disabled={isSaving}
            loading={isSaving}
          />
          <MaybeLaterButton
            onPress={() => handleChoice(false)}
            text={t('onboarding.musclogApi.noThanks')}
          />
        </BottomButtonWrapper>
      </SafeAreaView>
    </MasterLayout>
  );
}
