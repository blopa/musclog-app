import * as Clipboard from 'expo-clipboard';
import { ClipboardPaste, Copy, FileUp, Share2 } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, ScrollView, Text, View } from 'react-native';

import { PasteJsonSheet } from '@/components/aiOnboarding/PasteJsonSheet';
import { MasterLayout } from '@/components/MasterLayout';
import { Button } from '@/components/theme/Button';
import { ScreenHeader } from '@/components/theme/ScreenHeader';
import { SectionLabel } from '@/components/theme/SectionLabel';
import { TextButton } from '@/components/theme/TextButton';
import { useSnackbar } from '@/context/SnackbarContext';
import { useAiSetupSession } from '@/hooks/useAiSetupSession';
import { useNativeShareText } from '@/hooks/useNativeShareText';
import { useTheme } from '@/hooks/useTheme';
import { MAX_CONTRACT_BYTES } from '@/utils/aiOnboarding/contract';
import { type ContractParseError, parseContractText } from '@/utils/aiOnboarding/contractParse';
import {
  buildExternalChatUrl,
  buildExternalInstructions,
  type ExternalTarget,
} from '@/utils/aiOnboarding/instructions';
import { handleError } from '@/utils/handleError';
import { pickTextFile } from '@/utils/pickTextFile';

/** What the person is told for each way an imported file can be unusable. */
const IMPORT_ERROR_KEYS: Record<ContractParseError, string> = {
  empty: 'aiOnboarding.external.errors.empty',
  tooLarge: 'aiOnboarding.external.errors.tooLarge',
  notJson: 'aiOnboarding.external.errors.notJson',
  notAnObject: 'aiOnboarding.external.errors.notJson',
  wrongSchema: 'aiOnboarding.external.errors.wrongSchema',
  invalidVersion: 'aiOnboarding.external.errors.wrongSchema',
  newerVersion: 'aiOnboarding.external.errors.newerVersion',
};

/**
 * The hand-off to ChatGPT or Claude and the way back. Leaving is explained first; the instructions
 * are always copied, because neither service documents a link that fills its chat box. Coming back
 * is by file or by pasted text, both validated here exactly as an in-app answer would be.
 */
export default function AiExternalScreen() {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const { showSnackbar } = useSnackbar();
  const { shareText } = useNativeShareText();
  const { copy, draftApi, goGuided, go } = useAiSetupSession();

  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteError, setPasteError] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [fallbackNotice, setFallbackNotice] = useState(false);

  const instructions = () =>
    buildExternalInstructions({ language: i18n.resolvedLanguage ?? i18n.language });

  const copyInstructions = async (): Promise<boolean> => {
    try {
      await Clipboard.setStringAsync(instructions());
      return true;
    } catch (error) {
      handleError(error, 'AiExternalScreen.copy');
      return false;
    }
  };

  const open = async (target: ExternalTarget) => {
    setFallbackNotice(false);
    const copied = await copyInstructions();
    await draftApi.update({ path: 'external' });
    if (copied) {
      showSnackbar('success', t('aiOnboarding.external.copiedPaste'), { duration: 4000 });
    }

    try {
      // A prefilled link is a bonus when it is short enough; the copy above is what always works.
      await Linking.openURL(buildExternalChatUrl(target, instructions()).url);
    } catch {
      setFallbackNotice(true);
    }
  };

  const copyOnly = async () => {
    setFallbackNotice(false);
    if (await copyInstructions()) {
      showSnackbar('success', t('aiOnboarding.external.copied'));
    } else {
      setFallbackNotice(true);
    }
  };

  const share = () => {
    shareText(instructions()).catch((error) => handleError(error, 'AiExternalScreen.share'));
  };

  /** Validates imported text; on success the answers replace the draft's and the review opens. */
  const accept = async (text: string): Promise<string | null> => {
    const result = parseContractText(text, new Date());
    if (!result.ok) {
      return t(IMPORT_ERROR_KEYS[result.error]);
    }

    await draftApi.update({
      path: 'import',
      answers: result.draft,
      importNotes: { ignoredKeys: result.droppedKeys, issues: result.issues },
    });
    go('review');
    return null;
  };

  const importFile = async () => {
    setFileError(null);
    try {
      const picked = await pickTextFile({ maxBytes: MAX_CONTRACT_BYTES });
      if (picked.status === 'cancelled') {
        return;
      }

      setFileError(
        picked.status === 'tooLarge' ? t(IMPORT_ERROR_KEYS.tooLarge) : await accept(picked.text)
      );
    } catch (error) {
      handleError(error, 'AiExternalScreen.importFile');
      setFileError(t('aiOnboarding.external.errors.fileRead'));
    }
  };

  const submitPasted = async (text: string) => {
    const error = await accept(text);
    setPasteError(error);
    if (!error) {
      setPasteOpen(false);
    }
  };

  const steps = [
    'aiOnboarding.external.steps.one',
    'aiOnboarding.external.steps.two',
    'aiOnboarding.external.steps.three',
  ] as const;

  return (
    <MasterLayout showNavigationMenu={false}>
      <ScreenHeader title={t('aiOnboarding.external.title')} />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="gap-6 px-4 pt-4">
          <View className="gap-2">
            <Text
              style={{
                color: theme.colors.text.secondary,
                fontSize: theme.typography.fontSize.base,
              }}
            >
              {t('aiOnboarding.external.intro')}
            </Text>
            {steps.map((key, index) => (
              <Text
                key={key}
                style={{
                  color: theme.colors.text.primary,
                  fontSize: theme.typography.fontSize.base,
                }}
              >
                {`${index + 1}. ${t(key)}`}
              </Text>
            ))}
          </View>

          <View className="gap-3">
            <SectionLabel>{t('aiOnboarding.external.leaveSection')}</SectionLabel>
            <Button
              label={t('aiOnboarding.external.openChatgpt')}
              variant="accent"
              width="full"
              onPress={() => open('chatgpt')}
            />
            <Button
              label={t('aiOnboarding.external.openClaude')}
              variant="accent"
              width="full"
              onPress={() => open('claude')}
            />
            <View className="flex-row gap-3">
              <Button
                label={t('aiOnboarding.external.copy')}
                icon={Copy}
                variant="outline"
                size="sm"
                width="flex-1"
                onPress={copyOnly}
              />
              <Button
                label={t('aiOnboarding.external.share')}
                icon={Share2}
                variant="outline"
                size="sm"
                width="flex-1"
                onPress={share}
              />
            </View>
            {fallbackNotice ? (
              <Text
                style={{ color: theme.colors.status.error, fontSize: theme.typography.fontSize.sm }}
              >
                {t('aiOnboarding.external.fallback')}
              </Text>
            ) : null}
            <Text
              style={{ color: theme.colors.text.tertiary, fontSize: theme.typography.fontSize.sm }}
            >
              {t('aiOnboarding.external.privacy')}
            </Text>
          </View>

          <View className="gap-3">
            <SectionLabel>{t('aiOnboarding.external.backSection')}</SectionLabel>
            <Button
              label={t('aiOnboarding.external.importFile')}
              icon={FileUp}
              variant="accent"
              width="full"
              onPress={importFile}
            />
            {fileError ? (
              <Text
                style={{ color: theme.colors.status.error, fontSize: theme.typography.fontSize.sm }}
              >
                {fileError}
              </Text>
            ) : null}
            <Button
              label={t('aiOnboarding.external.pasteJson')}
              icon={ClipboardPaste}
              variant="outline"
              width="full"
              onPress={() => {
                setPasteError(null);
                setPasteOpen(true);
              }}
            />
            <Text
              style={{ color: theme.colors.text.tertiary, fontSize: theme.typography.fontSize.sm }}
            >
              {t('aiOnboarding.external.noFile')}
            </Text>
          </View>

          <TextButton label={t(copy.exitKey)} tone="muted" align="center" onPress={goGuided} />
        </View>
      </ScrollView>

      <PasteJsonSheet
        visible={pasteOpen}
        onClose={() => setPasteOpen(false)}
        onSubmit={submitPasted}
        error={pasteError}
      />
    </MasterLayout>
  );
}
