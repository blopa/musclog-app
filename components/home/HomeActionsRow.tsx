import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { ActionButton } from '@/components/ActionButton';
import { HOME_ACTIONS, reconcileHomeActions } from '@/components/home/homeActions';
import { HOME_ACTIONS_PER_ROW, type HomeActionKey } from '@/constants/homeActions';
import { useAvailableHomeActions } from '@/hooks/useAvailableHomeActions';

type HomeActionsRowProps = {
  /** The user's stored choice, straight from settings — reconciled here, not by the caller. */
  selected: readonly HomeActionKey[];
  onActionPress: (key: HomeActionKey) => void;
};

/**
 * The home screen's quick-action grid.
 *
 * The grid is `HOME_ACTIONS_PER_ROW` wide and this is the only place that knows it:
 * `ActionButton` fills whatever box it is given rather than carrying a basis of its own,
 * so it stays usable in a layout that is not this one.
 *
 * The stored selection is reconciled rather than filtered — an action this device cannot
 * offer would otherwise leave the row short, so the gap is topped up rather than rendered
 * as a hole. `VisualSettingsModal` runs the same reconciliation and persists the result;
 * this one is for rendering only.
 */
export function HomeActionsRow({ onActionPress, selected }: HomeActionsRowProps) {
  const { t } = useTranslation();
  const available = useAvailableHomeActions();

  const actions = useMemo(() => reconcileHomeActions(selected, available), [selected, available]);

  return (
    <View className="mx-4 mb-8 flex-row flex-wrap justify-between gap-y-4">
      {actions.map((key) => {
        const config = HOME_ACTIONS[key];

        return (
          <View key={key} style={{ flexBasis: `${100 / HOME_ACTIONS_PER_ROW - 2}%` }}>
            <ActionButton
              tone={config.tone}
              label={t(config.labelKey)}
              icon={config.icon}
              onPress={() => onActionPress(key)}
            />
          </View>
        );
      })}
    </View>
  );
}
