import { Redirect, useLocalSearchParams } from 'expo-router';

import { WEEKLY_REVIEW_ROUTE } from '@/constants/weeklyReviewRoute';

/**
 * @deprecated The Weekly Review lives at {@link WEEKLY_REVIEW_ROUTE} (`/app/weekly-review`,
 * `app/app/weekly-review.tsx`). This route exists ONLY to forward the old address and is slated
 * for deletion. Do not link to it, add features to it, or build a new URL from it.
 *
 * ## Why it exists
 *
 * The screen used to live at `/app/nutrition/checkin-list`. It reviews training AND nutrition, so it
 * moved out of `/nutrition` (where it highlighted the Food tab even when opened from Workouts).
 * This file keeps anything that still holds the OLD URL from landing on a not-found screen.
 *
 * ## What actually still points here (as of the move)
 *
 * - NOT queued notifications. A scheduled notification stores only `{ type, reviewId | reviewDay |
 *   checkinId }` in its payload (see `NotificationService.scheduleWeeklyReviewNotification`); the URL
 *   is built at TAP time by `handleNotificationNavigation` in `utils/notifications.ts`, which already
 *   uses `WEEKLY_REVIEW_ROUTE`. Notifications scheduled before the move therefore open the new route
 *   directly and never touch this file.
 * - Nothing in the app: every in-app link goes through `WEEKLY_REVIEW_ROUTE`.
 * - Only outside holders of the literal URL: a web bookmark, or a link someone saved or shared.
 *   That is a small, low-value audience, which is why this is safe to remove soon.
 *
 * ## Forwarding behaviour
 *
 * Passes `reviewId`, `reviewDay` and `checkinId` through unchanged so a saved link keeps selecting
 * the same review, day or legacy check-in.
 *
 * ## HOW TO REMOVE IT (do this once a release or two has shipped since the move)
 *
 * Delete, in the same change:
 *   1. THIS FILE: `app/app/nutrition/checkin-list.tsx`.
 *   2. `LEGACY_CHECKIN_ROUTE` in `constants/weeklyReviewRoute.ts`, and the sentence in that file's
 *      doc block that says the old route "survives only as a redirect". (The constant is documentation
 *      only: nothing imports it.)
 *   3. The "Weekly Review screen is `app/app/weekly-review.tsx`..." paragraph in `AGENTS.md` that says
 *      `checkin-list.tsx` is "only a `<Redirect>`... keep it". It then becomes false.
 *   4. The "old links and notifications still open it" clause in `CURRENT_FEATURES.md`.
 *
 * Then check, in this order, that removal is safe:
 *   - `grep -rn "checkin-list" --include=*.ts --include=*.tsx --include=*.md .` finds nothing outside
 *     this file's own history. A hit means something still builds the old URL: fix it to use
 *     `WEEKLY_REVIEW_ROUTE`, do not keep the redirect for it.
 *   - `utils/__tests__/weeklyReviewNotifications.test.ts` still expects `/app/weekly-review...`
 *     (it must not mention the old path).
 *   - Expo Router has no stale route reference (restart Metro; no "unmatched route" warning).
 *
 * Nothing else needs a data migration: no stored setting, database row or AsyncStorage key holds
 * this path.
 */
export default function LegacyCheckinListRedirect() {
  const params = useLocalSearchParams<{
    reviewId?: string;
    reviewDay?: string;
    checkinId?: string;
  }>();
  return <Redirect href={{ pathname: WEEKLY_REVIEW_ROUTE, params }} />;
}
