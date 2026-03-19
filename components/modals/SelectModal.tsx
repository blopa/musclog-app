import React from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';

import { useTheme } from '../../hooks/useTheme';
import { Button } from '../theme/Button';

export interface SelectOption {
  label: string;
  value: string;
}

interface SelectModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  options: SelectOption[];
  selectedValue: string;
  onSelect: (value: string) => void;
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

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        className="flex-1 items-center justify-center p-4"
        style={{ backgroundColor: theme.colors.overlay.black60 }}
        onPress={onClose}
      >
        <Pressable
          className="w-full max-w-sm rounded-2xl border bg-bg-cardDark p-6"
          style={{ borderColor: theme.colors.background.white10 }}
          onPress={(e) => e.stopPropagation()}
        >
          <Text className="mb-6 text-xl font-bold text-text-primary">{title}</Text>

          <ScrollView className="max-h-80" showsVerticalScrollIndicator={false}>
            <View className="gap-2">
              {options.map((option) => (
                <Pressable
                  key={option.value}
                  onPress={() => onSelect(option.value)}
                  className={`rounded-xl border p-4 ${
                    selectedValue === option.value
                      ? 'border-accent-primary bg-accent-primary/10'
                      : 'border-background-white5 bg-background-white5'
                  }`}
                  style={{
                    borderColor:
                      selectedValue === option.value
                        ? theme.colors.accent.primary
                        : theme.colors.background.white5,
                    backgroundColor:
                      selectedValue === option.value
                        ? theme.colors.accent.primary10
                        : theme.colors.background.white5,
                  }}
                >
                  <Text
                    className={`text-center text-base font-semibold ${
                      selectedValue === option.value ? 'text-accent-primary' : 'text-text-primary'
                    }`}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>

          <View className="mt-8">
            <Button label="Cancel" variant="outline" size="md" width="full" onPress={onClose} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
