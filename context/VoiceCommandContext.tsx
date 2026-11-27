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

import { useCameraAiProcessing } from '@/components/camera/useCameraAiProcessing';
import { useMealTextEstimate } from '@/components/camera/useMealTextEstimate';
import { useCoach } from '@/components/CoachContext';
import type { LogMealData } from '@/components/modals/LogMealModal';
import {
  VoiceCommandModal,
  type VoiceCommandModalState,
} from '@/components/modals/VoiceCommandModal';
import { HOME_ROUTE, NAV_DESTINATIONS } from '@/components/navigation/navDestinations';
import { useSnackbar } from '@/context/SnackbarContext';
import { useMenstrualCycle } from '@/hooks/useMenstrualCycle';
import { isNavItemAvailable } from '@/hooks/useNavigationItems';
import { useOnDeviceStatus } from '@/hooks/useOnDeviceStatus';
import { useSettings } from '@/hooks/useSettings';
import { useWrongTaskNotice } from '@/hooks/useVoiceActions';
import { logTrackedMeal } from '@/services/trackedMealLogging';
import { interpretVoiceCommand } from '@/services/voiceCommand';
import { AiCancelledError, describeAiError } from '@/utils/aiErrors';
import { aiReadiness } from '@/utils/aiReadiness';
import { formatLocalCalendarDayIso } from '@/utils/calendarDate';
import { AiCreditsError } from '@/utils/coachAI';
import type { VoiceAction, VoiceActionTool, VoiceScreen } from '@/utils/voiceCommand/types';
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
 * so the request, its modal and its outcome live here rather than in the button that was held. A
 * command for a screen is handed to it through the inbox; a weigh-in and a meal are confirmed in
 * sheets of this modal, so they never open over a tab the person has moved to.
 */
export function VoiceCommandProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { showSnackbar } = useSnackbar();
  const { openCoach } = useCoach();
  const { isAiConfigured, aiProvider } = useSettings();
  const onDeviceStatus = useOnDeviceStatus();
  const { isActive: isCycleActive } = useMenstrualCycle();
  const showWrongTaskNotice = useWrongTaskNotice();
  const ai = useCameraAiProcessing();
  const estimateMeal = useMealTextEstimate(ai);
  const ready =
    aiReadiness({ isAiConfigured, aiProvider, onDeviceState: onDeviceStatus.state }) === 'ready';
  const locale = i18n.resolvedLanguage ?? i18n.language;

  const [state, setState] = useState<VoiceCommandModalState | null>(null);
  // Only the newest request may act. Apple's on-device engine cannot be aborted, so a cancelled
  // request can still answer later.
  const generationRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const mealSavedRef = useRef(false);
  const { abandon: abandonEstimate } = ai;

  const abandon = useCallback(() => {
    generationRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    abandonEstimate();
  }, [abandonEstimate]);

  useEffect(() => abandon, [abandon]);

  const close = useCallback(() => {
    abandon();
    setState(null);
  }, [abandon]);

  const showError = useCallback(
    (message: string) => showSnackbar('error', message, { duration: ERROR_SNACKBAR_MS }),
    [showSnackbar]
  );

  const openScreen = useCallback(
    (screen: VoiceScreen) => {
      if (screen === 'home') {
        router.navigate(HOME_ROUTE);

        return;
      }

      const { route } = NAV_DESTINATIONS[screen];
      if (route === null) {
        openCoach();
      } else {
        router.navigate(route);
      }
    },
    [openCoach, router]
  );

  const startMealEstimate = useCallback(
    (transcript: string, action: Extract<VoiceAction, { kind: 'logMeal' }>) => {
      const generation = generationRef.current;
      const isCurrent = () => generation === generationRef.current;
      setState({ kind: 'estimating', transcript });
      void estimateMeal({
        transcript: action.description,
        onEstimate: (review) => {
          if (isCurrent()) {
            mealSavedRef.current = false;
            setState({
              kind: 'mealReview',
              transcript,
              review,
              day: action.day,
              mealType: action.mealType,
            });
          }
        },
        onError: (message) => {
          if (isCurrent()) {
            showError(message);
          }
        },
        onFailure: () => {
          if (isCurrent()) {
            setState(null);
          }
        },
      });
    },
    [estimateMeal, showError]
  );

  const perform = useCallback(
    (transcript: string, action: VoiceAction, offered: VoiceActionTool[]) => {
      switch (action.kind) {
        case 'copyMeal':
        case 'searchFood':
          setState(null);
          setPendingVoiceAction(action);
          router.navigate(NAV_DESTINATIONS.food.route);

          return;
        case 'addNote':
          setState(null);
          setPendingVoiceAction(action);
          router.navigate(NAV_DESTINATIONS.notes.route);

          return;
        case 'goTo':
          // A screen this person does not have is answered like any other misread command.
          if (action.screen !== 'home' && !isNavItemAvailable(action.screen, isCycleActive)) {
            setState({ kind: 'pick', transcript, offered });

            return;
          }

          setState(null);
          openScreen(action.screen);
          showWrongTaskNotice();

          return;
        case 'logWeight':
          setState({ kind: 'weight', transcript, weighIn: action });

          return;
        case 'logMeal':
          startMealEstimate(transcript, action);

          return;
      }
    },
    [isCycleActive, openScreen, router, showWrongTaskNotice, startMealEstimate]
  );

  const submit = useCallback(
    (transcript: string, tool?: VoiceActionTool) => {
      abandon();
      // A command no screen took yet is replaced by this one.
      setPendingVoiceAction(null);
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
            setState({ kind: 'pick', transcript, offered: outcome.offered });

            return;
          }

          if (outcome.kind === 'action') {
            perform(transcript, outcome.action, outcome.offered);

            return;
          }

          setState(null);
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
    [abandon, locale, perform, showError, t]
  );

  const askCoach = useCallback(
    (transcript: string) => {
      close();
      openCoach({ composerText: transcript });
    },
    [close, openCoach]
  );

  const closeWeighIn = useCallback(
    (saved: boolean) => {
      close();
      if (!saved) {
        showWrongTaskNotice();
      }
    },
    [close, showWrongTaskNotice]
  );

  const logMeal = useCallback(
    async ({ date, time, mealType, portionGrams }: LogMealData) => {
      if (state?.kind !== 'mealReview') {
        return;
      }

      await logTrackedMeal({
        ingredients: state.review.ingredients,
        date,
        mealType,
        portionGrams,
        mealName: state.review.meal.name,
        consumedTime: time,
      });
      mealSavedRef.current = true;
      showSnackbar('success', t('voiceInput.command.mealLogged'));
      router.navigate({
        pathname: NAV_DESTINATIONS.food.route,
        params: { date: formatLocalCalendarDayIso(date) },
      });
    },
    [router, showSnackbar, state, t]
  );

  const closeMealReview = useCallback(() => {
    close();
    if (!mealSavedRef.current) {
      showWrongTaskNotice();
    }
  }, [close, showWrongTaskNotice]);

  const value = useMemo(() => ({ ready, submit }), [ready, submit]);

  return (
    <VoiceCommandContext.Provider value={value}>
      {children}
      <VoiceCommandModal
        state={state}
        progress={ai.progress}
        onCancel={close}
        onAskCoach={askCoach}
        onPickTool={submit}
        onWeighInClose={closeWeighIn}
        onLogMeal={logMeal}
        onMealReviewClose={closeMealReview}
      />
    </VoiceCommandContext.Provider>
  );
}

export function useVoiceCommands(): VoiceCommandContextType {
  return useContext(VoiceCommandContext);
}
