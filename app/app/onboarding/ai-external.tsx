import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native';

import { PasteJsonSheet } from '@/components/aiOnboarding/PasteJsonSheet';
import { ExternalAssistantHandoff } from '@/components/externalAssistant/ExternalAssistantHandoff';
import { MasterLayout } from '@/components/MasterLayout';
import { ScreenHeader } from '@/components/theme/ScreenHeader';
import { TextButton } from '@/components/theme/TextButton';
import { useAiSetupSession } from '@/hooks/useAiSetupSession';
import {
  EMPTY_IMPORT_ERROR_KEY,
  type ExternalHandoffCopy,
  SHARED_HANDOFF_COPY,
  useExternalAssistantImport,
} from '@/hooks/useExternalAssistantImport';
import { MAX_CONTRACT_BYTES } from '@/utils/aiOnboarding/contract';
import { type ContractParseError, parseContractText } from '@/utils/aiOnboarding/contractParse';
import { buildExternalInstructions } from '@/utils/aiOnboarding/instructions';

/** What the person is told for each way an imported file can be unusable. */
const IMPORT_ERROR_KEYS: Record<ContractParseError, string> = {
  empty: EMPTY_IMPORT_ERROR_KEY,
  tooLarge: 'aiOnboarding.external.errors.tooLarge',
  notJson: 'aiOnboarding.external.errors.notJson',
  notAnObject: 'aiOnboarding.external.errors.notJson',
  wrongSchema: 'aiOnboarding.external.errors.wrongSchema',
  invalidVersion: 'aiOnboarding.external.errors.wrongSchema',
  newerVersion: 'aiOnboarding.external.errors.newerVersion',
};

const HANDOFF_COPY: ExternalHandoffCopy = {
  ...SHARED_HANDOFF_COPY,
  intro: 'aiOnboarding.external.intro',
  steps: [
    'aiOnboarding.external.steps.one',
    'aiOnboarding.external.steps.two',
    'aiOnboarding.external.steps.three',
  ],
  backSection: 'aiOnboarding.external.backSection',
  importFile: 'aiOnboarding.external.importFile',
  noFile: 'aiOnboarding.external.noFile',
  tooLarge: IMPORT_ERROR_KEYS.tooLarge,
};

/**
 * The hand-off to ChatGPT or Claude and the way back. Leaving is explained first; the instructions
 * are always copied, because neither service documents a link that fills its chat box. Coming back
 * is by file or by pasted text, both validated here exactly as an in-app answer would be.
 */
export default function AiExternalScreen() {
  const { t, i18n } = useTranslation();
  const { copy, draftApi, goGuided, go } = useAiSetupSession();

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

  const handoff = useExternalAssistantImport({
    buildInstructions: () =>
      buildExternalInstructions({ language: i18n.resolvedLanguage ?? i18n.language }),
    maxBytes: MAX_CONTRACT_BYTES,
    accept,
    copy: HANDOFF_COPY,
    scope: 'AiExternalScreen',
    visible: true,
    onLeave: () => draftApi.update({ path: 'external' }),
  });

  return (
    <MasterLayout showNavigationMenu={false}>
      <ScreenHeader title={t('aiOnboarding.external.title')} />
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <ExternalAssistantHandoff copy={HANDOFF_COPY} handoff={handoff}>
          <TextButton label={t(copy.exitKey)} tone="muted" align="center" onPress={goGuided} />
        </ExternalAssistantHandoff>
      </ScrollView>

      <PasteJsonSheet {...handoff.pasteSheetProps} />
    </MasterLayout>
  );
}
