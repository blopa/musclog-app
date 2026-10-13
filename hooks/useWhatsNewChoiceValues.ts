import { useCallback, useEffect, useRef, useState } from 'react';

import {
  isWhatsNewSettingValue,
  WHATS_NEW_SETTINGS,
  type WhatsNewSetting,
  type WhatsNewSettingValues,
} from '@/utils/whatsNew/catalog';
import { WHATS_NEW_SETTING_IO, writeWhatsNewSetting } from '@/utils/whatsNew/settingIO';

export function useWhatsNewChoiceValues(active: boolean) {
  const [values, setValues] = useState<Partial<WhatsNewSettingValues>>({});
  const [errors, setErrors] = useState<Partial<Record<WhatsNewSetting, boolean>>>({});
  const [saving, setSaving] = useState<Partial<Record<WhatsNewSetting, boolean>>>({});
  const current = useRef<Partial<WhatsNewSettingValues>>({});
  const pending = useRef(new Set<WhatsNewSetting>());
  const revisions = useRef<Partial<Record<WhatsNewSetting, number>>>({});
  const generation = useRef(0);
  const [reload, setReload] = useState(0);
  const refresh = useCallback(() => setReload((n) => n + 1), []);

  useEffect(() => {
    const run = ++generation.current;
    if (!active) {
      return;
    }

    for (const setting of WHATS_NEW_SETTINGS) {
      const revision = revisions.current[setting];
      void WHATS_NEW_SETTING_IO[setting]
        .read()
        .then((value) => {
          if (
            generation.current !== run ||
            pending.current.has(setting) ||
            revisions.current[setting] !== revision
          ) {
            return;
          }

          current.current = { ...current.current, [setting]: value };
          setValues(current.current);
          setErrors((previous) => ({ ...previous, [setting]: false }));
        })
        .catch(() => {
          if (generation.current === run) {
            setErrors((previous) => ({ ...previous, [setting]: true }));
          }
        });
    }

    return () => {
      generation.current = run + 1;
    };
  }, [active, reload]);

  const write = useCallback(async (setting: WhatsNewSetting, value: unknown) => {
    if (!isWhatsNewSettingValue(setting, value)) {
      return;
    }

    const previous = current.current[setting];
    if (previous === undefined || previous === value || pending.current.has(setting)) {
      return;
    }

    const run = generation.current;
    pending.current.add(setting);
    revisions.current[setting] = (revisions.current[setting] ?? 0) + 1;
    current.current = { ...current.current, [setting]: value };
    setValues(current.current);
    setSaving((state) => ({ ...state, [setting]: true }));
    setErrors((state) => ({ ...state, [setting]: false }));
    try {
      await writeWhatsNewSetting(setting, value);
    } catch {
      current.current = { ...current.current, [setting]: previous };
      if (generation.current === run) {
        setValues(current.current);
        setErrors((state) => ({ ...state, [setting]: true }));
      }
    } finally {
      pending.current.delete(setting);
      setSaving((state) => ({ ...state, [setting]: false }));
    }
  }, []);

  return { values, errors, saving, write, refresh };
}
