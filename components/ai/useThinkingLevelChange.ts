import { useCallback } from 'react';

import type { AiProviderKind } from '@/constants/ai';
import { useSubModalState } from '@/hooks/useSubModalVisibility';
import {
  providerAllowsThinking,
  type ThinkingLevel,
  thinkingLevelChangeGate,
} from '@/utils/aiThinkingLevel';
import { authenticateForDangerousAction } from '@/utils/dangerousActionAuth';

/** What the picker asks first: nothing, the High note, or the Tokenmaxxing note plus the device check. */
export type ThinkingLevelPending = { level: ThinkingLevel; auth: boolean } | null;

type Options = {
  value: ThinkingLevel;
  provider: AiProviderKind | null;
  onChange: (level: ThinkingLevel) => void;
  authPrompt: string;
  parentVisible?: boolean;
};

/**
 * The flow of changing the thinking level: a pick runs `thinkingLevelChangeGate`, writes at once
 * when it asks nothing, otherwise waits for the person to confirm (and, for Tokenmaxxing, to pass
 * the device check). `onChange` is called only after every step passed.
 */
export function useThinkingLevelChange({
  value,
  provider,
  onChange,
  authPrompt,
  parentVisible = true,
}: Options) {
  const [pending, setPending] = useSubModalState<ThinkingLevelPending>(parentVisible, null);
  const allowed = providerAllowsThinking(provider ?? '');

  const request = useCallback(
    (level: ThinkingLevel) => {
      if (!allowed || level === value) {
        return;
      }

      const gate = thinkingLevelChangeGate(value, level, provider ?? '');

      if (gate === 'none') {
        onChange(level);
        return;
      }

      setPending({ level, auth: gate === 'noteAndAuth' });
    },
    [allowed, value, provider, onChange, setPending]
  );

  const cancel = useCallback(() => setPending(null), [setPending]);

  const confirm = useCallback(async () => {
    const current = pending;
    setPending(null);

    if (!current) {
      return;
    }

    if (current.auth && !(await authenticateForDangerousAction(authPrompt))) {
      return;
    }

    onChange(current.level);
  }, [pending, authPrompt, onChange, setPending]);

  return { allowed, pending, request, cancel, confirm };
}
