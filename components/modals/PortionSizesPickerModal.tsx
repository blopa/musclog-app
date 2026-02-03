import { Search, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, TextInput, View } from 'react-native';

import { theme } from '../../theme';
import { Button } from '../theme/Button';
import { OptionsMultiSelector } from '../theme/OptionsMultiSelector/OptionsMultiSelector';
import type { SelectorOption } from '../theme/OptionsMultiSelector/utils';
import { FullScreenModal } from './FullScreenModal';

type PortionSizeCategory = 'standard' | 'weight' | 'volume';

type PortionSize = {
  id: string;
  label: string;
  category: PortionSizeCategory;
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
  { id: 'servings', label: 'Servings', category: 'standard', description: 'serving' },
  { id: 'containers', label: 'Containers', category: 'standard', description: 'container' },
  // Weight
  { id: 'grams', label: 'Grams (g)', category: 'weight', description: 'g' },
  { id: 'ounces', label: 'Ounces (oz)', category: 'weight', description: 'oz' },
  { id: 'kilograms', label: 'Kilograms (kg)', category: 'weight', description: 'kg' },
  { id: 'pounds', label: 'Pounds (lb)', category: 'weight', description: 'lb' },
  // Volume
  { id: 'milliliters', label: 'Milliliters (ml)', category: 'volume', description: 'ml' },
  { id: 'cups', label: 'Cups', category: 'volume', description: 'cup' },
  { id: 'tablespoons', label: 'Tablespoons (tbsp)', category: 'volume', description: 'tbsp' },
  { id: 'teaspoons', label: 'Teaspoons (tsp)', category: 'volume', description: 'tsp' },
  { id: 'liters', label: 'Liters (L)', category: 'volume', description: 'L' },
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

  // Group options by category
  const groupedOptions = useMemo(() => {
    const groups: Record<PortionSizeCategory, SelectorOption<string>[]> = {
      standard: [],
      weight: [],
      volume: [],
    };

    filteredOptions.forEach((option) => {
      const size = PORTION_SIZES.find((s) => s.id === option.id);
      if (size) {
        groups[size.category].push(option);
      }
    });

    return groups;
  }, [filteredOptions]);

  const handleConfirm = () => {
    onConfirm(localSelectedIds);
    onClose();
  };

  const renderSection = (
    title: string,
    options: SelectorOption<string>[],
    category: PortionSizeCategory
  ) => {
    if (options.length === 0) return null;

    return (
      <View key={category} style={{ marginBottom: theme.spacing.padding.lg }}>
        <Text
          style={{
            fontSize: theme.typography.fontSize.xs,
            fontWeight: theme.typography.fontWeight.bold,
            color: theme.colors.text.secondary,
            textTransform: 'uppercase',
            letterSpacing: theme.typography.letterSpacing.extraWide,
            marginBottom: theme.spacing.padding.base,
            paddingHorizontal: theme.spacing.padding.xs,
          }}
        >
          {title}
        </Text>

        <View style={{ gap: theme.spacing.gap.sm }}>
          {options.map((option) => (
            <Pressable
              key={option.id}
              onPress={() => {
                if (localSelectedIds.includes(option.id)) {
                  setLocalSelectedIds(localSelectedIds.filter((id) => id !== option.id));
                } else {
                  setLocalSelectedIds([...localSelectedIds, option.id]);
                }
              }}
              style={({ pressed }) => [
                {
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: theme.spacing.padding.base,
                  borderRadius: theme.borderRadius.lg,
                  borderWidth: theme.borderWidth.thin,
                  borderColor: localSelectedIds.includes(option.id)
                    ? theme.colors.accent.primary
                    : theme.colors.border.light,
                  backgroundColor: theme.colors.background.card,
                  transform: [{ scale: pressed ? 0.98 : 1 }],
                },
              ]}
            >
              <Text
                style={{
                  fontSize: theme.typography.fontSize.base,
                  fontWeight: theme.typography.fontWeight.medium,
                  color: theme.colors.text.primary,
                }}
              >
                {option.label}
              </Text>

              <View
                style={{
                  width: theme.size['6'],
                  height: theme.size['6'],
                  borderRadius: theme.borderRadius.full,
                  borderWidth: theme.borderWidth.medium,
                  borderColor: localSelectedIds.includes(option.id)
                    ? theme.colors.accent.primary
                    : theme.colors.border.default,
                  backgroundColor: localSelectedIds.includes(option.id)
                    ? theme.colors.accent.primary
                    : 'transparent',
                }}
              />
            </Pressable>
          ))}
        </View>
      </View>
    );
  };

  return (
    <FullScreenModal
      visible={visible}
      onClose={onClose}
      title={t('portionSizes.selectTitle', 'Select Portion Sizes')}
      scrollable={true}
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
          paddingHorizontal: theme.spacing.padding.base,
          paddingVertical: theme.spacing.padding.sm,
        }}
      >
        {/* Search Input */}
        <View style={{ marginBottom: theme.spacing.padding.base }}>
          <View
            style={{
              position: 'relative',
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
      </View>

      {/* Content Sections */}
      <View style={{ paddingHorizontal: theme.spacing.padding.base }}>
        {renderSection(t('portionSizes.standard', 'Standard'), groupedOptions.standard, 'standard')}
        {renderSection(t('portionSizes.weight', 'Weight'), groupedOptions.weight, 'weight')}
        {renderSection(t('portionSizes.volume', 'Volume'), groupedOptions.volume, 'volume')}
      </View>
    </FullScreenModal>
  );
}
