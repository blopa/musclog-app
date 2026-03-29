import { Check, ChevronDown, Circle } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { useTheme } from '../../hooks/useTheme';
import { showSnackbar } from '../../utils/snackbarService';
import { BottomPopUpMenu, type BottomPopUpMenuItem } from '../BottomPopUpMenu';
import { Button } from '../theme/Button';
import { IconPicker } from '../theme/IconPicker';
import { SegmentedControl } from '../theme/SegmentedControl';
import { StepperInput } from '../theme/StepperInput';
import { TextInput } from '../theme/TextInput';
import { ToggleInput } from '../theme/ToggleInput';
import { DatePickerInput } from './DatePickerInput';
import { DatePickerModal } from './DatePickerModal';
import { FullScreenModal } from './FullScreenModal';
import type {
  BooleanFieldConfig,
  EditFieldConfig,
  EditFormValues,
  GenericEditModalProps,
  NumberFieldConfig,
  SelectFieldConfig,
  TextFieldConfig,
} from './GenericEditModal/types';

// TODO: improve Meals modal so it's possible to add/remove foods from it, maybe use the existing modal
// TODO: improve the edit workout template so, well, maybe use the existing modal
export function GenericEditModal({
  visible,
  onClose,
  title,
  fields,
  initialValues,
  onSave,
  isLoading = false,
  loadError,
  submitLabel,
}: GenericEditModalProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [formValues, setFormValues] = useState<EditFormValues>(initialValues);
  const [isSaving, setIsSaving] = useState(false);
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [currentDateFieldKey, setCurrentDateFieldKey] = useState<string | null>(null);
  const [selectMenuVisible, setSelectMenuVisible] = useState(false);
  const [currentSelectFieldKey, setCurrentSelectFieldKey] = useState<string | null>(null);

  // Reset form when modal opens or initialValues change
  useEffect(() => {
    if (visible) {
      setFormValues(initialValues);
    }
  }, [visible, initialValues]);

  const handleFieldChange = (key: string, value: any) => {
    setFormValues((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(formValues);
      onClose();
    } catch (error) {
      console.error('Error saving record:', error);
      const errorMessage = error instanceof Error ? error.message : t('common.saveError');
      showSnackbar('error', errorMessage, {
        subtitle: t('common.saveErrorSubtitle'),
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Helper function to convert select options to BottomPopUpMenuItem format
  const createBottomMenuItems = (
    options: { value: string | number; label: string }[],
    onSelect: (value: string | number) => void
  ): BottomPopUpMenuItem[] => {
    return options.map((option, index) => {
      // Use a rotating color scheme for icons
      const colorSchemes = [
        { bg: theme.colors.accent.primary10, color: theme.colors.accent.primary },
        { bg: theme.colors.status.info10, color: theme.colors.status.info },
        { bg: theme.colors.status.success20, color: theme.colors.status.success },
        { bg: theme.colors.status.warning10, color: theme.colors.status.warning },
        { bg: theme.colors.status.purple10, color: theme.colors.status.purple },
      ];
      const colorScheme = colorSchemes[index % colorSchemes.length];

      // Try to get a description from translation keys
      const descriptionKey = option.label.replace(/\.([^.]+)$/, '.descriptions.$1');
      const description = t(descriptionKey);

      return {
        icon: Circle,
        iconColor: colorScheme.color,
        iconBgColor: colorScheme.bg,
        title: t(option.label, option.label),
        description: description || t(option.label, option.label),
        onPress: () => onSelect(option.value),
      };
    });
  };

  const renderField = (field: EditFieldConfig) => {
    if (field.hidden) {
      return null;
    }

    const value = formValues[field.key];
    const label = t(field.label, field.label); // Try translation, fallback to raw label

    switch (field.type) {
      case 'text': {
        const textField = field as TextFieldConfig;
        return (
          <TextInput
            key={field.key}
            label={label}
            value={(value as string) ?? ''}
            onChangeText={(text) => handleFieldChange(field.key, text)}
            placeholder={
              textField.placeholder ? t(textField.placeholder, textField.placeholder) : undefined
            }
            required={textField.required}
            multiline={textField.multiline}
            numberOfLines={textField.multiline ? 6 : undefined}
          />
        );
      }

      case 'number': {
        const numberField = field as NumberFieldConfig;
        const numValue = (value as number) ?? numberField.min ?? 0;
        const step = numberField.step ?? 1;
        return (
          <StepperInput
            key={field.key}
            label={label}
            value={numValue}
            unit={numberField.unit}
            onIncrement={() => {
              const max = numberField.max ?? Infinity;
              const newValue = Math.min(numValue + step, max);
              handleFieldChange(field.key, newValue);
            }}
            onDecrement={() => {
              const min = numberField.min ?? 0;
              const newValue = Math.max(numValue - step, min);
              handleFieldChange(field.key, newValue);
            }}
            onChangeValue={(newValue) => {
              // Clamp value to min/max bounds
              const min = numberField.min ?? 0;
              const max = numberField.max ?? Infinity;
              const clampedValue = Math.max(min, Math.min(newValue, max));
              handleFieldChange(field.key, clampedValue);
            }}
          />
        );
      }

      case 'boolean': {
        const booleanField = field as BooleanFieldConfig;
        const boolValue = (value as boolean) ?? false;
        return (
          <ToggleInput
            key={field.key}
            items={[
              {
                key: field.key,
                label: label,
                subtitle: booleanField.subtitle
                  ? t(booleanField.subtitle, booleanField.subtitle)
                  : undefined,
                value: boolValue,
                onValueChange: (val) => handleFieldChange(field.key, val),
              },
            ]}
          />
        );
      }

      case 'select': {
        const selectField = field as SelectFieldConfig;
        const options = selectField.options;

        // For small number of options (<=3), use SegmentedControl
        if (options.length <= 3) {
          return (
            <View key={field.key} className="gap-2">
              <Text className="ml-1 text-sm font-medium text-text-secondary">{label}</Text>
              <SegmentedControl
                options={options.map((opt) => ({
                  label: t(opt.label, opt.label),
                  value: String(opt.value),
                }))}
                value={String(value ?? options[0]?.value ?? '')}
                onValueChange={(val) => {
                  // Try to preserve the original type (string or number)
                  const originalValue = options.find((opt) => String(opt.value) === val)?.value;
                  handleFieldChange(field.key, originalValue);
                }}
              />
            </View>
          );
        }

        // For longer lists, use BottomPopUpMenu
        // Convert value to string | number | undefined (exclude boolean/null)
        const selectValue =
          typeof value === 'string' || typeof value === 'number' ? value : undefined;
        const selectedOption = options.find((opt) => opt.value === selectValue);
        const selectedLabel = selectedOption
          ? t(selectedOption.label, selectedOption.label)
          : t('common.select');

        const menuItems = createBottomMenuItems(options, (val) => {
          handleFieldChange(field.key, val);
          setSelectMenuVisible(false);
          setCurrentSelectFieldKey(null);
        });

        return (
          <View key={field.key} className="gap-2">
            <Text className="ml-1 text-sm font-medium text-text-secondary">{label}</Text>
            <Pressable
              onPress={() => {
                setCurrentSelectFieldKey(field.key);
                setSelectMenuVisible(true);
              }}
              className="overflow-hidden rounded-lg border border-border-default bg-bg-overlay active:opacity-70"
            >
              <View className="flex-row items-center justify-between px-4 py-3">
                <Text className="min-w-0 flex-1 text-base text-text-primary">{selectedLabel}</Text>
                <View className="shrink-0 justify-center pl-2">
                  <ChevronDown size={theme.iconSize.md} color={theme.colors.text.secondary} />
                </View>
              </View>
            </Pressable>
            <BottomPopUpMenu
              visible={selectMenuVisible ? currentSelectFieldKey === field.key : false}
              onClose={() => {
                setSelectMenuVisible(false);
                setCurrentSelectFieldKey(null);
              }}
              title={label}
              items={menuItems}
            />
          </View>
        );
      }

      case 'date': {
        // Convert timestamp to Date object, or use current date as default
        const timestamp = (value as number) ?? Date.now();
        const dateValue = new Date(timestamp);

        return (
          <View key={field.key} className="gap-2">
            <DatePickerInput
              label={label}
              selectedDate={dateValue}
              onPress={() => {
                setCurrentDateFieldKey(field.key);
                setDatePickerVisible(true);
              }}
            />
            <DatePickerModal
              visible={datePickerVisible ? currentDateFieldKey === field.key : false}
              onClose={() => {
                setDatePickerVisible(false);
                setCurrentDateFieldKey(null);
              }}
              selectedDate={dateValue}
              onDateSelect={(date) => {
                // Convert Date to timestamp (milliseconds)
                handleFieldChange(field.key, date.getTime());
                setDatePickerVisible(false);
                setCurrentDateFieldKey(null);
              }}
            />
          </View>
        );
      }

      case 'icon': {
        return (
          <IconPicker
            key={field.key}
            label={label}
            value={(value as string) ?? ''}
            onSelect={(iconName) => handleFieldChange(field.key, iconName)}
          />
        );
      }

      default:
        return null;
    }
  };

  if (loadError) {
    return (
      <FullScreenModal visible={visible} onClose={onClose} title={title}>
        <View className="flex-1 items-center justify-center p-6">
          <Text className="text-status-error50 text-center text-base">{loadError}</Text>
          <Button
            label={t('common.close')}
            variant="outline"
            size="sm"
            onPress={onClose}
            className="mt-4"
          />
        </View>
      </FullScreenModal>
    );
  }

  return (
    <FullScreenModal
      visible={visible}
      onClose={onClose}
      title={title}
      footer={
        <Button
          label={submitLabel ?? t('common.saveChanges')}
          icon={Check}
          variant="gradientCta"
          size="md"
          width="full"
          onPress={handleSave}
          loading={isSaving}
          disabled={isLoading || isSaving}
        />
      }
    >
      {isLoading ? (
        <View className="flex-1 items-center justify-center p-6">
          <Text className="text-base text-text-secondary">{t('common.loading')}</Text>
        </View>
      ) : (
        <ScrollView className="px-4 py-6">
          <View className="gap-6">{fields.map((field) => renderField(field))}</View>
        </ScrollView>
      )}
    </FullScreenModal>
  );
}
