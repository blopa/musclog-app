import { Check } from 'lucide-react-native';
import { Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';

import { useTheme } from '../../hooks/useTheme';

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

  const webBackdropStyle =
    Platform.OS === 'web'
      ? ({
          position: 'fixed' as const,
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: '100vw',
          height: '100dvh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        } as any)
      : {};

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
                  className="flex-row items-center justify-between px-4 py-4"
                  style={{
                    borderBottomWidth: theme.borderWidth.thin,
                    borderBottomColor: theme.colors.border.dark,
                    backgroundColor: isSelected
                      ? `${theme.colors.accent.primary}15`
                      : 'transparent',
                  }}
                  onPress={() => onSelect(option.value)}
                >
                  <Text
                    className="text-base font-medium"
                    style={{
                      color: isSelected ? theme.colors.accent.primary : theme.colors.text.primary,
                    }}
                  >
                    {option.label}
                  </Text>
                  {isSelected ? (
                    <Check size={theme.iconSize.sm} color={theme.colors.accent.primary} />
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
