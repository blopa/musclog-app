import React from 'react';
import { Pressable, Text, PressableProps } from 'react-native';
import { useTranslation } from 'react-i18next';

type ShowMoreButtonProps = {
  onPress?: () => void;
  className?: string;
} & PressableProps;

export default function ShowMoreButton({ onPress, className, ...rest }: ShowMoreButtonProps) {
  const { t } = useTranslation();

  return (
    <Pressable onPress={onPress} {...rest}>
      <Text className={className ?? 'text-sm font-medium text-text-accent'}>{t('common.seeAll')}</Text>
    </Pressable>
  );
}
