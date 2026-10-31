import AsyncStorage from '@react-native-async-storage/async-storage';
import { randomUUID } from 'expo-crypto';
import { AppState, type AppStateStatus } from 'react-native';

import { CHAT_INTENTION_KEY, type ConversationContext } from '@/constants/chat';
import { COACH_REPLY_JOURNAL, COACH_RESTORED_COMPOSER } from '@/constants/misc';
import type ChatMessage from '@/database/models/ChatMessage';
import { AiCustomPromptService } from '@/database/services/AiCustomPromptService';
import { ChatService } from '@/database/services/ChatService';
import i18n from '@/lang/lang';
import {
  type CoachReplyKind,
  emitCoachReplyEvent,
  getActiveCoachReplyId,
  isCoachReplyViewed,
  setActiveCoachReplyId,
  setCoachReplySnapshot,
} from '@/services/coachReplyStore';
import { formatLocalCalendarDayIso } from '@/utils/calendarDate';
import {
  type ChatHistoryEntry,
  type CoachAIConfig,
  type CoachResponse,
  type CoachStream,
  getMealCritique,
  getNutritionInsights,
  getRecentWorkoutInsights,
  getRecentWorkoutsInsights,
  sendCoachMessage,
} from '@/utils/coachAI';
import { readEncryptedJson, writeEncryptedJson } from '@/utils/encryptedJsonStorage';
import { isRecord } from '@/utils/isRecord';
import { createThrottledEmitter } from '@/utils/throttledEmitter';

/**
 * Owns the coach reply that is being written, outside React.
 *
 * `CoachModal` unmounts when it is closed, and a reply must keep arriving (and be saved) when the
 * person closes it; so neither the request nor the saving belongs to `useChatMessages`. The hook
 * only watches: `useCoachReply` for the text so far, `subscribeCoachReplyEvents` for the outcome.
 *
 * What has arrived is also kept in an encrypted journal while the reply is written, so that an
 * app that is closed mid-reply can keep it: `recoverInterruptedCoachReply` runs at the next boot.
 */

/** How often the text reaches the UI. Every token would re-render the chat list per token. */
const UI_EMIT_INTERVAL_MS = 60;
/** How often the text reaches the journal (it is also written the moment the app is backgrounded). */
const JOURNAL_INTERVAL_MS = 1000;
const SUMMARY_LENGTH = 200;

type JobBase = { aiConfig: CoachAIConfig; context: ConversationContext };

/** The messages that exist only because the person sent text, so a failed reply takes them back. */
type SentJobBase = JobBase & {
  /** What the person typed, put back in the composer if the reply fails. */
  text: string;
  userRecord: ChatMessage;
};

export type CoachReplyJob =
  | (SentJobBase & { kind: 'chat'; history: ChatHistoryEntry[] })
  | (SentJobBase & {
      kind: 'analyzeProgress' | 'nutritionCheck';
      startDate: string;
      endDate: string;
      recentConversation: ChatHistoryEntry[];
    })
  | (JobBase & {
      kind: 'mealCritique';
      mealType: string;
      foods: { name: string; gramWeight: number }[];
      totals: { calories: number; protein: number; carbs: number; fat: number };
      userRemarks?: string;
    })
  | (JobBase & { kind: 'workoutFeedback'; workoutLogId: string });

type JobKind = CoachReplyKind;

const CONSUMES_INTENTION: Partial<Record<JobKind, true>> = {
  analyzeProgress: true,
  nutritionCheck: true,
};

// --- Persistence shared with the non-streamed replies ---

/**
 * Saves a coach reply the way every reply is saved: the summary of the person's message, the
 * memory the model asked to keep, then the reply itself with its own summary.
 */
export async function persistCoachReply(params: {
  context: ConversationContext;
  reply: CoachResponse;
  userRecord?: ChatMessage | null;
  payloadJson?: string;
}): Promise<ChatMessage> {
  const { context, reply, userRecord, payloadJson } = params;
  if (reply.sumUserMsg && userRecord) {
    await ChatService.updateMessageSummary(userRecord, reply.sumUserMsg);
  }

  if (reply.rememberMe?.trim()) {
    await AiCustomPromptService.createPrompt(
      `Memory from ${formatLocalCalendarDayIso(new Date())}`,
      reply.rememberMe.trim(),
      true,
      context,
      'memory'
    );
  }

  return ChatService.saveMessage({
    sender: 'coach',
    message: reply.msg4User,
    summarizedMessage: reply.sumMsg,
    payloadJson,
    context,
  });
}

// --- The journal of the reply being written ---

type JournalEntry = {
  jobId: string;
  kind: JobKind;
  context: ConversationContext;
  userRecordId?: string;
  composerText?: string;
  text: string;
  startedAt: number;
};

const CONVERSATION_CONTEXTS_SET = new Set<string>(['general', 'exercise', 'nutrition']);
const JOB_KINDS = new Set<string>([
  'chat',
  'analyzeProgress',
  'nutritionCheck',
  'mealCritique',
  'workoutFeedback',
]);

function parseJournal(value: unknown): JournalEntry | null {
  if (!isRecord(value)) {
    return null;
  }

  const { jobId, kind, context, userRecordId, composerText, text, startedAt } = value;
  if (
    typeof jobId !== 'string' ||
    typeof kind !== 'string' ||
    !JOB_KINDS.has(kind) ||
    typeof context !== 'string' ||
    !CONVERSATION_CONTEXTS_SET.has(context) ||
    typeof text !== 'string' ||
    typeof startedAt !== 'number'
  ) {
    return null;
  }

  return {
    jobId,
    kind: kind as JobKind,
    context: context as ConversationContext,
    userRecordId: typeof userRecordId === 'string' ? userRecordId : undefined,
    composerText: typeof composerText === 'string' ? composerText : undefined,
    text,
    startedAt,
  };
}

// Writes go through one chain so a slow write can never land after a newer one.
let journalWrites: Promise<void> = Promise.resolve();

function queueJournal(entry: JournalEntry | null): Promise<void> {
  journalWrites = journalWrites
    .then(() =>
      entry
        ? writeEncryptedJson(COACH_REPLY_JOURNAL, entry)
        : AsyncStorage.removeItem(COACH_REPLY_JOURNAL)
    )
    .catch((error) => console.warn('[coachReplyStream] journal write failed:', error));

  return journalWrites;
}

// --- Text kept for the composer after a failed reply ---

type RestoredComposer = { context: ConversationContext; text: string };

async function storeRestoredComposer(context: ConversationContext, text: string): Promise<void> {
  const entry: RestoredComposer = { context, text };
  try {
    await writeEncryptedJson(COACH_RESTORED_COMPOSER, entry);
  } catch (error) {
    console.warn('[coachReplyStream] could not keep the message for the composer:', error);
  }
}

/**
 * Takes the text kept for `context`'s composer (once), or null. Text kept for another
 * conversation stays where it is.
 */
export async function consumeRestoredComposerText(
  context: ConversationContext
): Promise<string | null> {
  const stored = await readEncryptedJson(COACH_RESTORED_COMPOSER).catch(() => null);
  if (!isRecord(stored) || typeof stored.text !== 'string') {
    if (stored !== null) {
      await AsyncStorage.removeItem(COACH_RESTORED_COMPOSER);
    }

    return null;
  }

  if (stored.context !== context) {
    return null;
  }

  await AsyncStorage.removeItem(COACH_RESTORED_COMPOSER);

  return stored.text;
}

// --- Running a reply ---

function summaryOf(text: string): string {
  return text.substring(0, SUMMARY_LENGTH);
}

function failureMessage(kind: JobKind): string {
  switch (kind) {
    case 'analyzeProgress':
      return i18n.t('coach.errors.progressInsightFailed');
    case 'nutritionCheck':
      return i18n.t('coach.errors.nutritionInsightFailed');
    case 'mealCritique':
      return i18n.t('food.actions.getMealInsightsError');
    case 'workoutFeedback':
      return i18n.t('workout.summary.failedToGetFeedback');
    default:
      return i18n.t('coach.errors.generalError');
  }
}

async function produce(job: CoachReplyJob, stream: CoachStream): Promise<CoachResponse | null> {
  const asReply = (text: string | null): CoachResponse | null =>
    text?.trim() ? { msg4User: text, sumMsg: summaryOf(text) } : null;

  switch (job.kind) {
    case 'chat':
      return sendCoachMessage(job.aiConfig, job.history, job.text, job.context, stream);
    case 'analyzeProgress':
      return asReply(
        await getRecentWorkoutsInsights(
          job.aiConfig,
          job.startDate,
          job.endDate,
          job.text,
          job.recentConversation,
          job.context,
          stream
        )
      );
    case 'nutritionCheck':
      return asReply(
        await getNutritionInsights(
          job.aiConfig,
          job.startDate,
          job.endDate,
          job.text,
          job.recentConversation,
          job.context,
          stream
        )
      );
    case 'mealCritique':
      return asReply(
        await getMealCritique(
          job.aiConfig,
          job.mealType,
          job.foods,
          job.totals,
          job.userRemarks,
          stream
        )
      );
    case 'workoutFeedback':
      return asReply(await getRecentWorkoutInsights(job.aiConfig, job.workoutLogId, stream));
  }
}

async function clearConsumedIntention(kind: JobKind): Promise<boolean> {
  if (!CONSUMES_INTENTION[kind]) {
    return false;
  }

  await AsyncStorage.removeItem(CHAT_INTENTION_KEY);

  return true;
}

/**
 * Starts a streamed reply. Returns when it has been saved or has failed; callers that only want it
 * to happen do not need to wait. Only one reply is written at a time: ask `isCoachReplyBusy()`.
 */
export function startCoachReply(job: CoachReplyJob): Promise<void> {
  if (getActiveCoachReplyId() !== null) {
    throw new Error('A coach reply is already being written');
  }

  const jobId = randomUUID();
  const startedAt = Date.now();
  setActiveCoachReplyId(jobId);
  setCoachReplySnapshot({ jobId, context: job.context, text: '', startedAt });

  return run(job, jobId, startedAt);
}

async function run(job: CoachReplyJob, jobId: string, startedAt: number): Promise<void> {
  const sent = 'userRecord' in job ? job : null;
  const journalBase: Omit<JournalEntry, 'text'> = {
    jobId,
    kind: job.kind,
    context: job.context,
    userRecordId: sent?.userRecord.id,
    composerText: sent?.text,
    startedAt,
  };
  let received = '';

  const toUi = createThrottledEmitter<string>((text) => {
    if (getActiveCoachReplyId() === jobId) {
      setCoachReplySnapshot({ jobId, context: job.context, text, startedAt });
    }
  }, UI_EMIT_INTERVAL_MS);
  const toJournal = createThrottledEmitter<string>(
    (text) => void queueJournal({ ...journalBase, text }),
    JOURNAL_INTERVAL_MS
  );
  // A backgrounded app may be suspended or killed at any moment: write what there is right now.
  const appStateSubscription = AppState.addEventListener('change', (state: AppStateStatus) => {
    if (state !== 'active') {
      toJournal.flush();
    }
  });

  try {
    await queueJournal({ ...journalBase, text: '' });

    const reply = await produce(job, {
      onText: (text) => {
        received = text;
        toUi.push(text);
        toJournal.push(text);
      },
    });
    toUi.cancel();
    toJournal.cancel();

    if (!reply || !reply.msg4User.trim()) {
      await fail(job, jobId, received, null);
      return;
    }

    const record = await persistCoachReply({
      context: job.context,
      reply,
      userRecord: sent?.userRecord,
    });
    const consumedIntention = await clearConsumedIntention(job.kind);
    await queueJournal(null);
    emitCoachReplyEvent({
      type: 'saved',
      context: job.context,
      record,
      viewed: isCoachReplyViewed(job.context),
      consumedIntention,
    });
  } catch (error) {
    toUi.cancel();
    toJournal.cancel();
    await fail(job, jobId, received, error);
  } finally {
    appStateSubscription.remove();
    if (getActiveCoachReplyId() === jobId) {
      setActiveCoachReplyId(null);
      setCoachReplySnapshot(null);
    }
  }
}

/**
 * The reply did not complete. Seen in the foreground, a half-written reply is taken back like any
 * failed send (nothing of it is saved, the message goes back to the composer). In the background
 * the connection is cut for the same reason it is when the app is killed, so what arrived is kept,
 * exactly as it would be after a kill.
 */
async function fail(
  job: CoachReplyJob,
  jobId: string,
  received: string,
  error: unknown
): Promise<void> {
  const sent = 'userRecord' in job ? job : null;
  if (AppState.currentState !== 'active' && received.trim()) {
    try {
      const record = await persistCoachReply({
        context: job.context,
        reply: { msg4User: received, sumMsg: summaryOf(received) },
      });
      const consumedIntention = await clearConsumedIntention(job.kind);
      await queueJournal(null);
      emitCoachReplyEvent({
        type: 'saved',
        context: job.context,
        record,
        viewed: isCoachReplyViewed(job.context),
        consumedIntention,
      });

      return;
    } catch (saveError) {
      console.warn('[coachReplyStream] could not keep the partial reply:', saveError);
    }
  }

  await queueJournal(null);
  let restoredText: string | undefined;
  if (sent) {
    restoredText = sent.text;
    await ChatService.deleteMessage(sent.userRecord.id).catch(() => undefined);
    await storeRestoredComposer(job.context, sent.text);
  }

  console.warn(`[coachReplyStream] ${job.kind} reply ${jobId} failed`, error);
  emitCoachReplyEvent({
    type: 'failed',
    context: job.context,
    kind: job.kind,
    userRecordId: sent?.userRecord.id,
    restoredText,
    error,
    fallbackMessage: failureMessage(job.kind),
  });
}

// --- Boot recovery ---

/**
 * Finishes what an app that was closed mid-reply left behind. Runs once at boot, when no reply can
 * be live. Text that had arrived is kept as the coach's reply (summary cut from the text itself;
 * the summaries and memory the model writes at the end of its answer never arrived). With nothing
 * received, the message that was sent is taken back and its text kept for the composer.
 */
export async function recoverInterruptedCoachReply(): Promise<void> {
  if (getActiveCoachReplyId() !== null) {
    return;
  }

  const entry = parseJournal(await readEncryptedJson(COACH_REPLY_JOURNAL).catch(() => null));
  if (!entry) {
    await AsyncStorage.removeItem(COACH_REPLY_JOURNAL);

    return;
  }

  try {
    if (entry.text.trim()) {
      // The app can stop between saving the reply and clearing the journal.
      const latest = await ChatService.getMessagesByContext(entry.context, 3);
      const alreadySaved = latest.some(
        (record) =>
          record.sender === 'coach' &&
          record.createdAt >= entry.startedAt &&
          record.message.startsWith(entry.text)
      );
      if (!alreadySaved) {
        const record = await persistCoachReply({
          context: entry.context,
          reply: { msg4User: entry.text, sumMsg: summaryOf(entry.text) },
        });
        const consumedIntention = await clearConsumedIntention(entry.kind);
        emitCoachReplyEvent({
          type: 'saved',
          context: entry.context,
          record,
          viewed: isCoachReplyViewed(entry.context),
          consumedIntention,
        });
      }
    } else if (entry.userRecordId) {
      await ChatService.deleteMessage(entry.userRecordId).catch(() => undefined);
      await storeRestoredComposer(entry.context, entry.composerText ?? '');
    }
  } finally {
    await AsyncStorage.removeItem(COACH_REPLY_JOURNAL);
  }
}
