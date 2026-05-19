import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useEffect } from 'react';

export function useKeepScreenAwake(tag: string, enabled = true) {
  useEffect(() => {
    if (enabled) {
      activateKeepAwakeAsync(tag).catch(() => {});
    } else {
      deactivateKeepAwake(tag).catch(() => {});
    }

    return () => {
      deactivateKeepAwake(tag).catch(() => {});
    };
  }, [enabled, tag]);
}
