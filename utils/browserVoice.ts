import AsyncStorage from '@react-native-async-storage/async-storage';

import { VOICE_BROWSER_NOTICE_ACCEPTED } from '@/constants/misc';
import type { VoiceOutcome } from '@/utils/voiceInput';

/**
 * The web half of voice input. The browser does the speech recognition and some (Chrome) send the
 * audio to their maker's servers, so the person reads that and agrees before the first hold. The
 * answer is device-local and not part of backups.
 */

export async function hasAcceptedBrowserVoice(): Promise<boolean> {
  return (await AsyncStorage.getItem(VOICE_BROWSER_NOTICE_ACCEPTED)) === 'true';
}

export async function acceptBrowserVoice(): Promise<void> {
  await AsyncStorage.setItem(VOICE_BROWSER_NOTICE_ACCEPTED, 'true');
}

/** `null` when the browser cannot say: it then asks when recognition starts. */
async function microphonePermissionState(): Promise<PermissionState | null> {
  try {
    const status = await navigator.permissions?.query({ name: 'microphone' as PermissionName });

    return status?.state ?? null;
  } catch {
    return null;
  }
}

/**
 * Why this hold cannot listen, or `null` when it can. A browser prompt opening under a held button
 * ends the hold, so an undecided microphone is asked for on a hold of its own, which then reads as
 * the "hold it" hint, like the phone's permission dialog.
 */
export async function browserVoiceBlocker(): Promise<VoiceOutcome | null> {
  if (!(await hasAcceptedBrowserVoice())) {
    return { kind: 'failure', failure: 'browserNotice' };
  }

  const permission = await microphonePermissionState();
  if (permission === 'denied') {
    return { kind: 'failure', failure: 'permission' };
  }

  if (permission !== 'prompt') {
    return null;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((track) => track.stop());

    return { kind: 'tooShort' };
  } catch (error) {
    const noMicrophone = error instanceof Error && error.name === 'NotFoundError';

    return { kind: 'failure', failure: noMicrophone ? 'unavailable' : 'permission' };
  }
}
