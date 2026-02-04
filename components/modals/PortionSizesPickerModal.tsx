import {
  Droplet,
  Egg,
  Flame,
  Lightbulb,
  Popcorn,
  Scale,
  Search,
  Wind,
  X,
} from 'lucide-react-native';
import { ComponentType, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';

import { useFoodPortions } from '../../hooks/useFoodPortions';
import { theme } from '../../theme';
import { Button } from '../theme/Button';
import { OptionsMultiSelector } from '../theme/OptionsMultiSelector/OptionsMultiSelector';
import type { SelectorOption } from '../theme/OptionsMultiSelector/utils';
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
};

function getIconComponent(iconName?: string | null): ComponentType<any> | null {
  if (!iconName) return null;
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

  // Load food portions from database
  const { portions, isLoading } = useFoodPortions({
    mode: 'all',
    visible,
  });

  // Sync localSelectedIds when selectedIds prop changes
  useEffect(() => {
    setLocalSelectedIds(selectedIds);
  }, [selectedIds]);

  // Convert food portions to selector options
  const selectorOptions = useMemo((): SelectorOption<string>[] => {
    return portions.map((portion) => {
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

  return (
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
          {/*TODO: instead of cancel, let's have a button called "Add New" that opens the CreateFoodPortionModal */}
          <Button
            label={t('common.cancel')}
            variant="secondary"
            size="sm"
            width="flex-1"
            onPress={onClose}
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
          paddingHorizontal: theme.spacing.padding.base,
          paddingVertical: theme.spacing.padding.sm,
        }}
      >
        {/* Search Input */}
        <View style={{ marginBottom: theme.spacing.padding.lg }}>
          <View
            style={{
              borderRadius: theme.borderRadius.xl,
              borderWidth: theme.borderWidth.thin,
              borderColor: theme.colors.border.light,
              backgroundColor: theme.colors.background.cardElevated,
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: theme.spacing.padding.base,
            }}
          >
            <Search size={theme.iconSize.lg} color={theme.colors.text.secondary} />
            <TextInput
              style={{
                flex: 1,
                paddingVertical: theme.spacing.padding.base,
                paddingHorizontal: theme.spacing.padding.sm,
                fontSize: theme.typography.fontSize.base,
                color: theme.colors.text.primary,
              }}
              placeholder={t('portionSizes.searchPlaceholder')}
              placeholderTextColor={theme.colors.text.tertiary}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery ? (
              <Pressable onPress={() => setSearchQuery('')}>
                <X size={theme.iconSize.lg} color={theme.colors.text.secondary} />
              </Pressable>
            ) : null}
          </View>
        </View>

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
    </FullScreenModal>
  );
}
