import { useCallback, useState } from 'react';

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
  provider: string | null;
  onChange: (level: ThinkingLevel) => void;
  authPrompt: string;
};

/**
 * The flow of changing the thinking level: a pick runs `thinkingLevelChangeGate`, writes at once
 * when it asks nothing, otherwise waits for the person to confirm (and, for Tokenmaxxing, to pass
 * the device check). `onChange` is called only after every step passed.
 */
export function useThinkingLevelChange({ value, provider, onChange, authPrompt }: Options) {
  const [pending, setPending] = useState<ThinkingLevelPending>(null);
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
    [allowed, value, provider, onChange]
  );

  const cancel = useCallback(() => setPending(null), []);

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
  }, [pending, authPrompt, onChange]);

  return { allowed, pending, request, cancel, confirm };
}
