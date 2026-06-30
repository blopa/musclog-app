import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { Check, User, Users } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomButtonWrapper } from '@/components/BottomButtonWrapper';
import { MasterLayout } from '@/components/MasterLayout';
import { QuickSetupProgressBar } from '@/components/QuickSetupProgressBar';
import { Button } from '@/components/theme/Button';
import { SegmentedControl } from '@/components/theme/SegmentedControl';
import { QUICK_SETUP_DATA } from '@/constants/misc';
import { type Gender } from '@/database/models/User';
import { SettingsService } from '@/database/services';
import { useTheme } from '@/hooks/useTheme';

type Units = 'metric' | 'imperial';

export default function QuickPreferencesScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const router = useRouter();

  const [units, setUnits] = useState<Units>('metric');
  const [gender, setGender] = useState<Gender>('male');
  const [isSaving, setIsSaving] = useState(false);

  const genderOptions: { value: Gender; label: string }[] = [
    { value: 'male', label: t('onboarding.quickPreferences.male') },
    { value: 'female', label: t('onboarding.quickPreferences.female') },
    { value: 'other', label: t('onboarding.quickPreferences.other') },
  ];

  const handleContinue = async () => {
    setIsSaving(true);
    try {
      await SettingsService.setUnits(units);

      const existing = await AsyncStorage.getItem(QUICK_SETUP_DATA);
      const current = existing ? JSON.parse(existing) : {};
      await AsyncStorage.setItem(QUICK_SETUP_DATA, JSON.stringify({ ...current, gender, units }));

      router.navigate(
        `/app/onboarding/health-connect?nextRoute=/app/onboarding/quick-goals&quickStep=2&quickTotal=6`
      );
    } catch (e) {
      console.error('Error saving quick preferences:', e);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <MasterLayout showNavigationMenu={false}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <QuickSetupProgressBar current={1} total={6} />

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
        >
          <View className="px-6 pt-6">
            {/* Title */}
            <Text
              className="mb-1 text-3xl font-black tracking-tight"
              style={{ color: theme.colors.text.white }}
            >
              {t('onboarding.quickPreferences.title')}
            </Text>
            <Text
              className="mb-8"
              style={{
                color: theme.colors.text.secondary,
                fontSize: theme.typography.fontSize.sm,
              }}
            >
              {t('onboarding.quickPreferences.subtitle')}
            </Text>

            {/* Unit System */}
            <View className="mb-8 gap-3">
              <Text
                className="text-xs font-semibold tracking-widest"
                style={{ color: theme.colors.text.tertiary }}
              >
                {t('onboarding.quickPreferences.unitSystem').toUpperCase()}
              </Text>
              <SegmentedControl
                options={[
                  { label: t('onboarding.quickPreferences.metric'), value: 'metric' },
                  { label: t('onboarding.quickPreferences.imperial'), value: 'imperial' },
                ]}
                value={units}
                onValueChange={(v) => setUnits(v as Units)}
                variant="gradient"
              />
            </View>

            {/* Gender */}
            <View className="gap-3">
              <Text
                className="text-xs font-semibold tracking-widest"
                style={{ color: theme.colors.text.tertiary }}
              >
                {t('onboarding.quickPreferences.gender').toUpperCase()}
              </Text>

              {/* Info note */}
              <View
                className="rounded-xl p-3"
                style={{ backgroundColor: theme.colors.background.cardElevated }}
              >
                <Text
                  style={{
                    color: theme.colors.text.secondary,
                    fontSize: theme.typography.fontSize.xs,
                    lineHeight: theme.typography.fontSize.xs * 1.6,
                  }}
                >
                  {t('onboarding.quickPreferences.genderNote')}
                </Text>
              </View>

              {/* Gender options */}
              {genderOptions.map((opt) => {
                const isSelected = gender === opt.value;
                return (
                  <Pressable
                    key={opt.value}
                    onPress={() => setGender(opt.value)}
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
                        {opt.value === 'other' ? (
                          <Users
                            size={18}
                            color={
                              isSelected ? theme.colors.accent.primary : theme.colors.text.secondary
                            }
                          />
                        ) : (
                          <User
                            size={18}
                            color={
                              isSelected ? theme.colors.accent.primary : theme.colors.text.secondary
                            }
                          />
                        )}
                      </View>
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
            label={t('onboarding.quickPreferences.continue')}
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
