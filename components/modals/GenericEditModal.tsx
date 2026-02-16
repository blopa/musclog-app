import { Check, Circle } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, Text, View } from 'react-native';

import { useTheme } from '../../hooks/useTheme';
import { OptionsSelector, type SelectorOption } from '../OptionsSelector';
import { Button } from '../theme/Button';
import { CheckRadioBox } from '../theme/CheckRadioBox';
import { SegmentedControl } from '../theme/SegmentedControl';
import { StepperInput } from '../theme/StepperInput';
import { TextInput } from '../theme/TextInput';
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
// TODO: improve portion modal to add an icon picker instead of textinput for icon
// TODO: improve the workout template so that the checkbox uses the Toggler.tsx component
// TODO: improve the edit workout template so, well, maybe use the existing modal
// TODO: improve the user metrics modal to have the date picker and instead of multiple options picker, maybe use the bottom menu options to choose the option
// TODO: improve exercise edit modal instead of multiple options picker, maybe use the bottom menu options to choose the option
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
      // TODO: Show error toast
    } finally {
      setIsSaving(false);
    }
  };

  // Helper function to convert select options to SelectorOption format
  const createSelectorOptions = (
    options: { value: string | number; label: string }[],
    selectedValue: string | number | null | undefined
  ): SelectorOption<string | number>[] => {
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

      // Try to get a description from translation keys (e.g., food.meals.descriptions.breakfast)
      const descriptionKey = option.label.replace(/\.([^.]+)$/, '.descriptions.$1');
      const description = t(descriptionKey, { defaultValue: '' });

      return {
        id: option.value,
        label: t(option.label, option.label),
        description: description,
        icon: Circle,
        iconBgColor: colorScheme.bg,
        iconColor: colorScheme.color,
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
        return (
          <CheckRadioBox
            key={field.key}
            label={label}
            value={(value as boolean) ?? false}
            onValueChange={(val) => handleFieldChange(field.key, val)}
            type="checkbox"
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

        // For longer lists, use OptionsSelector
        // Convert value to string | number | undefined (exclude boolean/null)
        const selectValue =
          typeof value === 'string' || typeof value === 'number' ? value : undefined;
        const selectorOptions = createSelectorOptions(options, selectValue ?? null);

        return (
          <OptionsSelector
            key={field.key}
            title={label}
            options={selectorOptions}
            selectedId={selectValue}
            onSelect={(id) => handleFieldChange(field.key, id)}
          />
        );
      }

      case 'date': {
        // TODO: Implement date picker
        // For now, just show the timestamp as a number input
        return (
          <View key={field.key}>
            <Text className="ml-1 text-sm font-medium text-text-secondary">{label}</Text>
            <Text className="mt-2 text-sm text-text-tertiary">
              {t('common.datePickerNotImplemented', 'Date picker not yet implemented')}
            </Text>
          </View>
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
            label={t('common.close', 'Close')}
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
          label={submitLabel ?? t('common.saveChanges', 'Save Changes')}
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
          <Text className="text-base text-text-secondary">{t('common.loading', 'Loading...')}</Text>
        </View>
      ) : (
        <ScrollView className="px-4 py-6">
          <View className="gap-6">{fields.map((field) => renderField(field))}</View>
        </ScrollView>
      )}
    </FullScreenModal>
  );
}
