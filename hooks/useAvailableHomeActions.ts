import { useMemo } from 'react';
import { Platform } from 'react-native';

import { HOME_ACTIONS } from '@/components/home/homeActions';
import { HOME_ACTION_KEYS, HomeActionKey } from '@/constants/homeActions';
import { useSettings } from '@/hooks/useSettings';

/**
 * Which quick actions this device can offer, in catalogue order.
 *
 * The home screen and the settings picker both need this list, and both previously
 * derived it themselves — same filter, same `Platform.OS` threading, two copies. The
 * predicate has always had one home (`HOME_ACTIONS[key].isAvailable`); this gives the
 * derivation one too, so `Platform.OS` stops being a parameter every caller has to
 * remember to pass.
 */
export function useAvailableHomeActions(): HomeActionKey[] {
  const { isAiConfigured } = useSettings();

  return useMemo(() => {
    const context = { isAiConfigured, isWeb: Platform.OS === 'web' };
    return HOME_ACTION_KEYS.filter((key) => HOME_ACTIONS[key].isAvailable(context));
  }, [isAiConfigured]);
}
