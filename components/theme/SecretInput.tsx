import { Eye, EyeOff } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable } from 'react-native';

import { useTheme } from '@/hooks/useTheme';

import { TextInput } from './TextInput';
type SecretInputProps = {
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
};

export function SecretInput({ label = '', value, onChangeText, placeholder }: SecretInputProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [visible, setVisible] = useState(false);

  return (
    <TextInput
      label={label}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      secureTextEntry={!visible}
      icon={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t(visible ? 'common.a11y.hideValue' : 'common.a11y.showValue')}
          onPress={() => setVisible((v) => !v)}
        >
          {visible ? (
            <Eye size={theme.iconSize.md} color={theme.colors.text.secondary} />
          ) : (
            <EyeOff size={theme.iconSize.md} color={theme.colors.text.secondary} />
          )}
        </Pressable>
      }
    />
  );
}

export default SecretInput;
