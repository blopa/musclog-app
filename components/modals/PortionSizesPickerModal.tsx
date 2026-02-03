import { Search, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, TextInput, View } from 'react-native';

import { theme } from '../../theme';
import { Button } from '../theme/Button';
import { OptionsMultiSelector } from '../theme/OptionsMultiSelector/OptionsMultiSelector';
import type { SelectorOption } from '../theme/OptionsMultiSelector/utils';
import { FullScreenModal } from './FullScreenModal';

type PortionSize = {
  id: string;
  label: string;
  description: string;
};

type PortionSizesPickerModalProps = {
  visible: boolean;
  onClose: () => void;
  onConfirm: (selectedIds: string[]) => void;
  selectedIds?: string[];
};

const PORTION_SIZES: PortionSize[] = [
  // Standard
  { id: 'servings', label: 'Servings', description: 'serving' },
  { id: 'containers', label: 'Containers', description: 'container' },
  // Weight
  { id: 'grams', label: 'Grams (g)', description: 'g' },
  { id: 'ounces', label: 'Ounces (oz)', description: 'oz' },
  { id: 'kilograms', label: 'Kilograms (kg)', description: 'kg' },
  { id: 'pounds', label: 'Pounds (lb)', description: 'lb' },
  // Volume
  { id: 'milliliters', label: 'Milliliters (ml)', description: 'ml' },
  { id: 'cups', label: 'Cups', description: 'cup' },
  { id: 'tablespoons', label: 'Tablespoons (tbsp)', description: 'tbsp' },
  { id: 'teaspoons', label: 'Teaspoons (tsp)', description: 'tsp' },
  { id: 'liters', label: 'Liters (L)', description: 'L' },
];

export function PortionSizesPickerModal({
  visible,
  onClose,
  onConfirm,
  selectedIds = [],
}: PortionSizesPickerModalProps) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [localSelectedIds, setLocalSelectedIds] = useState<string[]>(selectedIds);

  // Convert portion sizes to selector options
  const selectorOptions = useMemo((): SelectorOption<string>[] => {
    return PORTION_SIZES.map((size) => ({
      id: size.id,
      label: size.label,
      description: size.description,
      icon: () => null as any,
      iconBgColor: theme.colors.accent.primary,
      iconColor: theme.colors.text.black,
    }));
  }, []);

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
      title={t('portionSizes.selectTitle', 'Select Portion Sizes')}
      scrollable={false}
      footer={
        <View
          style={{
            flexDirection: 'row',
            gap: theme.spacing.gap.base,
          }}
        >
          <Button
            label={t('common.cancel', 'Cancel')}
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
              placeholder={t(
                'portionSizes.searchPlaceholder',
                'Search units (e.g. Cups, Grams...)'
              )}
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

        {/* OptionsMultiSelector */}
        <View style={{ flex: 1 }}>
          <OptionsMultiSelector
            title=""
            options={filteredOptions}
            selectedIds={localSelectedIds}
            onChange={setLocalSelectedIds}
          />
        </View>
      </View>
    </FullScreenModal>
  );
}
