import * as Haptics from 'expo-haptics';
import type {
  ExpoSpeechRecognitionErrorEvent,
  ExpoSpeechRecognitionNativeEventMap,
  ExpoSpeechRecognitionResultEvent,
} from 'expo-speech-recognition';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform } from 'react-native';

import { useSnackbar } from '@/context/SnackbarContext';
import { acceptBrowserVoice, browserVoiceBlocker } from '@/utils/browserVoice';
import { handleError } from '@/utils/handleError';
import {
  applySpeechResult,
  commitInterim,
  EMPTY_TRANSCRIPT,
  shouldResumeLockedHold,
  type Transcript,
  transcriptText,
  VOICE_FINISH_TIMEOUT_MS,
  type VoiceFailure,
  voiceFailureForError,
  type VoiceOutcome,
  voiceOutcome,
} from '@/utils/voiceInput';
import {
  createVoiceLevelMeter,
  normalizeVoiceVolume,
  speechBurstLevel,
  VOICE_LEVEL_INTERVAL_MS,
  type VoiceLevelMeter,
} from '@/utils/voiceLevel';

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
  /** The hold goes on without a finger on the button, until a press on it or `cancel`. */
  locked: boolean;
  /** What this hold has heard so far, for a live caption; empty outside a hold. */
  liveText: string;
  /**
   * The microphone level of the running hold, for a waveform: measured on a phone, one burst per
   * recognized result on the web (`utils/voiceLevel.ts`). Stable for the hook's lifetime and reset
   * at every session start; reading it never re-renders.
   */
  level: VoiceLevelMeter;
  /** The last hold's text or failure, until `dismissOutcome`. */
  outcome: HoldToTranscribeOutcome | null;
  /** Starts a hold; on a locked one, finishes it. */
  onPressIn: () => void;
  /** Finishes the hold, unless it is locked. */
  onPressOut: () => void;
  /** Keeps the running hold going after the finger leaves. */
  lock: () => void;
  /** Throws the running hold away: no text, no outcome. */
  cancel: () => void;
  dismissOutcome: () => void;
  /** Android only: asks the system to download the speech model for the app's language. */
  downloadLanguage: () => Promise<void>;
  /** Web only: accepts the notice about the browser doing the speech recognition. */
  allowBrowserRecognition: () => Promise<void>;
};

/** One press of the button: when it happened and the recognition session it started, if any. */
type Hold = {
  pressedAt: number;
  releasedAt: number | null;
  locked: boolean;
  session: Session | null;
};

type Session = {
  speech: SpeechModule;
  transcript: Transcript;
  failure: VoiceFailure | null;
  /** The last error code, kept only to report an unexpected failure (never any speech). */
  errorCode: string | null;
  started: boolean;
  /** For a locked hold's restarts: what was heard when the recognizer last started. */
  textAtStart: string;
  silentRestarts: number;
  subscriptions: { remove: () => void }[];
  finishTimer: ReturnType<typeof setTimeout> | null;
};

export type HoldToTranscribeOptions = {
  /**
   * Takes a successful transcript instead of the transcript modal. Returning `true` means the
   * caller handled it (`outcome` stays null); `false` falls back to showing it. Failures and
   * too-short taps never reach it. Read through a ref, so a new function identity is harmless.
   */
  onText?: (text: string) => boolean;
};

/**
 * Hold-to-talk speech to text in the app's language: recognized on the device on a phone, by the
 * browser on the web.
 *
 * One hold is one recognition session: press-in checks permission and availability, then starts
 * continuous recognition; letting go stops it and the final text (or why there is none) becomes
 * `outcome`, unless `options.onText` takes the text. A hold can also be locked, which keeps it
 * listening (restarting a recognizer that ends by itself) until the next press, or cancelled.
 * Listeners exist only while this instance's
 * session runs, so the copies of the bottom bar that hidden tabs keep mounted never react to
 * another bar's session. The pure rules (results into one text, error codes into failures, a tap
 * into a hint) are `utils/voiceInput.ts`.
 */
export function useHoldToTranscribe(options?: HoldToTranscribeOptions): HoldToTranscribe {
  const { t, i18n } = useTranslation();
  const { showSnackbar } = useSnackbar();
  const locale = i18n.resolvedLanguage ?? i18n.language;

  const [phase, setPhase] = useState<HoldToTranscribePhase>('idle');
  const [liveText, setLiveText] = useState('');
  const [locked, setLocked] = useState(false);
  const [outcome, setOutcome] = useState<HoldToTranscribeOutcome | null>(null);
  /** The whole of a hold's mutable state; `phase` only mirrors it for rendering. */
  const holdRef = useRef<Hold | null>(null);
  const onTextRef = useRef<HoldToTranscribeOptions['onText']>(options?.onText);
  const [level] = useState(createVoiceLevelMeter);

  useEffect(() => {
    onTextRef.current = options?.onText;
  }, [options?.onText]);

  /**
   * A hold that is no longer the current one (unmounted, or replaced) must not touch state after an
   * await. Read it after EVERY await in `prepare`.
   */
  const isStale = useCallback((hold: Hold) => holdRef.current !== hold, []);

  const endHold = useCallback(
    (result: VoiceOutcome) => {
      holdRef.current = null;
      setPhase('idle');
      setLiveText('');
      setLocked(false);
      if (result.kind === 'tooShort') {
        showSnackbar('success', t('voiceInput.holdHint'));
        return;
      }

      const takenByCaller = result.kind === 'text' && onTextRef.current?.(result.text) === true;
      if (!takenByCaller) {
        setOutcome(result);
      }
    },
    [showSnackbar, t]
  );

  /**
   * Drops the session's listeners and timer and returns it; the caller decides what the hold
   * became.
   */
  const closeSession = useCallback((hold: Hold): Session | null => {
    const { session } = hold;
    if (!session) {
      return null;
    }

    session.subscriptions.forEach((subscription) => subscription.remove());
    session.subscriptions = [];
    if (session.finishTimer) {
      clearTimeout(session.finishTimer);
      session.finishTimer = null;
    }

    hold.session = null;

    return session;
  }, []);

  const finishSession = useCallback(
    (session: Session) => {
      const hold = holdRef.current;
      if (hold?.session !== session) {
        return;
      }

      closeSession(hold);
      const result = voiceOutcome({
        text: transcriptText(session.transcript),
        failure: session.failure,
        heldMs: (hold.releasedAt ?? Date.now()) - hold.pressedAt,
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

  /**
   * The recognizer did not end in time: the hold closes with what was heard. A result that arrives
   * after this is deliberately ignored, because the session's listeners are removed first.
   */
  const abandonSession = useCallback(
    (session: Session) => {
      finishSession(session);
      session.speech.abort();
    },
    [finishSession]
  );

  const startSession = useCallback(
    (hold: Hold, speech: SpeechModule) => {
      const session: Session = {
        speech,
        transcript: EMPTY_TRANSCRIPT,
        failure: null,
        errorCode: null,
        started: false,
        textAtStart: '',
        silentRestarts: 0,
        subscriptions: [],
        finishTimer: null,
      };

      // A listener of a session that was closed, or of a hold that is over, does nothing.
      const isLive = () => holdRef.current?.session === session;
      // A browser reports no level: there the waveform shows recognized speech arriving instead.
      const measuresLevel = Platform.OS !== 'web';
      level.reset();

      const recognize = () =>
        speech.start({
          lang: locale,
          interimResults: true,
          // Keeps listening through pauses until the person lets go (Android 13+, iOS).
          continuous: true,
          requiresOnDeviceRecognition: true,
          addsPunctuation: true,
          maxAlternatives: 1,
          iosTaskHint: 'dictation',
          // Drives the overlay's waveform; the level is read on the device and goes nowhere else.
          volumeChangeEventOptions: {
            enabled: measuresLevel,
            intervalMillis: VOICE_LEVEL_INTERVAL_MS,
          },
        });

      // A recognizer ends by itself after a silence or a time limit. A locked hold goes on.
      const resume = (): boolean => {
        if (!hold.locked || hold.releasedAt !== null) {
          return false;
        }

        session.transcript = commitInterim(session.transcript);
        const heard = transcriptText(session.transcript);
        session.silentRestarts = heard === session.textAtStart ? session.silentRestarts + 1 : 0;
        if (!shouldResumeLockedHold(session)) {
          return false;
        }

        session.textAtStart = heard;
        session.failure = null;
        session.errorCode = null;
        session.started = false;
        try {
          recognize();
        } catch (error) {
          void handleError(error, 'voiceInput.resume', { showSnackbar: false });
          return false;
        }

        return true;
      };

      session.subscriptions = [
        speech.addListener('start', () => {
          if (!isLive()) {
            return;
          }

          session.started = true;
          // Let go before the recognizer was ready: stop now that it can be stopped.
          if (hold.releasedAt !== null) {
            speech.stop();
          } else {
            setPhase('listening');
          }
        }),
        speech.addListener('result', (event: ExpoSpeechRecognitionResultEvent) => {
          if (!isLive()) {
            return;
          }

          const heard = transcriptText(session.transcript);
          session.transcript = applySpeechResult(session.transcript, {
            text: event.results[0]?.transcript ?? '',
            isFinal: event.isFinal,
          });
          const text = transcriptText(session.transcript);
          if (!measuresLevel) {
            level.push(speechBurstLevel(heard, text));
          }

          setLiveText(text);
        }),
        speech.addListener('error', (event: ExpoSpeechRecognitionErrorEvent) => {
          if (!isLive()) {
            return;
          }

          const failure = voiceFailureForError(event.error);
          if (failure) {
            session.failure = failure;
            session.errorCode = event.error;
          }
        }),
        speech.addListener('end', () => {
          if (isLive() && !resume()) {
            finishSession(session);
          }
        }),
      ];
      if (measuresLevel) {
        session.subscriptions.push(
          speech.addListener(
            'volumechange',
            (event: ExpoSpeechRecognitionNativeEventMap['volumechange']) => {
              if (isLive()) {
                level.push(normalizeVoiceVolume(event.value));
              }
            }
          )
        );
      }

      hold.session = session;

      recognize();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    },
    [finishSession, level, locale]
  );

  const prepare = useCallback(
    async (hold: Hold) => {
      try {
        const speech = loadSpeechModule();
        if (Platform.OS === 'web') {
          const blocker = await browserVoiceBlocker();
          if (isStale(hold)) {
            return;
          }

          if (blocker) {
            endHold(blocker);
            return;
          }
        } else {
          let permission = await speech.getPermissionsAsync();
          if (isStale(hold)) {
            return;
          }

          if (!permission.granted) {
            if (!permission.canAskAgain) {
              endHold({ kind: 'failure', failure: 'permission' });
              return;
            }

            permission = await speech.requestPermissionsAsync();
            if (isStale(hold)) {
              return;
            }

            // The system dialog took the finger off the button, so this hold is over either way:
            // allowed, the person is told to hold again.
            endHold(
              permission.granted ? { kind: 'tooShort' } : { kind: 'failure', failure: 'permission' }
            );
            return;
          }
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
        if (isStale(hold)) {
          return;
        }

        if (hold.releasedAt !== null) {
          endHold({ kind: 'tooShort' });
          return;
        }

        startSession(hold, speech);
      } catch (error) {
        closeSession(hold);

        void handleError(error, 'voiceInput.start', { showSnackbar: false });
        if (!isStale(hold)) {
          endHold({ kind: 'failure', failure: 'failed' });
        }
      }
    },
    [closeSession, endHold, isStale, startSession]
  );

  /** The end of a hold's speaking: the recognizer is stopped and asked for its last result. */
  const release = useCallback(
    (hold: Hold) => {
      hold.releasedAt = Date.now();
      const { session } = hold;
      if (!session) {
        // Still preparing: `prepare` sees the release and ends the hold.
        return;
      }

      setPhase('finishing');
      if (session.started) {
        session.speech.stop();
      }

      session.finishTimer = setTimeout(() => {
        if (holdRef.current?.session === session) {
          abandonSession(session);
        }
      }, VOICE_FINISH_TIMEOUT_MS);
    },
    [abandonSession]
  );

  const onPressIn = useCallback(() => {
    const current = holdRef.current;
    if (current) {
      // A press on a locked hold finishes it. Otherwise one hold at a time: a press while the last
      // one is still finishing is ignored.
      if (current.locked && current.releasedAt === null) {
        release(current);
      }

      return;
    }

    const hold: Hold = { pressedAt: Date.now(), releasedAt: null, locked: false, session: null };
    holdRef.current = hold;
    setOutcome(null);
    setLocked(false);
    setPhase('preparing');
    void prepare(hold);
  }, [prepare, release]);

  const onPressOut = useCallback(() => {
    const hold = holdRef.current;
    if (!hold || hold.locked || hold.releasedAt !== null) {
      return;
    }

    release(hold);
  }, [release]);

  const lock = useCallback(() => {
    const hold = holdRef.current;
    if (!hold || hold.locked || hold.releasedAt !== null) {
      return;
    }

    hold.locked = true;
    setLocked(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  }, []);

  const cancel = useCallback(() => {
    const hold = holdRef.current;
    if (!hold) {
      return;
    }

    holdRef.current = null;
    closeSession(hold)?.speech.abort();
    setPhase('idle');
    setLiveText('');
    setLocked(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  }, [closeSession]);

  useEffect(
    () => () => {
      const hold = holdRef.current;
      holdRef.current = null;
      if (hold) {
        closeSession(hold)?.speech.abort();
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

  const allowBrowserRecognition = useCallback(async () => {
    setOutcome(null);
    try {
      await acceptBrowserVoice();
      showSnackbar('success', t('voiceInput.holdHint'));
    } catch (error) {
      void handleError(error, 'voiceInput.acceptBrowserNotice');
    }
  }, [showSnackbar, t]);

  return {
    phase,
    locked,
    liveText,
    level,
    outcome,
    onPressIn,
    onPressOut,
    lock,
    cancel,
    dismissOutcome,
    downloadLanguage,
    allowBrowserRecognition,
  };
}
