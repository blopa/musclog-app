import * as Clipboard from 'expo-clipboard';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking } from 'react-native';

import { useSnackbar } from '@/context/SnackbarContext';
import { useNativeShareText } from '@/hooks/useNativeShareText';
import type { IncomingOpenLink } from '@/hooks/useOpenLinkHandler';
import { useSubModalVisibility } from '@/hooks/useSubModalVisibility';
import { buildExternalChatUrl, type ExternalTarget } from '@/utils/aiOnboarding/instructions';
import { handleError } from '@/utils/handleError';
import { pickTextFile } from '@/utils/pickTextFile';

/**
 * The wording of one hand-off to ChatGPT or Claude, as whole translation keys (so the translation
 * scanner sees each one). Every caller owns its own table: the setup file, the workout plan and
 * the food log differ in words, not in what the screen does.
 */
export type ExternalHandoffCopy = {
  intro: string;
  steps: readonly [string, string, string];
  leaveSection: string;
  openChatgpt: string;
  openClaude: string;
  copy: string;
  share: string;
  fallback: string;
  privacy: string;
  backSection: string;
  importFile: string;
  pasteJson: string;
  noFile: string;
  /** Snackbar after the instructions were copied and the assistant is opening. */
  copiedPaste: string;
  /** Snackbar after "Copy" alone. */
  copied: string;
  fileRead: string;
  tooLarge: string;
  /** Shown above the hand-off when a tapped link could not be read; takes `{{reason}}`. */
  linkError?: string;
};

type ExternalAssistantImportOptions = {
  /** The instructions to copy. May read settings, so it may be async. */
  buildInstructions: () => string | Promise<string>;
  /** Largest file or pasted document the caller will parse. */
  maxBytes: number;
  /** Reads imported text. Returns the problem to show, or `null` once the text was accepted. */
  accept: (text: string) => string | null | Promise<string | null>;
  copy: Pick<ExternalHandoffCopy, 'copiedPaste' | 'copied' | 'fileRead' | 'tooLarge' | 'linkError'>;
  /** Names the caller in error reports. */
  scope: string;
  /** The parent modal's visibility, so a paste sheet never outlives it. A screen passes `true`. */
  visible: boolean;
  /** The text of a tapped open link; read once per `key`, newest wins. */
  incoming?: IncomingOpenLink | null;
  /** Runs after the instructions were copied and before the assistant opens. */
  onLeave?: () => void | Promise<void>;
};

/**
 * Everything the "leave for ChatGPT or Claude, come back with a file" step does, so the setup
 * file, the workout plan and the food log share it instead of each carrying a copy: copying or
 * sharing the instructions, opening the assistant (a prefilled link is a bonus, the clipboard is
 * what always works), reading a picked file or pasted text through the caller's `accept`, and
 * reading a tapped open link the same way. The caller renders {@link ExternalAssistantHandoff}
 * from what this returns and keeps its own review.
 */
export function useExternalAssistantImport({
  buildInstructions,
  maxBytes,
  accept,
  copy,
  scope,
  visible,
  incoming = null,
  onLeave,
}: ExternalAssistantImportOptions) {
  const { t } = useTranslation();
  const { showSnackbar } = useSnackbar();
  const { shareText } = useNativeShareText();

  const [pasteOpen, setPasteOpen] = useSubModalVisibility(visible);
  const [pasteError, setPasteError] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [fallbackNotice, setFallbackNotice] = useState(false);

  // The latest callbacks, read through refs: the caller builds them inline on every render, and
  // the link effect below must run once per link, not once per render.
  const latest = useRef({ accept, buildInstructions, copy, onLeave });
  useEffect(() => {
    latest.current = { accept, buildInstructions, copy, onLeave };
  });
  const isReading = useRef(false);
  const handledLinkKey = useRef<number | null>(null);

  /** The instructions, or `null` (already reported) when they could not be built. */
  const loadInstructions = useCallback(async (): Promise<string | null> => {
    try {
      return await latest.current.buildInstructions();
    } catch (error) {
      handleError(error, `${scope}.instructions`);
      return null;
    }
  }, [scope]);

  const copyToClipboard = useCallback(
    async (instructions: string): Promise<boolean> => {
      try {
        await Clipboard.setStringAsync(instructions);
        return true;
      } catch (error) {
        handleError(error, `${scope}.copy`);
        return false;
      }
    },
    [scope]
  );

  const open = async (target: ExternalTarget) => {
    setFallbackNotice(false);
    const instructions = await loadInstructions();
    if (instructions === null) {
      setFallbackNotice(true);
      return;
    }

    const copied = await copyToClipboard(instructions);
    await latest.current.onLeave?.();
    if (copied) {
      showSnackbar('success', t(copy.copiedPaste), { duration: 4000 });
    }

    try {
      // A prefilled link is a bonus when it is short enough; the copy above is what always works.
      await Linking.openURL(buildExternalChatUrl(target, instructions).url);
    } catch {
      setFallbackNotice(true);
    }
  };

  const copyOnly = async () => {
    setFallbackNotice(false);
    const instructions = await loadInstructions();
    if (instructions !== null && (await copyToClipboard(instructions))) {
      showSnackbar('success', t(copy.copied));
    } else {
      setFallbackNotice(true);
    }
  };

  const share = async () => {
    const instructions = await loadInstructions();
    if (instructions === null) {
      return;
    }

    try {
      await shareText(instructions);
    } catch (error) {
      handleError(error, `${scope}.share`);
    }
  };

  /** One read at a time: a second tap while the first is still reading does nothing. */
  const acceptText = useCallback(async (text: string): Promise<string | null> => {
    if (isReading.current) {
      return null;
    }

    isReading.current = true;
    try {
      return await latest.current.accept(text);
    } finally {
      isReading.current = false;
    }
  }, []);

  const acceptIncoming = useCallback(
    async (link: IncomingOpenLink) => {
      const problem = await acceptText(link.text);
      const key = latest.current.copy.linkError;
      setLinkError(problem && key ? t(key, { reason: problem }) : null);
    },
    [acceptText, t]
  );

  useEffect(() => {
    if (!visible || !incoming || handledLinkKey.current === incoming.key) {
      return;
    }

    handledLinkKey.current = incoming.key;
    void acceptIncoming(incoming);
  }, [visible, incoming, acceptIncoming]);

  const importFile = async () => {
    setFileError(null);
    setLinkError(null);
    try {
      const picked = await pickTextFile({ maxBytes });
      if (picked.status === 'cancelled') {
        return;
      }

      setFileError(picked.status === 'tooLarge' ? t(copy.tooLarge) : await acceptText(picked.text));
    } catch (error) {
      handleError(error, `${scope}.importFile`);
      setFileError(t(copy.fileRead));
    }
  };

  const submitPasted = async (text: string) => {
    const error = await acceptText(text);
    setPasteError(error);
    if (!error) {
      setPasteOpen(false);
    }
  };

  const openPaste = () => {
    setPasteError(null);
    setLinkError(null);
    setPasteOpen(true);
  };

  /** Clears what the last attempt left on screen; call it when the screen or modal closes. */
  const reset = () => {
    setFileError(null);
    setLinkError(null);
    setFallbackNotice(false);
  };

  return {
    open,
    copyOnly,
    share,
    importFile,
    openPaste,
    reset,
    fileError,
    linkError,
    fallbackNotice,
    /** Spread onto `PasteJsonSheet`; the caller adds any wording of its own. */
    pasteSheetProps: {
      visible: pasteOpen,
      onClose: () => setPasteOpen(false),
      onSubmit: submitPasted,
      error: pasteError,
    },
  };
}
