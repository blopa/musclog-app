import AsyncStorage from '@react-native-async-storage/async-storage';
import { randomUUID } from 'expo-crypto';

import { AI_ONBOARDING_DRAFT } from '@/constants/misc';
import { type ChatMessage, MAX_STORED_MESSAGES } from '@/utils/aiOnboarding/chatState';
import {
  FIELD_KEYS,
  type FieldIssue,
  type OnboardingAnswersDraft,
  sanitizeDraft,
} from '@/utils/aiOnboarding/contract';
import type { CoachAIProvider } from '@/utils/coachAI';
import { readEncryptedJson, writeEncryptedJson } from '@/utils/encryptedJsonStorage';
import { isRecord } from '@/utils/isRecord';

export type AiOnboardingMode = 'onboarding' | 'profile';
export type AiOnboardingPath = 'chat' | 'external' | 'import';
export type AiApplyState = 'applying' | 'applied';

/** What an imported file contained that the review should point out. */
export type ImportNotes = {
  /** Keys the contract does not know; they were ignored, never applied. */
  ignoredKeys: string[];
  /** Answers in the file that were rejected, so the review can highlight them. */
  issues: FieldIssue[];
};

const MAX_IGNORED_KEYS = 20;
const MAX_IGNORED_KEY_CHARS = 60;

/**
 * The one saved AI-setup session: transcript, composer text and the answers so far. It lives in
 * its own encrypted AsyncStorage entry and never in `chat_messages`, so it can not appear in the
 * coach's history. It never contains an API key: the provider is recorded by name only.
 */
export type AiOnboardingDraftRecord = {
  v: 1;
  draftId: string;
  mode: AiOnboardingMode;
  path: AiOnboardingPath | null;
  provider: CoachAIProvider | null;
  /** True once the person chose free AI or saved their own key, so the Musclog AI step is skipped. */
  skipMusclogApi: boolean;
  messages: ChatMessage[];
  composer: string;
  answers: OnboardingAnswersDraft;
  importNotes?: ImportNotes;
  applyState?: AiApplyState;
  updatedAt: number;
};

const PROVIDERS: readonly CoachAIProvider[] = [
  'gemini',
  'openai',
  'claude',
  'on-device',
  'local',
  'gateway',
];
const PATHS: readonly AiOnboardingPath[] = ['chat', 'external', 'import'];
const MAX_MESSAGE_CHARS = 4000;
const MAX_COMPOSER_CHARS = 4000;

function parseImportNotes(raw: unknown): ImportNotes | undefined {
  if (!isRecord(raw)) {
    return undefined;
  }

  const ignoredKeys = Array.isArray(raw.ignoredKeys)
    ? raw.ignoredKeys
        .filter((key): key is string => typeof key === 'string')
        .slice(0, MAX_IGNORED_KEYS)
        .map((key) => key.slice(0, MAX_IGNORED_KEY_CHARS))
    : [];
  const issues = Array.isArray(raw.issues)
    ? raw.issues.filter(
        (issue): issue is FieldIssue =>
          isRecord(issue) &&
          (FIELD_KEYS as readonly unknown[]).includes(issue.field) &&
          (issue.code === 'invalid' || issue.code === 'outOfRange')
      )
    : [];

  return ignoredKeys.length > 0 || issues.length > 0
    ? { ignoredKeys, issues: issues.map(({ field, code }) => ({ field, code })) }
    : undefined;
}

function parseMessages(raw: unknown): ChatMessage[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const messages: ChatMessage[] = [];
  for (const item of raw) {
    if (
      isRecord(item) &&
      typeof item.id === 'string' &&
      (item.role === 'user' || item.role === 'assistant') &&
      typeof item.text === 'string' &&
      typeof item.at === 'number'
    ) {
      messages.push({
        id: item.id,
        role: item.role,
        text: item.text.slice(0, MAX_MESSAGE_CHARS),
        at: item.at,
        ...(item.status === 'unanswered' ? { status: 'unanswered' as const } : {}),
      });
    }
  }

  return messages.slice(-MAX_STORED_MESSAGES);
}

/** Reads a stored record field by field; null when it is not a usable session. */
export function parseDraftRecord(raw: unknown, today: Date): AiOnboardingDraftRecord | null {
  if (
    !isRecord(raw) ||
    raw.v !== 1 ||
    typeof raw.draftId !== 'string' ||
    (raw.mode !== 'onboarding' && raw.mode !== 'profile')
  ) {
    return null;
  }

  const importNotes = parseImportNotes(raw.importNotes);

  return {
    v: 1,
    draftId: raw.draftId,
    mode: raw.mode,
    path: PATHS.includes(raw.path as AiOnboardingPath) ? (raw.path as AiOnboardingPath) : null,
    provider: PROVIDERS.includes(raw.provider as CoachAIProvider)
      ? (raw.provider as CoachAIProvider)
      : null,
    skipMusclogApi: raw.skipMusclogApi === true,
    messages: parseMessages(raw.messages),
    composer: typeof raw.composer === 'string' ? raw.composer.slice(0, MAX_COMPOSER_CHARS) : '',
    answers: sanitizeDraft(raw.answers, today),
    ...(importNotes ? { importNotes } : {}),
    ...(raw.applyState === 'applying' || raw.applyState === 'applied'
      ? { applyState: raw.applyState }
      : {}),
    updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : 0,
  };
}

export function newDraft(mode: AiOnboardingMode): AiOnboardingDraftRecord {
  return {
    v: 1,
    draftId: randomUUID(),
    mode,
    path: null,
    provider: null,
    skipMusclogApi: false,
    messages: [],
    composer: '',
    answers: {},
    updatedAt: Date.now(),
  };
}

export async function deleteAiDraft(): Promise<void> {
  await AsyncStorage.removeItem(AI_ONBOARDING_DRAFT);
}

/**
 * The saved session for this mode, or null. A session that cannot be read, belongs to the other
 * mode, or finished applying (the app was closed before it was cleaned up) is removed instead of
 * being offered for resuming.
 */
export async function readAiDraft(
  mode: AiOnboardingMode,
  today: Date = new Date()
): Promise<AiOnboardingDraftRecord | null> {
  const record = parseDraftRecord(await readEncryptedJson(AI_ONBOARDING_DRAFT), today);
  if (!record || record.mode !== mode || record.applyState === 'applied') {
    await deleteAiDraft();
    return null;
  }

  return record;
}

export async function writeAiDraft(record: AiOnboardingDraftRecord): Promise<void> {
  await writeEncryptedJson(AI_ONBOARDING_DRAFT, {
    ...record,
    messages: record.messages.slice(-MAX_STORED_MESSAGES),
    updatedAt: Date.now(),
  });
}
