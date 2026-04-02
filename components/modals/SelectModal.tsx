import { Check } from 'lucide-react-native';
import { Platform, Pressable, ScrollView, Text, View } from 'react-native';

import { useTheme } from '../../hooks/useTheme';
import { useWebModalLayerStyle } from '../../utils/webPhoneFrame';
import { Modal } from '../theme/Modal';

interface SelectOption {
  label: string;
  value: string;
}

interface SelectModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  options: SelectOption[];
  selectedValue: string;
  onSelect: (val: string) => void;
}

export function SelectModal({
  visible,
  onClose,
  title,
  options,
  selectedValue,
  onSelect,
}: SelectModalProps) {
  const theme = useTheme();

  const webBackdropStyle = useWebModalLayerStyle({ variant: 'centered' });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent={Platform.OS !== 'web'}
    >
      <Pressable
        className="flex-1 items-center justify-center p-4"
        style={[{ backgroundColor: theme.colors.overlay.black60 }, webBackdropStyle]}
        onPress={onClose}
      >
        <Pressable
          className="w-full overflow-hidden rounded-xl border border-border-dark"
          style={{
            backgroundColor: theme.colors.background.cardElevated,
            maxWidth: theme.size['384'],
          }}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <View
            className="border-b border-border-dark px-4 py-5"
            style={{ backgroundColor: theme.colors.background.cardElevated }}
          >
            <Text className="text-xl font-bold text-text-primary">{title}</Text>
          </View>

          {/* Options */}
          <ScrollView style={{ maxHeight: 320 }}>
            {options.map((option) => {
              const isSelected = option.value === selectedValue;
              return (
                <Pressable
                  key={option.value}
                  className="overflow-hidden"
                  style={{
                    borderBottomWidth: theme.borderWidth.thin,
                    borderBottomColor: theme.colors.border.dark,
                    backgroundColor: isSelected
                      ? `${theme.colors.accent.primary}15`
                      : 'transparent',
                  }}
                  onPress={() => onSelect(option.value)}
                >
                  <View className="flex-row items-center justify-between px-4 py-4">
                    <Text
                      className="min-w-0 flex-1 text-base font-medium"
                      style={{
                        color: isSelected ? theme.colors.accent.primary : theme.colors.text.primary,
                      }}
                    >
                      {option.label}
                    </Text>
                    {isSelected ? (
                      <View className="shrink-0 justify-center pl-2">
                        <Check size={theme.iconSize.sm} color={theme.colors.accent.primary} />
                      </View>
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
