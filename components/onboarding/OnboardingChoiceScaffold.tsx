import type { ReactNode } from 'react';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomButtonWrapper } from '@/components/BottomButtonWrapper';
import { MasterLayout } from '@/components/MasterLayout';
import { scrollCueBottom } from '@/components/modals/footerClearance';
import { QuickSetupProgressBar } from '@/components/QuickSetupProgressBar';
import { useScrollFade } from '@/hooks/useScrollFade';
import { useTheme } from '@/hooks/useTheme';

type OnboardingChoiceScaffoldProps = {
  heading: string;
  intro: string;
  choicesLabel: string;
  quickStep: number | null;
  quickTotal: number;
  footer: ReactNode;
  children: ReactNode;
};

/**
 * Shared layout chrome for single-select onboarding choice screens: optional progress bar,
 * scrollable header and radiogroup, scroll-fade cue and floating bottom action bar.
 */
export function OnboardingChoiceScaffold({
  heading,
  intro,
  choicesLabel,
  quickStep,
  quickTotal,
  footer,
  children,
}: OnboardingChoiceScaffoldProps) {
  const theme = useTheme();
  const { scrollProps, FadeIndicator } = useScrollFade();
  const [footerHeight, setFooterHeight] = useState(0);

  return (
    <MasterLayout showNavigationMenu={false}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        {quickStep != null ? (
          <QuickSetupProgressBar current={quickStep} total={quickTotal} />
        ) : null}

        <ScrollView
          {...scrollProps}
          className="flex-1"
          contentContainerStyle={{ paddingBottom: footerHeight + 24 }}
          showsVerticalScrollIndicator={false}
        >
          <View className="gap-6 px-6 pt-6">
            <View className="gap-3">
              <Text
                accessibilityRole="header"
                className="font-bold"
                style={{
                  color: theme.colors.text.primary,
                  fontSize: theme.typography.fontSize['3xl'],
                  lineHeight: theme.typography.fontSize['3xl'] * 1.2,
                }}
              >
                {heading}
              </Text>
              <Text
                style={{
                  color: theme.colors.text.secondary,
                  fontSize: theme.typography.fontSize.base,
                  lineHeight: theme.typography.fontSize.base * 1.45,
                }}
              >
                {intro}
              </Text>
            </View>

            <View
              className="gap-3"
              accessibilityRole="radiogroup"
              accessibilityLabel={choicesLabel}
            >
              {children}
            </View>
          </View>
        </ScrollView>

        <View
          pointerEvents="box-none"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: scrollCueBottom(footerHeight),
          }}
        >
          {FadeIndicator}
        </View>

        <BottomButtonWrapper onHeightChange={setFooterHeight}>{footer}</BottomButtonWrapper>
      </SafeAreaView>
    </MasterLayout>
  );
}
