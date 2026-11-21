import { createListeners } from '@/utils/createListeners';
import type { OpenLink, OpenLinkKind } from '@/utils/openLink';

/**
 * Keeps the payload of the link that opened the app, for the screen it routed to. `app/+native-intent.tsx`
 * stores it and `hooks/useOpenLinkHandler.ts` is the only consumer that takes it.
 */

let pending: OpenLink | null = null;
const { subscribe: subscribePending, notify: notifyPending } = createListeners();

/** The payload of the link that opened the app, kept for the screen it routed to. */
export function setPendingOpenLink(link: OpenLink | null) {
  pending = link;
  notifyPending();
}

/**
 * Calls `listener` whenever a link is stored, so a screen that is already open can pick up a link
 * that arrives while it is showing. {@link takePendingOpenLink} stays the only consumer.
 */
export const subscribePendingOpenLink = subscribePending;

/** Hands the pending payload to its screen exactly once; another kind's payload stays put. */
export function takePendingOpenLink(kind: OpenLinkKind): OpenLink | null {
  if (!pending || pending.kind !== kind) {
    return null;
  }

  const link = pending;
  pending = null;
  return link;
}
