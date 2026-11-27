import { useRouter } from 'expo-router';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';

import { useCoach } from '@/components/CoachContext';
import {
  VoiceCommandModal,
  type VoiceCommandModalState,
} from '@/components/modals/VoiceCommandModal';
import { NAV_DESTINATIONS } from '@/components/navigation/navDestinations';
import { useSnackbar } from '@/context/SnackbarContext';
import { useOnDeviceStatus } from '@/hooks/useOnDeviceStatus';
import { useSettings } from '@/hooks/useSettings';
import { interpretVoiceCommand } from '@/services/voiceCommand';
import { AiCancelledError, describeAiError } from '@/utils/aiErrors';
import { aiReadiness } from '@/utils/aiReadiness';
import { AiCreditsError } from '@/utils/coachAI';
import type { VoiceActionTool } from '@/utils/voiceCommand/types';
import { setPendingVoiceAction } from '@/utils/voiceCommand/voiceActionInbox';

type VoiceCommandContextType = {
  /** Whether a spoken sentence can be turned into an action right now. */
  ready: boolean;
  submit: (transcript: string) => void;
};

/** Without a provider (a component rendered on its own) voice stays a plain transcript. */
const VoiceCommandContext = createContext<VoiceCommandContextType>({
  ready: false,
  submit: () => {},
});

const ERROR_SNACKBAR_MS = 4000;
const FAILED_MESSAGE = { messageKey: 'voiceInput.command.failed' };

/**
 * The one owner of a voice command, mounted once: each tab keeps its own copy of the bottom bar,
 * so the request, its modal and its outcome live here rather than in the button that was held.
 */
export function VoiceCommandProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { showSnackbar } = useSnackbar();
  const { openCoach } = useCoach();
  const { isAiConfigured, aiProvider } = useSettings();
  const onDeviceStatus = useOnDeviceStatus();
  const ready =
    aiReadiness({ isAiConfigured, aiProvider, onDeviceState: onDeviceStatus.state }) === 'ready';
  const locale = i18n.resolvedLanguage ?? i18n.language;

  const [state, setState] = useState<VoiceCommandModalState | null>(null);
  // Only the newest request may act. Apple's on-device engine cannot be aborted, so a cancelled
  // request can still answer later.
  const generationRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  const abandon = useCallback(() => {
    generationRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  useEffect(() => abandon, [abandon]);

  const close = useCallback(() => {
    abandon();
    setState(null);
  }, [abandon]);

  const showError = useCallback(
    (message: string) => showSnackbar('error', message, { duration: ERROR_SNACKBAR_MS }),
    [showSnackbar]
  );

  const submit = useCallback(
    (transcript: string, tool?: VoiceActionTool) => {
      abandon();
      const generation = generationRef.current;
      const controller = new AbortController();
      abortRef.current = controller;
      setState({ kind: 'working', transcript });

      const run = async () => {
        try {
          const outcome = await interpretVoiceCommand(transcript, {
            signal: controller.signal,
            tool,
          });
          if (generation !== generationRef.current) {
            return;
          }

          // Whatever the reason, the person says what they meant and it is tried again.
          if (outcome.kind === 'rejected') {
            setState({ kind: 'pick', transcript });
            return;
          }

          setState(null);
          if (outcome.kind === 'action') {
            setPendingVoiceAction(outcome.action);
            router.navigate(NAV_DESTINATIONS.food.route);
            return;
          }

          showError(t(FAILED_MESSAGE.messageKey));
        } catch (error) {
          if (generation !== generationRef.current) {
            return;
          }

          setState(null);
          if (error instanceof AiCancelledError) {
            return;
          }

          showError(
            describeAiError(error, (key, options) => t(key, options) as string, locale) ??
              (error instanceof AiCreditsError ? error.message : t(FAILED_MESSAGE.messageKey))
          );
        }
      };

      void run();
    },
    [abandon, locale, router, showError, t]
  );

  const askCoach = useCallback(
    (transcript: string) => {
      close();
      openCoach({ composerText: transcript });
    },
    [close, openCoach]
  );

  const value = useMemo(() => ({ ready, submit }), [ready, submit]);

  return (
    <VoiceCommandContext.Provider value={value}>
      {children}
      <VoiceCommandModal state={state} onCancel={close} onAskCoach={askCoach} onPickTool={submit} />
    </VoiceCommandContext.Provider>
  );
}

export function useVoiceCommands(): VoiceCommandContextType {
  return useContext(VoiceCommandContext);
}
