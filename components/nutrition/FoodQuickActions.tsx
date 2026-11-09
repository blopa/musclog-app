import { ListPlus, ScanLine, Sparkles, UtensilsCrossed } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useWindowDimensions, View } from 'react-native';

import { Button } from '@/components/theme/Button';
import { useTheme } from '@/hooks/useTheme';

/**
 * The least room a quick action gets beside its neighbour: icon, padding and the longest word of
 * its label at the default text size ("Дополнительные" in Russian, "Escanear" in Spanish). Two
 * actions share a row only while both get this much, so on a 344pt phone (312pt of content) the
 * pairs stack rather than breaking a word; on a 360pt phone (328pt) they still pair.
 */
export const QUICK_ACTION_MIN_WIDTH = 160;

/**
 * The width a quick action asks for. It grows with the OS text scale, so at large text two actions
 * no longer fit side by side on a phone and each takes a row to itself rather than breaking its
 * label mid-word ("Escanea/r") in a half-width tile.
 */
export function quickActionBasis(fontScale: number): number {
  return Math.round(QUICK_ACTION_MIN_WIDTH * Math.max(1, fontScale));
}

type FoodQuickActionsProps = {
  /** The AI camera is offered only once a provider is set up. */
  isAiConfigured: boolean;
  onScanBarcode: () => void;
  onAiCamera: () => void;
  onMyMeals: () => void;
  onMoreOptions: () => void;
};

/**
 * The food diary's four ways to log: barcode, AI photo, a saved meal, everything else. Pairs of
 * buttons that wrap (`flexBasis` + `flexGrow`) instead of a fixed two-column grid, so each pair
 * stays side by side while it has room and stacks into full-width buttons when it does not.
 */
export function FoodQuickActions({
  isAiConfigured,
  onScanBarcode,
  onAiCamera,
  onMyMeals,
  onMoreOptions,
}: FoodQuickActionsProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { fontScale } = useWindowDimensions();
  const basis = quickActionBasis(fontScale);

  const slot = (key: string, button: ReactNode) => (
    <View key={key} style={{ flexGrow: 1, flexBasis: basis }}>
      {button}
    </View>
  );

  return (
    <View className="gap-2">
      <View className="flex-row flex-wrap gap-2">
        {slot(
          'scan',
          <Button
            label={t('food.actions.scanBarcode')}
            icon={ScanLine}
            variant="secondary"
            size="sm"
            width="full"
            onPress={onScanBarcode}
          />
        )}
        {isAiConfigured
          ? slot(
              'ai',
              <Button
                label={t('food.actions.aiCamera')}
                icon={Sparkles}
                iconColor={theme.colors.accent.secondary}
                variant="secondaryGradient"
                size="sm"
                width="full"
                onPress={onAiCamera}
              />
            )
          : null}
      </View>
      <View className="flex-row flex-wrap gap-2">
        {slot(
          'meals',
          <Button
            label={t('food.actions.myMeals')}
            icon={UtensilsCrossed}
            variant="secondary"
            size="sm"
            width="full"
            onPress={onMyMeals}
          />
        )}
        {slot(
          'more',
          <Button
            label={t('food.actions.moreFoodOptions')}
            icon={ListPlus}
            variant="secondaryGradient"
            size="sm"
            width="full"
            onPress={onMoreOptions}
          />
        )}
      </View>
    </View>
  );
}
