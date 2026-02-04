import {
  Apple,
  Coffee,
  Croissant,
  Droplet,
  Egg,
  Flame,
  Lightbulb,
  Popcorn,
  Scale,
  Search,
  Soup,
  UtensilsCrossed,
  Wind,
  X,
} from 'lucide-react-native';
import { ComponentType, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import FoodPortion from '../../database/models/FoodPortion';
import { FoodPortionService } from '../../database/services';
import { useFoodPortions } from '../../hooks/useFoodPortions';
import { theme } from '../../theme';
import { Button } from '../theme/Button';
import { OptionsMultiSelector } from '../theme/OptionsMultiSelector/OptionsMultiSelector';
import type { SelectorOption } from '../theme/OptionsMultiSelector/utils';
import { TextInput } from '../theme/TextInput';
import { CreateFoodPortionModal } from './CreateFoodPortionModal';
import { FullScreenModal } from './FullScreenModal';

type PortionSizesPickerModalProps = {
  visible: boolean;
  onClose: () => void;
  onConfirm: (selectedIds: string[]) => void;
  selectedIds?: string[];
};

// Map icon names to lucide components
const ICON_MAP: Record<string, ComponentType<any>> = {
  droplet: Droplet,
  scale: Scale,
  egg: Egg,
  cup: Popcorn,
  flame: Flame,
  lightbulb: Lightbulb,
  wind: Wind,
  restaurant: UtensilsCrossed,
  'ramen-dining': Soup,
  'dinner-dining': UtensilsCrossed,
  'bakery-dining': Croissant,
  'local-cafe': Coffee,
  nutrition: Apple,
};

function getIconComponent(iconName?: string | null): ComponentType<any> | null {
  if (!iconName) {
    return null;
  }

  return ICON_MAP[iconName] || null;
}

export function PortionSizesPickerModal({
  visible,
  onClose,
  onConfirm,
  selectedIds = [],
}: PortionSizesPickerModalProps) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [localSelectedIds, setLocalSelectedIds] = useState<string[]>(selectedIds);
  const [isCreateModalVisible, setCreateModalVisible] = useState(false);

  // Load food portions from database
  const { portions, isLoading, refresh } = useFoodPortions({
    mode: 'all',
    visible,
  });

  // Sync localSelectedIds when selectedIds prop changes
  useEffect(() => {
    setLocalSelectedIds(selectedIds);
  }, [selectedIds]);

  // Convert food portions to selector options
  const selectorOptions = useMemo((): SelectorOption<string>[] => {
    return (portions as FoodPortion[]).map((portion: FoodPortion) => {
      const IconComponent = getIconComponent(portion.icon);
      return {
        id: portion.id,
        label: portion.name,
        description: `${portion.gramWeight}g`,
        icon: IconComponent || (() => null as any),
        iconBgColor: theme.colors.accent.primary,
        iconColor: theme.colors.text.black,
      };
    });
  }, [portions]);

  // Filter options based on search query
  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) {
      return selectorOptions;
    }

    const query = searchQuery.toLowerCase();
    return selectorOptions.filter(
      (option) =>
        option.label.toLowerCase().includes(query) ||
        option.description.toLowerCase().includes(query)
    );
  }, [selectorOptions, searchQuery]);

  const handleConfirm = () => {
    onConfirm(localSelectedIds);
    onClose();
  };

  const handleAddNew = () => {
    setCreateModalVisible(true);
  };

  const handleCreatePortion = async (newPortion: {
    name: string;
    weight: number;
    icon: string;
  }) => {
    try {
      // Create or get existing portion
      const created = await FoodPortionService.getOrCreatePortion(
        newPortion.name,
        newPortion.weight,
        newPortion.icon
      );

      // Refresh portions list from DB
      try {
        await refresh?.();
      } catch (err) {
        // ignore refresh errors but log
        console.error('Error refreshing portions after create:', err);
      }

      // Select the newly created portion
      if (created && created.id) {
        setLocalSelectedIds((prev) => Array.from(new Set([...prev, created.id])));
      }
    } catch (err) {
      console.error('Error creating food portion:', err);
    } finally {
      setCreateModalVisible(false);
    }
  };

  return (
    <>
      <FullScreenModal
        visible={visible}
        onClose={onClose}
        title={t('portionSizes.selectTitle')}
        scrollable={true}
        footer={
          <View
            style={{
              flexDirection: 'row',
              gap: theme.spacing.gap.base,
            }}
          >
            <Button
              label={t('portionSizes.addNew')}
              variant="secondaryGradient"
              size="sm"
              width="flex-1"
              onPress={handleAddNew}
            />
            <Button
              label={t('common.confirm', `Confirm (${localSelectedIds.length})`)}
              variant="gradientCta"
              size="sm"
              width="flex-2"
              onPress={handleConfirm}
            />
          </View>
        }
      >
        <View
          style={{
            flex: 1,
            paddingVertical: theme.spacing.padding.sm,
          }}
        >
          {/* Search Input (themed) */}
          <View
            style={{
              marginBottom: theme.spacing.padding.lg,
              paddingHorizontal: theme.spacing.padding.base,
            }}
          >
            <TextInput
              label=""
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={t('portionSizes.searchPlaceholder')}
              icon={
                searchQuery ? (
                  <Pressable onPress={() => setSearchQuery('')}>
                    <X size={theme.iconSize.lg} color={theme.colors.text.secondary} />
                  </Pressable>
                ) : (
                  <Search size={theme.iconSize.lg} color={theme.colors.text.tertiary} />
                )
              }
            />
          </View>

          <View
            style={{
              paddingHorizontal: theme.spacing.padding.base,
            }}
          >
            {/* Loading State */}
            {isLoading ? (
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" color={theme.colors.accent.primary} />
              </View>
            ) : (
              /* OptionsMultiSelector */
              <View style={{ flex: 1 }}>
                {filteredOptions.length > 0 ? (
                  <OptionsMultiSelector
                    title=""
                    options={filteredOptions}
                    selectedIds={localSelectedIds}
                    onChange={setLocalSelectedIds}
                  />
                ) : (
                  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <Text
                      style={{
                        fontSize: theme.typography.fontSize.base,
                        color: theme.colors.text.secondary,
                      }}
                    >
                      {t('portionSizes.noResults')}
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>
        </View>
      </FullScreenModal>

      <CreateFoodPortionModal
        visible={isCreateModalVisible}
        onClose={() => setCreateModalVisible(false)}
        onCreatePortion={handleCreatePortion}
      />
    </>
  );
}
