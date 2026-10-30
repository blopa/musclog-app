import AsyncStorage from '@react-native-async-storage/async-storage';

import { AI_ONBOARDING_DRAFT } from '@/constants/misc';
import {
  deleteAiDraft,
  newDraft,
  parseDraftRecord,
  readAiDraft,
  writeAiDraft,
} from '@/utils/aiOnboarding/draftStorage';
import { MAX_STORED_MESSAGES } from '@/utils/aiOnboarding/chatState';

jest.mock('@/utils/coachAI', () => ({}));
jest.mock('@/database/encryptionHelpers', () => ({
  encryptOptionalString: async (value: string) => `enc:${Buffer.from(value).toString('base64')}`,
  decryptOptionalString: async (cipher: string) =>
    cipher.startsWith('enc:') ? Buffer.from(cipher.slice(4), 'base64').toString() : '',
}));

const today = new Date(2026, 9, 30);

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('AI onboarding draft storage', () => {
  it('stores the session encrypted and reads it back', async () => {
    const draft = {
      ...newDraft('onboarding'),
      path: 'chat' as const,
      provider: 'gemini' as const,
      skipMusclogApi: true,
      composer: 'my weight is',
      answers: { gender: 'female' as const, heightCm: 170 },
      messages: [{ id: '1', role: 'user' as const, text: 'hello', at: 5 }],
    };

    await writeAiDraft(draft);

    const stored = (await AsyncStorage.getItem(AI_ONBOARDING_DRAFT)) ?? '';
    expect(stored).not.toContain('hello');
    expect(stored).not.toContain('170');
    expect(await readAiDraft('onboarding', today)).toMatchObject({
      draftId: draft.draftId,
      path: 'chat',
      provider: 'gemini',
      skipMusclogApi: true,
      composer: 'my weight is',
      answers: { gender: 'female', heightCm: 170 },
      messages: [{ id: '1', role: 'user', text: 'hello' }],
    });
  });

  it('gives every new session its own id', () => {
    expect(newDraft('profile').draftId).not.toBe(newDraft('profile').draftId);
    expect(newDraft('profile')).toMatchObject({ mode: 'profile', messages: [], answers: {} });
  });

  it('has no place for a key: nothing but the provider name is recorded', async () => {
    await writeAiDraft({ ...newDraft('onboarding'), provider: 'openai' });
    const plain = Buffer.from(
      ((await AsyncStorage.getItem(AI_ONBOARDING_DRAFT)) ?? '').slice(4),
      'base64'
    ).toString();

    expect(plain).not.toMatch(/apiKey|api_key|sk-/i);
  });

  it('returns null and removes an entry that is missing, unreadable or the other mode', async () => {
    expect(await readAiDraft('onboarding', today)).toBeNull();

    await AsyncStorage.setItem(AI_ONBOARDING_DRAFT, 'garbage');
    expect(await readAiDraft('onboarding', today)).toBeNull();
    expect(await AsyncStorage.getItem(AI_ONBOARDING_DRAFT)).toBeNull();

    await writeAiDraft(newDraft('profile'));
    expect(await readAiDraft('onboarding', today)).toBeNull();
    expect(await AsyncStorage.getItem(AI_ONBOARDING_DRAFT)).toBeNull();
  });

  it('discards a session that finished applying but was never cleaned up', async () => {
    await writeAiDraft({ ...newDraft('onboarding'), applyState: 'applied' });

    expect(await readAiDraft('onboarding', today)).toBeNull();
    expect(await AsyncStorage.getItem(AI_ONBOARDING_DRAFT)).toBeNull();
  });

  it('keeps a session that was applying, so it can be retried', async () => {
    await writeAiDraft({ ...newDraft('onboarding'), applyState: 'applying' });

    expect((await readAiDraft('onboarding', today))?.applyState).toBe('applying');
  });

  it('caps the stored transcript', async () => {
    const messages = Array.from({ length: MAX_STORED_MESSAGES + 20 }, (_, index) => ({
      id: String(index),
      role: 'user' as const,
      text: 'x',
      at: index,
    }));
    await writeAiDraft({ ...newDraft('onboarding'), messages });

    expect((await readAiDraft('onboarding', today))?.messages).toHaveLength(MAX_STORED_MESSAGES);
  });

  it('deletes', async () => {
    await writeAiDraft(newDraft('onboarding'));
    await deleteAiDraft();

    expect(await AsyncStorage.getItem(AI_ONBOARDING_DRAFT)).toBeNull();
  });
});

describe('parseDraftRecord', () => {
  const base = { v: 1, draftId: 'abc', mode: 'onboarding' };

  it.each([
    null,
    'x',
    [],
    { v: 2, draftId: 'a', mode: 'onboarding' },
    { v: 1, mode: 'onboarding' },
    { v: 1, draftId: 'a', mode: 'other' },
  ])('rejects %j', (raw) => {
    expect(parseDraftRecord(raw, today)).toBeNull();
  });

  it('re-validates the answers and drops unusable fields', () => {
    const record = parseDraftRecord(
      { ...base, answers: { gender: 'robot', heightCm: 170, weightKg: 5000, activityLevel: 4 } },
      today
    );

    expect(record?.answers).toEqual({ heightCm: 170, activityLevel: 4 });
  });

  it('keeps the estimated-birthday flag only next to a birthday', () => {
    expect(
      parseDraftRecord({ ...base, answers: { birthDate: '1990-01-01', dobEstimated: true } }, today)
        ?.answers
    ).toEqual({ birthDate: '1990-01-01', dobEstimated: true });
    expect(parseDraftRecord({ ...base, answers: { dobEstimated: true } }, today)?.answers).toEqual(
      {}
    );
    expect(parseDraftRecord({ ...base, answers: 'nope' }, today)?.answers).toEqual({});
  });

  it('filters malformed messages and unknown providers and paths', () => {
    const record = parseDraftRecord(
      {
        ...base,
        path: 'telepathy',
        provider: 'skynet',
        composer: 7,
        messages: [
          { id: '1', role: 'user', text: 'ok', at: 1, status: 'unanswered' },
          { id: '2', role: 'system', text: 'bad', at: 2 },
          { id: 3, role: 'user', text: 'bad', at: 3 },
          'junk',
        ],
      },
      today
    );

    expect(record).toMatchObject({ path: null, provider: null, composer: '' });
    expect(record?.messages).toEqual([
      { id: '1', role: 'user', text: 'ok', at: 1, status: 'unanswered' },
    ]);
    expect(parseDraftRecord({ ...base, messages: 'no' }, today)?.messages).toEqual([]);
  });

  it('keeps import notes that are well formed and drops the rest', () => {
    const record = parseDraftRecord(
      {
        ...base,
        importNotes: {
          ignoredKeys: ['favouriteFood', 5, 'k'.repeat(200)],
          issues: [
            { field: 'heightCm', code: 'outOfRange', extra: 1 },
            { field: 'nonsense', code: 'invalid' },
            { field: 'gender', code: 'weird' },
          ],
        },
      },
      today
    );

    expect(record?.importNotes?.issues).toEqual([{ field: 'heightCm', code: 'outOfRange' }]);
    expect(record?.importNotes?.ignoredKeys).toEqual(['favouriteFood', 'k'.repeat(60)]);
    expect(
      parseDraftRecord({ ...base, importNotes: { ignoredKeys: [], issues: [] } }, today)
    ).not.toHaveProperty('importNotes');
    expect(parseDraftRecord({ ...base, importNotes: 'x' }, today)).not.toHaveProperty(
      'importNotes'
    );
    expect(
      parseDraftRecord({ ...base, importNotes: { ignoredKeys: 'no', issues: 'no' } }, today)
    ).not.toHaveProperty('importNotes');
  });

  it('caps the number of ignored keys it keeps', () => {
    const keys = Array.from({ length: 50 }, (_, index) => `key${index}`);

    expect(
      parseDraftRecord({ ...base, importNotes: { ignoredKeys: keys, issues: [] } }, today)
        ?.importNotes?.ignoredKeys
    ).toHaveLength(20);
  });

  it('truncates very long text', () => {
    const record = parseDraftRecord(
      {
        ...base,
        composer: 'c'.repeat(9000),
        messages: [{ id: '1', role: 'user', text: 't'.repeat(9000), at: 1 }],
      },
      today
    );

    expect(record?.composer).toHaveLength(4000);
    expect(record?.messages[0].text).toHaveLength(4000);
  });
});
