import type { ConversationContext } from '@/constants/chat';
import type ChatMessage from '@/database/models/ChatMessage';

/**
 * What the app can observe about the coach reply being written: its text so far, and how it ended.
 * Kept apart from `coachReplyStream` (which runs the request and talks to the database) so the
 * parts that only watch — the chat hook, the unread counter — do not load all of that.
 */

export type CoachReplyKind =
  'chat' | 'analyzeProgress' | 'nutritionCheck' | 'mealCritique' | 'workoutFeedback';

export type CoachReplySnapshot = {
  jobId: string;
  context: ConversationContext;
  /** The visible text so far; empty while the model has not started to answer. */
  text: string;
  startedAt: number;
};

export type CoachReplyEvent =
  | {
      type: 'saved';
      context: ConversationContext;
      record: ChatMessage;
      /** True when a chat for this conversation is on screen, which then adds the message itself. */
      viewed: boolean;
      /** The reply used up the armed intention (it was removed from storage). */
      consumedIntention: boolean;
    }
  | {
      type: 'failed';
      context: ConversationContext;
      kind: CoachReplyKind;
      /** The message sent for this reply was taken back (deleted); its text is in `restoredText`. */
      userRecordId?: string;
      restoredText?: string;
      /** The error to describe to the person, or null when the model simply produced nothing. */
      error: unknown;
      fallbackMessage: string;
    };

let snapshot: CoachReplySnapshot | null = null;
let activeJobId: string | null = null;
const snapshotListeners = new Set<() => void>();
const eventListeners = new Set<(event: CoachReplyEvent) => void>();
const viewers = new Map<ConversationContext, number>();

export function setCoachReplySnapshot(next: CoachReplySnapshot | null) {
  snapshot = next;
  snapshotListeners.forEach((listener) => listener());
}

export function subscribeCoachReply(listener: () => void): () => void {
  snapshotListeners.add(listener);

  return () => {
    snapshotListeners.delete(listener);
  };
}

export function getCoachReplySnapshot(): CoachReplySnapshot | null {
  return snapshot;
}

export function getActiveCoachReplyId(): string | null {
  return activeJobId;
}

export function setActiveCoachReplyId(jobId: string | null) {
  activeJobId = jobId;
}

/** Only one reply is written at a time. */
export function isCoachReplyBusy(): boolean {
  return activeJobId !== null;
}

export function subscribeCoachReplyEvents(listener: (event: CoachReplyEvent) => void): () => void {
  eventListeners.add(listener);

  return () => {
    eventListeners.delete(listener);
  };
}

export function emitCoachReplyEvent(event: CoachReplyEvent) {
  eventListeners.forEach((listener) => listener(event));
}

/** A chat for `context` is on screen; a reply saved for it is added there instead of counted as unread. */
export function registerCoachReplyViewer(context: ConversationContext): () => void {
  viewers.set(context, (viewers.get(context) ?? 0) + 1);

  return () => {
    viewers.set(context, Math.max(0, (viewers.get(context) ?? 1) - 1));
  };
}

export function isCoachReplyViewed(context: ConversationContext): boolean {
  return (viewers.get(context) ?? 0) > 0;
}
