import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import { type OpenLinkKind, subscribePendingOpenLink, takePendingOpenLink } from '@/utils/openLink';

/**
 * Hands the payload of an open link (`https://musclog.app/open#<kind>=…`) to the screen that owns
 * the matching import. `app/+native-intent.tsx` stores the payload and routes here; this hook is
 * the only consumer.
 *
 * Only the FOCUSED screen takes a payload: on focus it drains whatever is pending (a cold start,
 * or a link that arrived while another screen was showing), and while focused it listens for a
 * link that arrives while the screen is already open. A second copy of the screen lower in the
 * stack therefore never takes it and never opens a modal nobody can see. The payload of the other
 * kind is left pending for its own screen.
 *
 * `onPayload` is read through a ref, so an inline callback does not resubscribe on every render.
 */
export function useOpenLinkHandler(kind: OpenLinkKind, onPayload: (payload: string) => void) {
  const handler = useRef(onPayload);
  useEffect(() => {
    handler.current = onPayload;
  }, [onPayload]);

  useFocusEffect(
    useCallback(() => {
      const drain = () => {
        const link = takePendingOpenLink(kind);
        if (link) {
          handler.current(link.payload);
        }
      };

      drain();
      return subscribePendingOpenLink(drain);
    }, [kind])
  );
}

/** A link's text as a screen hands it to its import modal; `key` re-runs an identical link. */
export type IncomingOpenLink = { text: string; key: number };

/**
 * {@link useOpenLinkHandler} for a screen that owns an import modal: holds the arriving payload as
 * `incoming` (pass it to the modal, clear it on close) and calls `onArrive` so the screen can open
 * the modal. State lives on the screen, above its area lock, so a locked area keeps the payload
 * until the gate lets the modal mount, and the review then opens after unlock.
 */
export function useIncomingOpenLink(kind: OpenLinkKind, onArrive: () => void) {
  const [incoming, setIncoming] = useState<IncomingOpenLink | null>(null);
  const counter = useRef(0);

  const receive = useCallback(
    (text: string) => {
      counter.current += 1;
      setIncoming({ text, key: counter.current });
      onArrive();
    },
    [onArrive]
  );
  useOpenLinkHandler(kind, receive);

  const clearIncoming = useCallback(() => setIncoming(null), []);

  return { incoming, clearIncoming };
}
