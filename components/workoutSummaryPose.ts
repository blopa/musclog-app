import type { LoggyPoseName } from '@/components/LoggyPose';

/** How tall the finished workout's Loggy is drawn on the summary, native and web alike. */
export const SUMMARY_POSE_HEIGHT = 176;

/** A session with a personal record is the trophy; any other finished session is the celebration. */
export function summaryPoseFor(personalRecords: number): LoggyPoseName {
  return personalRecords > 0 ? 'trophy' : 'celebrating';
}
