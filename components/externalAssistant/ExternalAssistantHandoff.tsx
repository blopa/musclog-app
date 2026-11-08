import { ClipboardPaste, Copy, FileUp, Share2 } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { Button } from '@/components/theme/Button';
import { SectionLabel } from '@/components/theme/SectionLabel';
import type {
  ExternalHandoffCopy,
  useExternalAssistantImport,
} from '@/hooks/useExternalAssistantImport';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { useTheme } from '@/hooks/useTheme';

type ExternalAssistantHandoffProps = {
  copy: ExternalHandoffCopy;
  handoff: ReturnType<typeof useExternalAssistantImport>;
  /** Anything that belongs under the two sections, such as a way out. */
  children?: ReactNode;
};

/**
 * The step where the person leaves for ChatGPT or Claude and comes back with a file: what will
 * happen, the ways to take the instructions along, and the ways to bring the result back. The
 * behaviour is `useExternalAssistantImport`; the words are the caller's {@link ExternalHandoffCopy}.
 * The paste sheet is not drawn here: it is a modal, and the caller keeps it beside this view.
 */
export function ExternalAssistantHandoff({ copy, handoff, children }: ExternalAssistantHandoffProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { formatInteger } = useFormatAppNumber();
  const { fontSize } = theme.typography;

  return (
    <View className="gap-6 px-4 pb-12 pt-4">
      <View className="gap-2">
        <Text style={{ color: theme.colors.text.secondary, fontSize: fontSize.base }}>
          {t(copy.intro)}
        </Text>
        {copy.steps.map((key, index) => (
          <Text key={key} style={{ color: theme.colors.text.primary, fontSize: fontSize.base }}>
            {`${formatInteger(index + 1)}. ${t(key)}`}
          </Text>
        ))}
      </View>

      {handoff.linkError ? (
        <Text style={{ color: theme.colors.status.error, fontSize: fontSize.sm }}>
          {handoff.linkError}
        </Text>
      ) : null}

      <View className="gap-3">
        <SectionLabel>{t(copy.leaveSection)}</SectionLabel>
        <Button
          label={t(copy.openChatgpt)}
          variant="accent"
          width="full"
          onPress={() => handoff.open('chatgpt')}
        />
        <Button
          label={t(copy.openClaude)}
          variant="accent"
          width="full"
          onPress={() => handoff.open('claude')}
        />
        <View className="flex-row flex-wrap gap-3">
          <Button
            label={t(copy.copy)}
            icon={Copy}
            variant="outline"
            size="sm"
            width="flex-1"
            onPress={handoff.copyOnly}
          />
          <Button
            label={t(copy.share)}
            icon={Share2}
            variant="outline"
            size="sm"
            width="flex-1"
            onPress={handoff.share}
          />
        </View>
        {handoff.fallbackNotice ? (
          <Text style={{ color: theme.colors.status.error, fontSize: fontSize.sm }}>
            {t(copy.fallback)}
          </Text>
        ) : null}
        <Text style={{ color: theme.colors.text.tertiary, fontSize: fontSize.sm }}>
          {t(copy.privacy)}
        </Text>
      </View>

      <View className="gap-3">
        <SectionLabel>{t(copy.backSection)}</SectionLabel>
        <Button
          label={t(copy.importFile)}
          icon={FileUp}
          variant="accent"
          width="full"
          onPress={handoff.importFile}
        />
        {handoff.fileError ? (
          <Text style={{ color: theme.colors.status.error, fontSize: fontSize.sm }}>
            {handoff.fileError}
          </Text>
        ) : null}
        <Button
          label={t(copy.pasteJson)}
          icon={ClipboardPaste}
          variant="outline"
          width="full"
          onPress={handoff.openPaste}
        />
        <Text style={{ color: theme.colors.text.tertiary, fontSize: fontSize.sm }}>
          {t(copy.noFile)}
        </Text>
      </View>

      {children}
    </View>
  );
}
