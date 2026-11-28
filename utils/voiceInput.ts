/**
 * Hold-to-talk voice input, the part with no React Native in it: which devices may offer it,
 * what the bottom bar's centre button shows, how a hold's speech results add up to one text, and
 * what the person is told when a hold ends. `hooks/useHoldToTranscribe.ts` wires it to
 * `expo-speech-recognition`.
 *
 * On a phone speech is only ever recognized ON the device. Android's on-device recognizer
 * (`SpeechRecognizer.createOnDeviceSpeechRecognizer`) exists from Android 13; below it the library
 * can only ask the default recognizer to *prefer* offline, so the audio could leave the phone. On
 * iOS the patched module (`patches/expo-speech-recognition+*.patch`) refuses a language without an
 * on-device model instead of falling back to Apple's servers.
 *
 * On the web the browser does the recognizing and may send the audio to its maker's servers (Chrome
 * does), so it is offered where the browser has the Web Speech API, behind a one-time notice the
 * person accepts (`utils/browserVoice.ts`).
 */
import type { NavCenterAction } from '@/constants/settings';

/** Android 13 (API 33): the first version with a strictly on-device recognizer. */
export const MIN_ANDROID_ON_DEVICE_SPEECH_API = 33;

/** A hold shorter than this with nothing heard was a tap: the person is told to hold instead. */
export const MIN_VOICE_HOLD_MS = 400;

/**
 * After letting go, the recognizer has this long to deliver its last result and end. Past it the
 * hold is closed with what was heard, so a recognizer that never ends cannot leave the button
 * stuck.
 */
export const VOICE_FINISH_TIMEOUT_MS = 6000;

/** How far up a held finger slides to lock the hold, so it goes on hands-free. */
export const VOICE_LOCK_DISTANCE = 80;

/**
 * How far down it slides to throw the hold away. Shorter than the lock distance because there is
 * little screen under the bottom bar's button.
 */
export const VOICE_CANCEL_DISTANCE = 36;

/**
 * A locked hold goes on when the recognizer ends by itself. This many restarts in a row that hear
 * nothing new end it instead, so a forgotten microphone does not stay on.
 */
export const MAX_LOCKED_SILENT_RESTARTS = 3;

/**
 * A held finger's vertical travel (screen coordinates, negative is up): how far it is towards
 * locking and towards cancelling, each 0..1, and which of the two it has reached.
 */
export type VoiceDrag = { lock: number; cancel: number; action: 'lock' | 'cancel' | null };

export const NO_VOICE_DRAG: VoiceDrag = { lock: 0, cancel: 0, action: null };

/** Progress moves in tenths, so a moving finger re-renders a few times and not on every event. */
const dragProgress = (distance: number, full: number) =>
  Math.floor(Math.min(Math.max(distance / full, 0), 1) * 10) / 10;

export function voiceDrag(dy: number): VoiceDrag {
  const lock = dragProgress(-dy, VOICE_LOCK_DISTANCE);
  const cancel = dragProgress(dy, VOICE_CANCEL_DISTANCE);
  let action: VoiceDrag['action'] = null;

  if (lock === 1) {
    action = 'lock';
  } else if (cancel === 1) {
    action = 'cancel';
  }

  return { lock, cancel, action };
}

/** The two fields of React Native's `Platform` this module reads. */
export type SpeechPlatform = { OS: string; Version: string | number };

/** Whether this browser has the Web Speech API (Chrome, Edge and Safari do; Firefox does not). */
export function browserHasSpeechRecognition(scope: object = globalThis): boolean {
  return 'SpeechRecognition' in scope || 'webkitSpeechRecognition' in scope;
}

/**
 * Whether voice input is offered: on a phone that can recognize speech without the audio leaving
 * it, or in a browser that can recognize speech at all.
 */
export function canOfferVoiceInput(
  { OS, Version }: SpeechPlatform,
  browserScope: object = globalThis
): boolean {
  if (OS === 'web') {
    return browserHasSpeechRecognition(browserScope);
  }

  if (OS === 'ios') {
    return true;
  }

  if (OS === 'android') {
    return Number(Version) >= MIN_ANDROID_ON_DEVICE_SPEECH_API;
  }

  return false;
}

/**
 * What the bottom bar's centre button is: the chosen action when this device can do it, otherwise
 * the camera when there is one, otherwise nothing (the bar then has four tabs). A camera choice on
 * a device without a camera stays empty: it is never swapped for the microphone unasked.
 */
export function resolveNavCenterAction(
  choice: NavCenterAction,
  device: { voiceAvailable: boolean; hasCamera: boolean }
): NavCenterAction | null {
  if (choice === 'voice' && device.voiceAvailable) {
    return 'voice';
  }

  return device.hasCamera ? 'camera' : null;
}

/**
 * What one hold has heard. In continuous recognition every final result is a new segment, and an
 * interim result is the segment still being spoken (`expo-speech-recognition`'s README, "Continuous
 * recognition"), so finals accumulate and the interim replaces itself.
 */
export type Transcript = { readonly finals: readonly string[]; readonly interim: string };

export const EMPTY_TRANSCRIPT: Transcript = { finals: [], interim: '' };

export function applySpeechResult(
  transcript: Transcript,
  result: { text: string; isFinal: boolean }
): Transcript {
  const text = result.text.trim();

  if (!result.isFinal) {
    return { finals: transcript.finals, interim: text };
  }

  // An empty final closes the segment without adding to it; the interim it replaced goes too,
  // since the recognizer decided it was not speech.
  return { finals: text ? [...transcript.finals, text] : transcript.finals, interim: '' };
}

/** Closes the segment being spoken, for a recognizer that is started again mid-hold. */
export function commitInterim(transcript: Transcript): Transcript {
  return transcript.interim
    ? applySpeechResult(transcript, { text: transcript.interim, isFinal: true })
    : transcript;
}

/**
 * Whether a locked hold starts the recognizer again after it ended by itself: nothing but silence
 * went wrong, and it has not been silent for too many restarts in a row.
 */
export function shouldResumeLockedHold(session: {
  failure: VoiceFailure | null;
  silentRestarts: number;
}): boolean {
  const onlySilence = session.failure === null || session.failure === 'nothingHeard';

  return onlySilence && session.silentRestarts < MAX_LOCKED_SILENT_RESTARTS;
}

/** The text heard so far, segments joined by a space. */
export function transcriptText(transcript: Transcript): string {
  return [...transcript.finals, transcript.interim].filter((part) => part.length > 0).join(' ');
}

export const VOICE_FAILURES = [
  'permission',
  'languageMissing',
  'unavailable',
  'nothingHeard',
  'failed',
  /** Web only, and not a fault: what the browser does with the audio, to accept before a hold. */
  'browserNotice',
] as const;
export type VoiceFailure = (typeof VOICE_FAILURES)[number];

/**
 * Failures the person has to act on (allow the microphone, get the language, use another device):
 * they are shown even after a tap, while a tap's incidental error is not.
 */
const BLOCKING_FAILURES: ReadonlySet<VoiceFailure> = new Set([
  'permission',
  'languageMissing',
  'unavailable',
]);

/**
 * What an `error` event's code means to the person. `aborted` is our own cancel (the button went
 * away mid-hold) and means nothing. `network` means the recognizer wanted the internet, which
 * on-device recognition must not and a browser could not reach, so it reads as unavailable.
 */
export function voiceFailureForError(code: string): VoiceFailure | null {
  switch (code) {
    case 'aborted':
      return null;
    case 'not-allowed':
      return 'permission';
    case 'language-not-supported':
      return 'languageMissing';
    case 'service-not-allowed':
    case 'network':
      return 'unavailable';
    case 'no-speech':
    case 'speech-timeout':
      return 'nothingHeard';
    default:
      return 'failed';
  }
}

/** How a finished hold is shown: its text, why there is none, or a "hold it" hint after a tap. */
export type VoiceOutcome =
  | { kind: 'text'; text: string }
  | { kind: 'failure'; failure: VoiceFailure }
  | { kind: 'tooShort' };

/**
 * Anything heard wins, even when the session ended in an error (an interruption mid-sentence
 * keeps the words already recognized). With nothing heard, a blocking failure is shown; a tap is
 * a hint; anything else is the failure or "nothing heard".
 */
export function voiceOutcome(hold: {
  text: string;
  failure: VoiceFailure | null;
  heldMs: number;
}): VoiceOutcome {
  const text = hold.text.trim();

  if (text) {
    return { kind: 'text', text };
  }

  if (hold.failure && BLOCKING_FAILURES.has(hold.failure)) {
    return { kind: 'failure', failure: hold.failure };
  }

  if (hold.heldMs < MIN_VOICE_HOLD_MS) {
    return { kind: 'tooShort' };
  }

  return { kind: 'failure', failure: hold.failure ?? 'nothingHeard' };
}

/** The most of a hold's text the listening overlay shows at once. */
export const VOICE_CAPTION_MAX_CHARS = 220;

/**
 * The overlay's live caption. Long dictation keeps its NEWEST words (what the person is checking
 * as they speak), cut at a word and led by an ellipsis, instead of the opening that a line clamp
 * would keep.
 */
export function voiceCaption(text: string, maxChars: number = VOICE_CAPTION_MAX_CHARS): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxChars) {
    return trimmed;
  }

  const tail = trimmed.slice(trimmed.length - maxChars);
  const space = tail.indexOf(' ');
  const fromWord = space >= 0 && space < tail.length - 1 ? tail.slice(space + 1) : tail;

  return `…${fromWord.trimStart()}`;
}

export type VoiceCaptionSize = 'large' | 'medium' | 'small';

/** A short command reads big; longer dictation steps down so the newest words still fit. */
export function voiceCaptionSize(caption: string): VoiceCaptionSize {
  if (caption.length <= 60) {
    return 'large';
  }

  if (caption.length <= 140) {
    return 'medium';
  }

  return 'small';
}
