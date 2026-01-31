import React from 'react';
import { Pressable, Text } from 'react-native';
import { theme } from '../theme';

interface MaybeLaterButtonProps {
  onPress: () => void;
  text: string;
  fullWidth?: boolean;
}

export function MaybeLaterButton({ onPress, text, fullWidth = true }: MaybeLaterButtonProps) {
  return (
    <Pressable
      className={`${fullWidth ? 'w-full' : ''} items-center py-2 active:opacity-70`}
      onPress={onPress}
    >
      <Text className="text-sm font-medium" style={{ color: theme.colors.text.gray500 }}>
        {text}
      </Text>
    </Pressable>
  );
}
