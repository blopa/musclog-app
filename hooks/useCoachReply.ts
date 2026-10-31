import { useSyncExternalStore } from 'react';

import {
  type CoachReplySnapshot,
  getCoachReplySnapshot,
  subscribeCoachReply,
} from '@/services/coachReplyStore';

/** The coach reply being written right now (any conversation), or null. */
export function useCoachReply(): CoachReplySnapshot | null {
  return useSyncExternalStore(subscribeCoachReply, getCoachReplySnapshot, getCoachReplySnapshot);
}
