import { Search, X } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { Button } from '@/components/theme/Button';
import { OptionsMultiSelector } from '@/components/theme/OptionsMultiSelector/OptionsMultiSelector';
import type { SelectorOption } from '@/components/theme/OptionsMultiSelector/utils';
import { TextInput } from '@/components/theme/TextInput';
import FoodPortion from '@/database/models/FoodPortion';
import { FoodPortionService } from '@/database/services';
import { useFoodPortions } from '@/hooks/useFoodPortions';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { useTheme } from '@/hooks/useTheme';
import { getFoodPortionIconComponent } from '@/utils/foodPortionIcons';
import { handleError } from '@/utils/handleError';

import { CreateFoodPortionModal } from './CreateFoodPortionModal';
import { FullScreenModal } from './FullScreenModal';

type PortionSizesPickerModalProps = {
  visible: boolean;
  onClose: () => void;
  onConfirm: (selectedIds: string[]) => void;
  selectedIds?: string[];
};

export function PortionSizesPickerModal({
  visible,
  onClose,
  onConfirm,
  selectedIds = [],
}: PortionSizesPickerModalProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { formatInteger } = useFormatAppNumber();
  const [searchQuery, setSearchQuery] = useState('');
  const [localSelectedIds, setLocalSelectedIds] = useState<string[]>(selectedIds);
  const [isCreateModalVisible, setCreateModalVisible] = useState(false);

  useEffect(() => {
    if (!visible) {
      setCreateModalVisible(false);
    }
  }, [visible]);

  // Paginated global portions (newest first); app + user-created via includeAllPortionSources
  const {
    portions: loadedPortions,
    isLoading,
    isLoadingMore,
    hasMore,
    loadMore,
    refresh,
  } = useFoodPortions({
    mode: 'paginated',
    initialLimit: 20,
    batchSize: 20,
    includeAllPortionSources: true,
    visible,
  });

  // Sync localSelectedIds when selectedIds prop changes
  useEffect(() => {
    setLocalSelectedIds(selectedIds);
  }, [selectedIds]);

  // Portions are already ordered newest-first (see FoodPortionService.getPortionsPaginated)
  const selectorOptions = useMemo((): SelectorOption<string>[] => {
    return (loadedPortions as FoodPortion[]).map((portion: FoodPortion) => {
      const IconComponent = getFoodPortionIconComponent(portion.icon);
      return {
        id: portion.id,
        label: portion.name,
        description: t('common.weightFormatG', {
          value: formatInteger(Math.round(portion.gramWeight)),
        }),
        icon: IconComponent || (() => null as any),
        iconBgColor: theme.colors.accent.primary,
        iconColor: theme.colors.text.black,
      };
    });
  }, [loadedPortions, t, formatInteger, theme.colors.accent.primary, theme.colors.text.black]);

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
      handleError(err, 'PortionSizesPickerModal.handleCreatePortion', {
        snackbarMessage: t('errors.somethingWentWrong'),
      });
    } finally {
      setCreateModalVisible(false);
    }
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
              {hasMore ? (
                <View style={{ paddingVertical: theme.spacing.padding.base }}>
                  <Button
                    label={
                      isLoadingMore ? t('portionSizes.loadingMore') : t('portionSizes.loadMore')
                    }
                    onPress={loadMore}
                    size="sm"
                    variant="outline"
                    disabled={isLoadingMore}
                    loading={isLoadingMore}
                    width="full"
                    iconPosition="left"
                  />
                </View>
              ) : null}
            </View>
          )}
        </View>
      </View>
      <CreateFoodPortionModal
        visible={isCreateModalVisible}
        onClose={() => setCreateModalVisible(false)}
        onCreatePortion={handleCreatePortion}
      />
    </FullScreenModal>
  );
}
