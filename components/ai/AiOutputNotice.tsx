import { Info } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Pressable, Text, View } from 'react-native';

import {
  AI_DISCLAIMER_POINT_KEYS,
  AI_OUTPUT_NOTICE_KEYS,
  type AiOutputKind,
} from '@/components/ai/aiOutputNoticeCopy';
import { BottomPopUp } from '@/components/BottomPopUp';
import { TextButton } from '@/components/theme/TextButton';
import { useTheme } from '@/hooks/useTheme';
import { PREMIUM_TERMS_PATH } from '@/utils/premium/premiumLinks';
import { websitePageUrl } from '@/utils/websiteUrl';

type AiOutputNoticeProps = {
  kind: AiOutputKind;
  /** `center` under a chat or a centred result; `start` in a form or a list. */
  align?: 'start' | 'center';
  testID?: string;
};

/**
 * A short "AI can be wrong" line beside AI output. Tapping it opens the full notice. The sheet is
 * rendered inside this component, so it is a child of whatever modal holds the line (never a
 * sibling modal).
 */
export function AiOutputNotice({ kind, align = 'start', testID }: AiOutputNoticeProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const label = t(AI_OUTPUT_NOTICE_KEYS[kind]);

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={t('ai.disclaimer.openHint')}
        className={`min-h-11 flex-row items-center gap-2 py-1 active:opacity-70 ${align === 'center' ? 'justify-center self-center' : 'self-start'}`}
        testID={testID}
      >
        <Info size={theme.iconSize.sm} color={theme.colors.text.tertiary} />
        <Text
          className={`min-w-0 shrink text-xs ${align === 'center' ? 'text-center' : ''}`}
          style={{ color: theme.colors.text.tertiary }}
        >
          {label}
        </Text>
      </Pressable>
      <AiDisclaimerSheet visible={open} onClose={() => setOpen(false)} />
    </>
  );
}

type AiDisclaimerSheetProps = {
  visible: boolean;
  onClose: () => void;
};

/** The full in-app notice about AI output, with a link to the Terms. */
export function AiDisclaimerSheet({ visible, onClose }: AiDisclaimerSheetProps) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();

  return (
    <BottomPopUp
      visible={visible}
      onClose={onClose}
      title={t('ai.disclaimer.title')}
      subtitle={t('ai.disclaimer.subtitle')}
    >
      <View className="gap-3 pb-2">
        {AI_DISCLAIMER_POINT_KEYS.map((key) => (
          <View key={key} className="flex-row gap-2">
            <Text className="text-sm" style={{ color: theme.colors.text.secondary }}>
              •
            </Text>
            <Text
              className="min-w-0 flex-1 text-sm leading-5"
              style={{ color: theme.colors.text.secondary }}
            >
              {t(key)}
            </Text>
          </View>
        ))}
        <TextButton
          label={t('ai.disclaimer.readTerms')}
          align="start"
          onPress={() => {
            Linking.openURL(websitePageUrl(PREMIUM_TERMS_PATH, i18n.language)).catch(() => {});
          }}
        />
      </View>
    </BottomPopUp>
  );
}
