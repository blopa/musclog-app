import * as Haptics from 'expo-haptics';
import type {
  ExpoSpeechRecognitionErrorEvent,
  ExpoSpeechRecognitionResultEvent,
} from 'expo-speech-recognition';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform } from 'react-native';

import { useSnackbar } from '@/context/SnackbarContext';
import { handleError } from '@/utils/handleError';
import {
  applySpeechResult,
  EMPTY_TRANSCRIPT,
  type Transcript,
  transcriptText,
  VOICE_FINISH_TIMEOUT_MS,
  type VoiceFailure,
  voiceFailureForError,
  type VoiceOutcome,
  voiceOutcome,
} from '@/utils/voiceInput';

type SpeechModule = (typeof import('expo-speech-recognition'))['ExpoSpeechRecognitionModule'];

/**
 * The recognizer is loaded on the first hold, never at import: a bar that shows the camera, and
 * every Jest suite that renders the bar, never touches the native module.
 */
function loadSpeechModule(): SpeechModule {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod: typeof import('expo-speech-recognition') = require('expo-speech-recognition');
  return mod.ExpoSpeechRecognitionModule;
}

export type HoldToTranscribePhase = 'idle' | 'preparing' | 'listening' | 'finishing';

/** What the person is shown once a hold ends; a tap's "hold it" hint is a snackbar instead. */
export type HoldToTranscribeOutcome = Exclude<VoiceOutcome, { kind: 'tooShort' }>;

export type HoldToTranscribe = {
  /** `preparing` covers permission and availability checks, `finishing` the wait for the last result. */
  phase: HoldToTranscribePhase;
  /** What this hold has heard so far, for a live caption; empty outside a hold. */
  liveText: string;
  /** The last hold's text or failure, until `dismissOutcome`. */
  outcome: HoldToTranscribeOutcome | null;
  onPressIn: () => void;
  onPressOut: () => void;
  dismissOutcome: () => void;
  /** Android only: asks the system to download the speech model for the app's language. */
  downloadLanguage: () => Promise<void>;
};

type Hold = { pressedAt: number; releasedAt: number | null };

type Session = {
  speech: SpeechModule;
  transcript: Transcript;
  failure: VoiceFailure | null;
  /** The last error code, kept only to report an unexpected failure (never any speech). */
  errorCode: string | null;
  started: boolean;
  subscriptions: { remove: () => void }[];
  finishTimer: ReturnType<typeof setTimeout> | null;
};

/**
 * Hold-to-talk speech to text, recognized on the device in the app's language.
 *
 * One hold is one recognition session: press-in checks permission and availability, then starts
 * continuous recognition; letting go stops it and the final text (or why there is none) becomes
 * `outcome`. Listeners exist only while this instance's session runs, so the copies of the bottom
 * bar that hidden tabs keep mounted never react to another bar's session. The pure rules (results
 * into one text, error codes into failures, a tap into a hint) are `utils/voiceInput.ts`.
 */
export function useHoldToTranscribe(): HoldToTranscribe {
  const { t, i18n } = useTranslation();
  const { showSnackbar } = useSnackbar();
  const locale = i18n.resolvedLanguage ?? i18n.language;

  const [phase, setPhase] = useState<HoldToTranscribePhase>('idle');
  const [liveText, setLiveText] = useState('');
  const [outcome, setOutcome] = useState<HoldToTranscribeOutcome | null>(null);
  const holdRef = useRef<Hold | null>(null);
  const sessionRef = useRef<Session | null>(null);

  const endHold = useCallback(
    (result: VoiceOutcome) => {
      holdRef.current = null;
      setPhase('idle');
      setLiveText('');
      if (result.kind === 'tooShort') {
        showSnackbar('success', t('voiceInput.holdHint'));
      } else {
        setOutcome(result);
      }
    },
    [showSnackbar, t]
  );

  /** Drops the session's listeners and timer; the caller decides what the hold became. */
  const closeSession = useCallback((session: Session) => {
    session.subscriptions.forEach((subscription) => subscription.remove());
    session.subscriptions = [];
    if (session.finishTimer) {
      clearTimeout(session.finishTimer);
      session.finishTimer = null;
    }

    if (sessionRef.current === session) {
      sessionRef.current = null;
    }
  }, []);

  const finishSession = useCallback(
    (session: Session) => {
      if (sessionRef.current !== session) {
        return;
      }

      closeSession(session);
      const hold = holdRef.current;
      const now = Date.now();
      const result = voiceOutcome({
        text: transcriptText(session.transcript),
        failure: session.failure,
        heldMs: (hold?.releasedAt ?? now) - (hold?.pressedAt ?? now),
      });

      if (result.kind === 'failure' && result.failure === 'failed') {
        // Tags only: the code says which recognizer path failed; nothing that was said is sent.
        void handleError(
          new Error(`speech-recognition-${session.errorCode ?? 'unknown'}`),
          'voiceInput.recognition',
          { showSnackbar: false }
        );
      }

      endHold(result);
    },
    [closeSession, endHold]
  );

  const startSession = useCallback(
    (speech: SpeechModule) => {
      const session: Session = {
        speech,
        transcript: EMPTY_TRANSCRIPT,
        failure: null,
        errorCode: null,
        started: false,
        subscriptions: [],
        finishTimer: null,
      };

      session.subscriptions = [
        speech.addListener('start', () => {
          if (sessionRef.current !== session) {
            return;
          }

          session.started = true;
          // Let go before the recognizer was ready: stop now that it can be stopped.
          if (holdRef.current?.releasedAt != null) {
            speech.stop();
          } else {
            setPhase('listening');
          }
        }),
        speech.addListener('result', (event: ExpoSpeechRecognitionResultEvent) => {
          if (sessionRef.current !== session) {
            return;
          }

          session.transcript = applySpeechResult(session.transcript, {
            text: event.results[0]?.transcript ?? '',
            isFinal: event.isFinal,
          });
          setLiveText(transcriptText(session.transcript));
        }),
        speech.addListener('error', (event: ExpoSpeechRecognitionErrorEvent) => {
          if (sessionRef.current !== session) {
            return;
          }

          const failure = voiceFailureForError(event.error);
          if (failure) {
            session.failure = failure;
            session.errorCode = event.error;
          }
        }),
        speech.addListener('end', () => finishSession(session)),
      ];
      sessionRef.current = session;

      speech.start({
        lang: locale,
        interimResults: true,
        // Keeps listening through pauses until the person lets go (Android 13+, iOS).
        continuous: true,
        requiresOnDeviceRecognition: true,
        addsPunctuation: true,
        maxAlternatives: 1,
        iosTaskHint: 'dictation',
      });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    },
    [finishSession, locale]
  );

  const prepare = useCallback(
    async (hold: Hold) => {
      try {
        const speech = loadSpeechModule();
        let permission = await speech.getPermissionsAsync();

        if (!permission.granted) {
          if (!permission.canAskAgain) {
            endHold({ kind: 'failure', failure: 'permission' });
            return;
          }

          permission = await speech.requestPermissionsAsync();
          if (holdRef.current !== hold) {
            return;
          }

          // The system dialog took the finger off the button, so this hold is over either way:
          // allowed, the person is told to hold again.
          endHold(
            permission.granted ? { kind: 'tooShort' } : { kind: 'failure', failure: 'permission' }
          );
          return;
        }

        if (
          !speech.isRecognitionAvailable() ||
          // Android's on-device recognizer can be missing (no speech services installed).
          // iOS answers per language when recognition starts (the patched module refuses a
          // language without an on-device model), so it is not asked here.
          (Platform.OS === 'android' && !speech.supportsOnDeviceRecognition())
        ) {
          endHold({ kind: 'failure', failure: 'unavailable' });
          return;
        }

        // Unmounted, or another hold took over, while the checks ran.
        if (holdRef.current !== hold) {
          return;
        }

        if (hold.releasedAt !== null) {
          endHold({ kind: 'tooShort' });
          return;
        }

        startSession(speech);
      } catch (error) {
        const session = sessionRef.current;
        if (session) {
          closeSession(session);
        }

        void handleError(error, 'voiceInput.start', { showSnackbar: false });
        if (holdRef.current === hold) {
          endHold({ kind: 'failure', failure: 'failed' });
        }
      }
    },
    [closeSession, endHold, startSession]
  );

  const onPressIn = useCallback(() => {
    // One hold at a time: a press while the last one is still finishing is ignored.
    if (holdRef.current || sessionRef.current) {
      return;
    }

    const hold: Hold = { pressedAt: Date.now(), releasedAt: null };
    holdRef.current = hold;
    setOutcome(null);
    setPhase('preparing');
    void prepare(hold);
  }, [prepare]);

  const onPressOut = useCallback(() => {
    const hold = holdRef.current;
    if (!hold || hold.releasedAt !== null) {
      return;
    }

    hold.releasedAt = Date.now();
    const session = sessionRef.current;
    if (!session) {
      // Still preparing: `prepare` sees the release and ends the hold.
      return;
    }

    setPhase('finishing');
    if (session.started) {
      session.speech.stop();
    }

    session.finishTimer = setTimeout(() => {
      if (sessionRef.current !== session) {
        return;
      }

      finishSession(session);
      session.speech.abort();
    }, VOICE_FINISH_TIMEOUT_MS);
  }, [finishSession]);

  useEffect(
    () => () => {
      const session = sessionRef.current;
      holdRef.current = null;
      if (session) {
        closeSession(session);
        session.speech.abort();
      }
    },
    [closeSession]
  );

  const dismissOutcome = useCallback(() => setOutcome(null), []);

  const downloadLanguage = useCallback(async () => {
    setOutcome(null);
    try {
      const { status } = await loadSpeechModule().androidTriggerOfflineModelDownload({ locale });
      if (status === 'download_success') {
        showSnackbar('success', t('voiceInput.downloadDone'));
      } else if (status === 'download_scheduled') {
        showSnackbar('success', t('voiceInput.downloadScheduled'));
      }
      // 'opened_dialog' (Android 13): the system's own dialog tells the person what happens.
    } catch (error) {
      void handleError(error, 'voiceInput.downloadLanguage', {
        snackbarMessage: t('voiceInput.downloadFailed'),
      });
    }
  }, [locale, showSnackbar, t]);

  return {
    phase,
    liveText,
    outcome,
    onPressIn,
    onPressOut,
    dismissOutcome,
    downloadLanguage,
  };
}
