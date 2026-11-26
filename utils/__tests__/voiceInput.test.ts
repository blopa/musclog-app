import {
  EMPTY_TRANSCRIPT,
  MIN_VOICE_HOLD_MS,
  applySpeechResult,
  canRecognizeSpeechOnDevice,
  resolveNavCenterAction,
  transcriptText,
  voiceFailureForError,
  voiceOutcome,
} from '@/utils/voiceInput';
import { SETTINGS } from '@/constants/settingDefinitions';
import { parseNavCenterAction } from '@/constants/settings';

describe('canRecognizeSpeechOnDevice', () => {
  it('allows iOS for any version', () => {
    expect(canRecognizeSpeechOnDevice({ OS: 'ios', Version: '17.0' })).toBe(true);
    expect(canRecognizeSpeechOnDevice({ OS: 'ios', Version: 9 })).toBe(true);
  });

  it.each([33, 34, '33'])('allows Android %p (13+)', (Version) => {
    expect(canRecognizeSpeechOnDevice({ OS: 'android', Version })).toBe(true);
  });

  it.each([32, 26, '32'])('refuses Android %p (below 13)', (Version) => {
    expect(canRecognizeSpeechOnDevice({ OS: 'android', Version })).toBe(false);
  });

  it.each(['web', 'windows', 'macos'])('refuses %s', (OS) => {
    expect(canRecognizeSpeechOnDevice({ OS, Version: '1' })).toBe(false);
  });
});

describe('resolveNavCenterAction', () => {
  it('shows voice when chosen and available, with or without a camera', () => {
    expect(resolveNavCenterAction('voice', { voiceAvailable: true, hasCamera: true })).toBe(
      'voice'
    );
    expect(resolveNavCenterAction('voice', { voiceAvailable: true, hasCamera: false })).toBe(
      'voice'
    );
  });

  it('falls back to the camera when voice is unavailable and a camera exists', () => {
    expect(resolveNavCenterAction('voice', { voiceAvailable: false, hasCamera: true })).toBe(
      'camera'
    );
  });

  it('shows nothing when voice is unavailable and there is no camera', () => {
    expect(resolveNavCenterAction('voice', { voiceAvailable: false, hasCamera: false })).toBeNull();
  });

  it('shows the camera when chosen and a camera exists', () => {
    expect(resolveNavCenterAction('camera', { voiceAvailable: true, hasCamera: true })).toBe(
      'camera'
    );
  });

  it('never swaps a camera choice for the microphone when there is no camera', () => {
    expect(resolveNavCenterAction('camera', { voiceAvailable: true, hasCamera: false })).toBeNull();
  });
});

describe('applySpeechResult and transcriptText', () => {
  it('replaces the interim with the next interim', () => {
    let transcript = applySpeechResult(EMPTY_TRANSCRIPT, { text: '  how ', isFinal: false });
    expect(transcript).toEqual({ finals: [], interim: 'how' });
    transcript = applySpeechResult(transcript, { text: 'how are', isFinal: false });
    expect(transcript).toEqual({ finals: [], interim: 'how are' });
  });

  it('appends a trimmed final and clears the interim', () => {
    const start = { finals: ['hello'], interim: 'there' };
    const next = applySpeechResult(start, { text: ' hello there ', isFinal: true });
    expect(next).toEqual({ finals: ['hello', 'hello there'], interim: '' });
  });

  it('adds nothing for an empty or whitespace final and clears the interim', () => {
    const start = { finals: ['hello'], interim: 'maybe' };
    expect(applySpeechResult(start, { text: '', isFinal: true })).toEqual({
      finals: ['hello'],
      interim: '',
    });
    expect(applySpeechResult(start, { text: '   ', isFinal: true })).toEqual({
      finals: ['hello'],
      interim: '',
    });
  });

  it('joins finals then interim with single spaces, skipping empty parts', () => {
    expect(transcriptText({ finals: ['hello there'], interim: 'how are' })).toBe(
      'hello there how are'
    );
    expect(transcriptText({ finals: ['', 'one', 'two'], interim: '' })).toBe('one two');
    expect(transcriptText(EMPTY_TRANSCRIPT)).toBe('');
  });

  it('does not mutate the input transcript', () => {
    const start = { finals: ['a'], interim: 'b' };
    const snapshot = JSON.parse(JSON.stringify(start));
    applySpeechResult(start, { text: 'c', isFinal: true });
    applySpeechResult(start, { text: 'd', isFinal: false });
    expect(start).toEqual(snapshot);
  });
});

describe('voiceFailureForError', () => {
  it.each([
    ['aborted', null],
    ['not-allowed', 'permission'],
    ['language-not-supported', 'languageMissing'],
    ['service-not-allowed', 'unavailable'],
    ['network', 'unavailable'],
    ['no-speech', 'nothingHeard'],
    ['speech-timeout', 'nothingHeard'],
    ['audio-capture', 'failed'],
    ['interrupted', 'failed'],
    ['bad-grammar', 'failed'],
    ['busy', 'failed'],
    ['client', 'failed'],
    ['too-many-requests', 'failed'],
    ['unknown', 'failed'],
    ['something-new', 'failed'],
  ])('maps %p to %p', (code, expected) => {
    expect(voiceFailureForError(code)).toBe(expected);
  });
});

describe('voiceOutcome', () => {
  const long = MIN_VOICE_HOLD_MS;

  it('shows any non-blank text trimmed, even with a failure or a short hold', () => {
    expect(voiceOutcome({ text: '  hi there ', failure: null, heldMs: long })).toEqual({
      kind: 'text',
      text: 'hi there',
    });
    expect(voiceOutcome({ text: 'hi', failure: 'failed', heldMs: 0 })).toEqual({
      kind: 'text',
      text: 'hi',
    });
    expect(voiceOutcome({ text: 'hi', failure: 'permission', heldMs: 0 })).toEqual({
      kind: 'text',
      text: 'hi',
    });
  });

  it.each(['permission', 'languageMissing', 'unavailable'] as const)(
    'shows the blocking failure %s even for a zero hold',
    (failure) => {
      expect(voiceOutcome({ text: '', failure, heldMs: 0 })).toEqual({
        kind: 'failure',
        failure,
      });
    }
  );

  it.each(['failed', 'nothingHeard', null] as const)(
    'treats a short blank hold with %p as a tap',
    (failure) => {
      expect(voiceOutcome({ text: '  ', failure, heldMs: MIN_VOICE_HOLD_MS - 1 })).toEqual({
        kind: 'tooShort',
      });
    }
  );

  it('reports a failure for a long blank hold', () => {
    expect(voiceOutcome({ text: '', failure: 'failed', heldMs: MIN_VOICE_HOLD_MS * 3 })).toEqual({
      kind: 'failure',
      failure: 'failed',
    });
  });

  it('reports nothingHeard for a long blank hold with no failure', () => {
    expect(voiceOutcome({ text: '', failure: null, heldMs: MIN_VOICE_HOLD_MS * 3 })).toEqual({
      kind: 'failure',
      failure: 'nothingHeard',
    });
  });

  it('counts exactly the minimum hold as long', () => {
    expect(voiceOutcome({ text: '', failure: null, heldMs: MIN_VOICE_HOLD_MS })).toEqual({
      kind: 'failure',
      failure: 'nothingHeard',
    });
  });
});

describe('parseNavCenterAction and SETTINGS.navCenterAction', () => {
  it('parses known values and falls back to the camera', () => {
    expect(parseNavCenterAction('voice')).toBe('voice');
    expect(parseNavCenterAction('camera')).toBe('camera');
    expect(parseNavCenterAction('')).toBe('camera');
    expect(parseNavCenterAction('VOICE')).toBe('camera');
    expect(parseNavCenterAction('mic')).toBe('camera');
    expect(parseNavCenterAction(null)).toBe('camera');
    expect(parseNavCenterAction(undefined)).toBe('camera');
  });

  it('defaults to the camera with the nav_center_action key', () => {
    expect(SETTINGS.navCenterAction.defaultValue).toBe('camera');
    expect(SETTINGS.navCenterAction.type).toBe('nav_center_action');
  });

  it('round-trips voice through serialize and parse', () => {
    const raw = SETTINGS.navCenterAction.serialize('voice');
    expect(SETTINGS.navCenterAction.parse(raw)).toBe('voice');
  });
});
