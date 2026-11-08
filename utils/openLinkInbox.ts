import type { OpenLink, OpenLinkKind } from '@/utils/openLink';

/**
 * Keeps the payload of the link that opened the app, for the screen it routed to. `app/+native-intent.tsx`
 * stores it and `hooks/useOpenLinkHandler.ts` is the only consumer that takes it.
 */

let pending: OpenLink | null = null;
const pendingListeners = new Set<() => void>();

/** The payload of the link that opened the app, kept for the screen it routed to. */
export function setPendingOpenLink(link: OpenLink | null) {
  pending = link;
  pendingListeners.forEach((listener) => listener());
}

/**
 * Calls `listener` whenever a link is stored, so a screen that is already open can pick up a link
 * that arrives while it is showing. {@link takePendingOpenLink} stays the only consumer.
 */
export function subscribePendingOpenLink(listener: () => void): () => void {
  pendingListeners.add(listener);
  return () => {
    pendingListeners.delete(listener);
  };
}

/** Hands the pending payload to its screen exactly once; another kind's payload stays put. */
export function takePendingOpenLink(kind: OpenLinkKind): OpenLink | null {
  if (!pending || pending.kind !== kind) {
    return null;
  }

  const link = pending;
  pending = null;
  return link;
}
