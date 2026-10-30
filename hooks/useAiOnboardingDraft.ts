import { useCallback, useEffect, useRef, useState } from 'react';

import {
  type AiOnboardingDraftRecord,
  type AiOnboardingMode,
  deleteAiDraft,
  newDraft,
  readAiDraft,
  writeAiDraft,
} from '@/utils/aiOnboarding/draftStorage';

/** How long typing in the composer waits before it is saved. */
export const COMPOSER_SAVE_DELAY_MS = 500;

export type DraftPatch = Partial<
  Omit<AiOnboardingDraftRecord, 'v' | 'draftId' | 'mode' | 'updatedAt'>
>;

export type AiOnboardingDraftApi = {
  loading: boolean;
  /** Null only while loading. A session that was never saved is a fresh, unsaved record. */
  draft: AiOnboardingDraftRecord | null;
  /** True when this session was read back from storage, so the hub can offer to resume it. */
  hasSaved: boolean;
  update: (patch: DraftPatch) => Promise<void>;
  /** Composer text is saved after a short pause rather than on every keystroke. */
  setComposer: (text: string) => void;
  startOver: () => Promise<AiOnboardingDraftRecord>;
  /** Stops all further writes, once the session has been applied or deliberately dropped. */
  discard: () => void;
};

/** A draft API whose session has been read, so `draft` is there to use. */
export type LoadedAiDraftApi = AiOnboardingDraftApi & { draft: AiOnboardingDraftRecord };

export const isDraftLoaded = (api: AiOnboardingDraftApi): api is LoadedAiDraftApi =>
  !api.loading && api.draft !== null;

/**
 * The saved AI-setup session for a mode: transcript, composer text and answers so far. Writes are
 * serialised so a late composer save can never overwrite a newer update, and `discard` ends them
 * for good, so a finished session is not resurrected by a pending write.
 */
export function useAiOnboardingDraft(mode: AiOnboardingMode): AiOnboardingDraftApi {
  const [state, setState] = useState<{
    loading: boolean;
    draft: AiOnboardingDraftRecord | null;
    hasSaved: boolean;
  }>({ loading: true, draft: null, hasSaved: false });
  const draftRef = useRef<AiOnboardingDraftRecord | null>(null);
  const writes = useRef<Promise<void>>(Promise.resolve());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const discarded = useRef(false);

  const persist = useCallback((record: AiOnboardingDraftRecord) => {
    writes.current = writes.current
      .then(() => (discarded.current ? undefined : writeAiDraft(record)))
      .catch((error) => console.warn('Failed to save the AI setup draft', error));
    return writes.current;
  }, []);

  const clearTimer = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    discarded.current = false;
    readAiDraft(mode).then((saved) => {
      if (cancelled) {
        return;
      }

      const draft = saved ?? newDraft(mode);
      draftRef.current = draft;
      setState({ loading: false, draft, hasSaved: saved !== null });
    });

    return () => {
      cancelled = true;
      // A pause that was still counting down is saved now rather than lost.
      if (timer.current && draftRef.current) {
        clearTimeout(timer.current);
        timer.current = null;
        void persist(draftRef.current);
      }
    };
  }, [mode, persist]);

  const update = useCallback(
    async (patch: DraftPatch) => {
      if (!draftRef.current || discarded.current) {
        return;
      }

      const next = { ...draftRef.current, ...patch };
      draftRef.current = next;
      setState((previous) => ({ ...previous, draft: next }));
      clearTimer();
      await persist(next);
    },
    [clearTimer, persist]
  );

  const setComposer = useCallback(
    (text: string) => {
      if (!draftRef.current || discarded.current) {
        return;
      }

      const next = { ...draftRef.current, composer: text };
      draftRef.current = next;
      setState((previous) => ({ ...previous, draft: next }));
      clearTimer();
      timer.current = setTimeout(() => {
        timer.current = null;
        void persist(next);
      }, COMPOSER_SAVE_DELAY_MS);
    },
    [clearTimer, persist]
  );

  const startOver = useCallback(async () => {
    clearTimer();
    await writes.current;
    await deleteAiDraft();
    const fresh = newDraft(mode);
    discarded.current = false;
    draftRef.current = fresh;
    setState({ loading: false, draft: fresh, hasSaved: false });
    return fresh;
  }, [clearTimer, mode]);

  const discard = useCallback(() => {
    clearTimer();
    discarded.current = true;
  }, [clearTimer]);

  return { ...state, update, setComposer, startOver, discard };
}
