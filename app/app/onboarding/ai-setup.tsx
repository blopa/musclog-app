import { Bot, ExternalLink } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';

import { ResumeDraftCard } from '@/components/aiOnboarding/ResumeDraftCard';
import { MasterLayout } from '@/components/MasterLayout';
import { ListGroup } from '@/components/theme/ListGroup';
import { ListRow } from '@/components/theme/ListRow';
import { ScreenHeader } from '@/components/theme/ScreenHeader';
import { TextButton } from '@/components/theme/TextButton';
import { useAiSetupSession } from '@/hooks/useAiSetupSession';
import { useTheme } from '@/hooks/useTheme';

/**
 * The start of the AI setup: pick how to answer (a chat here, or ChatGPT/Claude outside the app),
 * or pick up a saved conversation. Guided setup is always one tap away.
 */
export default function AiSetupScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const { copy, goGuided, go, draftApi } = useAiSetupSession();
  const { draft, loading, hasSaved, startOver } = draftApi;

  const resume = () => {
    if (draft?.path === 'external') {
      go('external');
    } else if (draft?.path === 'import') {
      go('review');
    } else {
      go(draft?.provider ? 'chat' : 'provider');
    }
  };

  return (
    <MasterLayout showNavigationMenu={false}>
      <ScreenHeader title={t(copy.hubTitleKey)} />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="gap-6 px-4 pt-4">
          <Text
            style={{ color: theme.colors.text.secondary, fontSize: theme.typography.fontSize.base }}
          >
            {t(copy.hubIntroKey)}
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
              onPress={() => go('provider')}
            />
            <ListRow
              variant="grouped"
              icon={ExternalLink}
              title={t('aiOnboarding.hub.externalTitle')}
              subtitle={t('aiOnboarding.hub.externalSubtitle')}
              onPress={() => go('external')}
            />
          </ListGroup>

          <TextButton
            label={t('aiOnboarding.hub.haveFile')}
            align="center"
            onPress={() => go('external')}
          />

          <Text
            style={{ color: theme.colors.text.tertiary, fontSize: theme.typography.fontSize.sm }}
          >
            {t('aiOnboarding.hub.privacy')}
          </Text>

          <TextButton label={t(copy.exitKey)} tone="muted" align="center" onPress={goGuided} />
        </View>
      </ScrollView>
    </MasterLayout>
  );
}
