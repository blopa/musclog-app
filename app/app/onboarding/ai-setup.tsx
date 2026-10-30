import { useLocalSearchParams, useRouter } from 'expo-router';
import { Bot, ExternalLink } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';

import { ResumeDraftCard } from '@/components/aiOnboarding/ResumeDraftCard';
import { MasterLayout } from '@/components/MasterLayout';
import { ListGroup } from '@/components/theme/ListGroup';
import { ListRow } from '@/components/theme/ListRow';
import { ScreenHeader } from '@/components/theme/ScreenHeader';
import { TextButton } from '@/components/theme/TextButton';
import { useAiGuidedExit } from '@/hooks/useAiGuidedExit';
import { useAiOnboardingDraft } from '@/hooks/useAiOnboardingDraft';
import { useTheme } from '@/hooks/useTheme';
import { aiSetupRoute, resolveAiSetupMode } from '@/utils/onboardingRoutes';

/**
 * The start of the AI setup: pick how to answer (a chat here, or ChatGPT/Claude outside the app),
 * or pick up a saved conversation. Guided setup is always one tap away.
 */
export default function AiSetupScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const mode = resolveAiSetupMode(useLocalSearchParams<{ mode?: string }>().mode);
  const isProfile = mode === 'profile';
  const { draft, loading, hasSaved, startOver, discard } = useAiOnboardingDraft(mode);

  const resume = () => {
    if (draft?.path === 'external') {
      router.navigate(aiSetupRoute('external', mode) as never);
    } else if (draft?.path === 'import') {
      router.navigate(aiSetupRoute('review', mode) as never);
    } else {
      router.navigate(aiSetupRoute(draft?.provider ? 'chat' : 'provider', mode) as never);
    }
  };

  const goGuided = useAiGuidedExit(mode, { draft, hasSaved, discard });

  return (
    <MasterLayout showNavigationMenu={false}>
      <ScreenHeader
        title={t(isProfile ? 'aiOnboarding.hub.profileTitle' : 'aiOnboarding.hub.title')}
      />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="gap-6 px-4 pt-4">
          <Text
            style={{ color: theme.colors.text.secondary, fontSize: theme.typography.fontSize.base }}
          >
            {t(isProfile ? 'aiOnboarding.hub.profileIntro' : 'aiOnboarding.hub.intro')}
          </Text>

          {loading ? <ActivityIndicator color={theme.colors.accent.primary} /> : null}

          {hasSaved ? (
            <ResumeDraftCard onContinue={resume} onStartOver={() => void startOver()} />
          ) : null}

          <ListGroup>
            <ListRow
              variant="grouped"
              icon={Bot}
              title={t('aiOnboarding.hub.chatTitle')}
              subtitle={t('aiOnboarding.hub.chatSubtitle')}
              onPress={() => router.navigate(aiSetupRoute('provider', mode) as never)}
            />
            <ListRow
              variant="grouped"
              icon={ExternalLink}
              title={t('aiOnboarding.hub.externalTitle')}
              subtitle={t('aiOnboarding.hub.externalSubtitle')}
              onPress={() => router.navigate(aiSetupRoute('external', mode) as never)}
            />
          </ListGroup>

          <TextButton
            label={t('aiOnboarding.hub.haveFile')}
            align="center"
            onPress={() => router.navigate(aiSetupRoute('external', mode) as never)}
          />

          <Text
            style={{ color: theme.colors.text.tertiary, fontSize: theme.typography.fontSize.sm }}
          >
            {t('aiOnboarding.hub.privacy')}
          </Text>

          <TextButton
            label={t(
              isProfile ? 'aiOnboarding.common.editManually' : 'aiOnboarding.common.backToGuided'
            )}
            tone="muted"
            align="center"
            onPress={goGuided}
          />
        </View>
      </ScrollView>
    </MasterLayout>
  );
}
