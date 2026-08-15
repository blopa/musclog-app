/**
 * The "here is what arrived — save it?" screen, and the "saved" screen that replaces it.
 *
 * Every share kind uses the same panel: a preview, then either a progress spinner or the actions
 * that commit it; once `result` exists, a success title, an optional detail line, and Close. Only
 * four things vary per kind, and they are supplied by `SHARE_IMPORT_PANELS` in
 * `components/modals/shareImportPanels.tsx` rather than by a branch here — a day share used to be
 * an 80-line early return in front of a structurally identical food/meal block, which is how the
 * success-title decision ended up implemented twice in one file.
 */

import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

import { Button } from '@/components/theme/Button';
import { ProgressIndicator } from '@/components/theme/ProgressIndicator';
import { useTheme } from '@/hooks/useTheme';

interface ShareImportPanelProps {
  /** The commit actions. Absent while saving, when the spinner takes their place. */
  actions: ReactNode;
  closeLabel: string;
  onClose: () => void;
  preview: ReactNode;
  /** Non-null once the import has committed; switches the panel to its success state. */
  saved?: { detail?: string; title: string };
  savingMessage: string;
  isSaving: boolean;
}

export function ShareImportPanel({
  actions,
  closeLabel,
  isSaving,
  onClose,
  preview,
  saved,
  savingMessage,
}: ShareImportPanelProps) {
  const theme = useTheme();

  if (saved) {
    return (
      <View className="gap-4">
        <Text
          className="text-center text-lg font-bold"
          style={{ color: theme.colors.status.success }}
        >
          {saved.title}
        </Text>
        {saved.detail ? (
          <Text className="text-center text-sm text-text-secondary">{saved.detail}</Text>
        ) : null}
        <Button label={closeLabel} onPress={onClose} size="sm" variant="accent" width="full" />
      </View>
    );
  }

  return (
    <>
      {preview}
      {isSaving ? <ProgressIndicator message={savingMessage} /> : actions}
    </>
  );
}
