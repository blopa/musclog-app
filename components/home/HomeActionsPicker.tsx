import { Plus } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import Animated, { LinearTransition } from 'react-native-reanimated';

import {
  HOME_ACTIONS,
  homeActionListLabel,
  orderHomeActionRows,
} from '@/components/home/homeActions';
import {
  type HomeActionKey,
  MAX_HOME_ACTIONS,
  MIN_HOME_ACTIONS,
  toggleHomeAction,
} from '@/constants/homeActions';
import { useTheme } from '@/hooks/useTheme';

type HomeActionsPickerProps = {
  /** The chosen actions, in the order they appear on the home screen. */
  selected: readonly HomeActionKey[];
  /** Every action this device can offer — see `useAvailableHomeActions`. */
  available: readonly HomeActionKey[];
  onChange: (next: readonly HomeActionKey[]) => void;
};

/**
 * Pick the home screen's quick actions: tap to add, tap again to remove, and the order
 * you pick them in is the order they appear.
 *
 * Chosen actions stay pinned to the top of the list in that order, so the list reads as
 * the home row does. A row that a bound refuses is rendered disabled rather than being
 * left tappable with no effect — `toggleHomeAction` owns the bounds, and this only
 * mirrors them.
 */
export function HomeActionsPicker({ selected, available, onChange }: HomeActionsPickerProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  const atMax = selected.length >= MAX_HOME_ACTIONS;
  const atMin = selected.length <= MIN_HOME_ACTIONS;

  const rows = orderHomeActionRows(selected, available);

  const hint = (): string => {
    if (atMax) {
      return t('settings.homeActions.hintAtMax', { max: MAX_HOME_ACTIONS });
    }
    if (atMin) {
      return t('settings.homeActions.hintAtMin', { min: MIN_HOME_ACTIONS });
    }
    return t('settings.homeActions.hintOrder');
  };

  return (
    <View>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: theme.spacing.gap.base,
          marginBottom: theme.spacing.padding.base,
          paddingHorizontal: theme.spacing.padding.xs,
        }}
      >
        <Text
          style={{
            flex: 1,
            fontSize: theme.typography.fontSize.xs,
            color: theme.colors.text.secondary,
          }}
        >
          {hint()}
        </Text>
        <Text
          style={{
            fontSize: theme.typography.fontSize.xs,
            fontWeight: theme.typography.fontWeight.bold,
            color: theme.colors.accent.primary,
          }}
        >
          {t('settings.homeActions.chosenCount', {
            chosen: selected.length,
            max: MAX_HOME_ACTIONS,
          })}
        </Text>
      </View>

      <View style={{ gap: theme.spacing.gap.md }}>
        {rows.map((key) => {
          const config = HOME_ACTIONS[key];
          const Icon = config.icon;
          const position = selected.indexOf(key);
          const isSelected = position !== -1;
          const isLocked = isSelected ? atMin : atMax;

          return (
            <Animated.View
              key={key}
              layout={LinearTransition.springify().damping(35).stiffness(360)}
            >
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isSelected, disabled: isLocked }}
                disabled={isLocked}
                onPress={() => onChange(toggleHomeAction(selected, key))}
              >
                {({ pressed }) => (
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: theme.spacing.gap.base,
                      padding: theme.spacing.padding.base,
                      borderRadius: theme.borderRadius.md,
                      borderWidth: theme.borderWidth.thin,
                      borderColor: isSelected
                        ? theme.colors.accent.primary
                        : theme.colors.border.light,
                      backgroundColor: theme.colors.background.card,
                      opacity: isLocked && !isSelected ? theme.colors.opacity.medium : 1,
                      transform: [{ scale: pressed ? 0.98 : 1 }],
                      ...(isSelected ? theme.shadows.accentGlow : {}),
                    }}
                  >
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: theme.spacing.gap.base,
                        flex: 1,
                        minWidth: 0,
                      }}
                    >
                      <View
                        style={{
                          width: theme.size['10'],
                          height: theme.size['10'],
                          borderRadius: theme.borderRadius.full,
                          backgroundColor: theme.colors.background.iconDark,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Icon size={theme.iconSize.lg} color={theme.colors.accent.primary} />
                      </View>
                      <Text
                        numberOfLines={1}
                        style={{
                          flex: 1,
                          fontSize: theme.typography.fontSize.base,
                          fontWeight: theme.typography.fontWeight.bold,
                          color: theme.colors.text.primary,
                        }}
                      >
                        {homeActionListLabel(t(config.labelKey))}
                      </Text>
                    </View>

                    {/* The badge carries the position, because pick order IS home order. */}
                    <View
                      style={{
                        width: theme.size['6'],
                        height: theme.size['6'],
                        borderRadius: theme.borderRadius.full,
                        borderWidth: theme.borderWidth.medium,
                        borderColor: isSelected
                          ? theme.colors.accent.primary
                          : theme.colors.border.default,
                        backgroundColor: isSelected ? theme.colors.accent.primary : 'transparent',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {isSelected ? (
                        <Text
                          style={{
                            fontSize: theme.typography.fontSize.xs,
                            fontWeight: theme.typography.fontWeight.bold,
                            color: theme.colors.text.onAccent,
                          }}
                        >
                          {position + 1}
                        </Text>
                      ) : (
                        <Plus
                          size={theme.iconSize.xs}
                          color={theme.colors.text.tertiary}
                          strokeWidth={theme.strokeWidth.thick}
                        />
                      )}
                    </View>
                  </View>
                )}
              </Pressable>
            </Animated.View>
          );
        })}
      </View>
    </View>
  );
}
