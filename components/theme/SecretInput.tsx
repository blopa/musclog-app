import React, { useState } from 'react';
import { Pressable } from 'react-native';
import { Eye, EyeOff } from 'lucide-react-native';
import { TextInput } from './TextInput';
import { theme } from '../../theme';

type SecretInputProps = {
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
};

export function SecretInput({ label = '', value, onChangeText, placeholder }: SecretInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <TextInput
      label={label}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      secureTextEntry={!visible}
      icon={
        <Pressable onPress={() => setVisible((v) => !v)}>
          {visible ? (
            <Eye size={18} color={theme.colors.text.secondary} />
          ) : (
            <EyeOff size={18} color={theme.colors.text.secondary} />
          )}
        </Pressable>
      }
    />
  );
}

export default SecretInput;
