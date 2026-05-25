import { Search, X } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';

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
  onConfirm: (selectedIds: string[]) => void | Promise<void>;
  selectedIds?: string[];
  ownerType?: 'food' | 'meal';
};

type PortionTabId = 'basic' | 'this' | 'other';

type UnderlineTabsProps = {
  tabs: { id: PortionTabId; label: string }[];
  activeTab: PortionTabId;
  onTabChange: (tabId: PortionTabId) => void;
};

function UnderlineTabs({ tabs, activeTab, onTabChange }: UnderlineTabsProps) {
  const theme = useTheme();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      className="flex-row"
      contentContainerStyle={{
        paddingHorizontal: theme.spacing.padding.base,
        paddingTop: theme.spacing.padding.sm,
        gap: theme.spacing.gap.xl,
      }}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <Pressable
            key={tab.id}
            onPress={() => onTabChange(tab.id)}
            className="pb-3"
            style={{
              borderBottomWidth: theme.borderWidth.medium,
              borderBottomColor: isActive ? theme.colors.accent.secondary : 'transparent',
            }}
          >
            <Text
              className="whitespace-nowrap text-sm"
              style={{
                color: isActive ? theme.colors.accent.secondary : theme.colors.text.secondary,
                fontWeight: isActive
                  ? theme.typography.fontWeight.semibold
                  : theme.typography.fontWeight.medium,
              }}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export function PortionSizesPickerModal({
  visible,
  onClose,
  onConfirm,
  selectedIds = [],
  ownerType = 'food',
}: PortionSizesPickerModalProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { formatInteger } = useFormatAppNumber();
  const [searchQuery, setSearchQuery] = useState('');
  const [localSelectedIds, setLocalSelectedIds] = useState<string[]>(selectedIds);
  const [isCreateModalVisible, setCreateModalVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<PortionTabId>('basic');
  const [usageSummaries, setUsageSummaries] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!visible) {
      const reset = () => {
        setCreateModalVisible(false);
      };
      reset();
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
    const sync = () => {
      setLocalSelectedIds(selectedIds);
    };
    sync();
  }, [selectedIds]);

  // Portions are already ordered newest-first (see FoodPortionService.getPortionsPaginated)
  const selectorOptions = useMemo((): SelectorOption<string>[] => {
    return (loadedPortions as FoodPortion[]).map((portion: FoodPortion) => {
      const IconComponent = getFoodPortionIconComponent(portion.icon);
      const usage = usageSummaries[portion.id];
      const isBasic = portion.resolvedSource === 'basic';
      return {
        id: portion.id,
        label: portion.name,
        description: isBasic
          ? t('common.weightFormatG', {
              value: formatInteger(Math.round(portion.gramWeight ?? 0)),
            })
          : usage || t('food.foodDetails.privateServing'),
        icon: IconComponent || (() => null as any),
        iconBgColor: theme.colors.accent.primary,
        iconColor: theme.colors.text.black,
      };
    });
  }, [
    loadedPortions,
    usageSummaries,
    t,
    formatInteger,
    theme.colors.accent.primary,
    theme.colors.text.black,
  ]);

  useEffect(() => {
    let cancelled = false;

    const loadUsage = async () => {
      const customPortions = (loadedPortions as FoodPortion[]).filter(
        (portion) => portion.resolvedSource === 'custom'
      );

      const result: Record<string, string> = {};
      for (const portion of customPortions) {
        if (cancelled) {
          return;
        }
        const usage = await FoodPortionService.getPortionUsageSummary(portion.id);
        if (cancelled) {
          return;
        }

        const names = [...usage.foods, ...usage.meals].slice(0, 3);
        result[portion.id] =
          names.length > 0
            ? t('food.foodDetails.usedOnItems', { items: names.join(', ') })
            : t('food.foodDetails.privateServing');
      }

      setUsageSummaries(result);
    };

    loadUsage();
    return () => {
      cancelled = true;
    };
  }, [loadedPortions, t]);

  const portionById = useMemo(() => {
    const map = new Map<string, FoodPortion>();
    for (const p of loadedPortions as FoodPortion[]) {
      map.set(p.id, p);
    }

    return map;
  }, [loadedPortions]);

  // Filter options based on search query
  const filteredOptions = useMemo(() => {
    const selectedIdSet = new Set(localSelectedIds);
    const filteredByTab = selectorOptions.filter((option) => {
      const portion = portionById.get(option.id);
      if (!portion) {
        return false;
      }
      if (activeTab === 'basic') {
        return portion.resolvedSource === 'basic';
      }
      if (activeTab === 'other') {
        return portion.resolvedSource === 'custom' && !selectedIdSet.has(option.id);
      }
      return selectedIdSet.has(option.id);
    });

    if (!searchQuery.trim()) {
      return filteredByTab;
    }

    const query = searchQuery.toLowerCase();
    return filteredByTab.filter(
      (option) =>
        option.label.toLowerCase().includes(query) ||
        option.description.toLowerCase().includes(query)
    );
  }, [selectorOptions, portionById, activeTab, localSelectedIds, searchQuery]);

  const handleConfirm = async () => {
    await onConfirm(localSelectedIds);
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
            paddingBottom: theme.spacing.padding.base,
          }}
        >
          <UnderlineTabs
            tabs={[
              {
                id: 'basic',
                label: t('food.foodDetails.basicServings'),
              },
              {
                id: 'this',
                label: t(
                  ownerType === 'meal'
                    ? 'food.foodDetails.thisMealServings'
                    : 'food.foodDetails.thisFoodServings'
                ),
              },
              {
                id: 'other',
                label: t(
                  ownerType === 'meal'
                    ? 'food.foodDetails.otherMealServings'
                    : 'food.foodDetails.otherFoodServings'
                ),
              },
            ]}
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />

          {/* Loading State */}
          {isLoading ? (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <ActivityIndicator size="large" color={theme.colors.accent.primary} />
            </View>
          ) : (
            <View
              style={{
                paddingHorizontal: theme.spacing.padding.base,
              }}
            >
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
