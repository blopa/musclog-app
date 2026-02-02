import classNames from 'classnames';
import { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, PressableProps, Text, View } from 'react-native';

import { theme } from '../theme';
import { GoogleLogoSvg } from './icons/GoogleLogoSvg';

interface GoogleSignInButtonProps extends PressableProps {
  children?: ReactNode;
  variant?: 'light' | 'dark';
}

export function GoogleSignInButton({
  children,
  disabled,
  variant = 'dark',
  className,
  ...props
}: GoogleSignInButtonProps) {
  const { t } = useTranslation();
  const isLight = variant === 'light';

  return (
    <Pressable
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={t('connectGoogleAccount.connectWithGoogle')}
      className={classNames(
        'relative h-12 min-w-[183px] flex-row items-center overflow-hidden rounded-[20px] border px-4',
        'transition-[background-color,border-color,box-shadow] duration-[218ms]',
        'hover:shadow-[0_1px_2px_0_rgba(60,64,67,0.30),0_1px_3px_1px_rgba(60,64,67,0.15)]',

        isLight && [
          `border-[${theme.colors.google.borderLight}] bg-white`,
          `disabled:border-[${theme.colors.google.disabledBorderLight}] disabled:bg-[${theme.colors.google.disabledBgLight}]`,
        ],

        !isLight && [
          `border-[${theme.colors.google.borderDark}] bg-[${theme.colors.google.backgroundDark}]`,
          `disabled:border-[${theme.colors.google.disabledBorderDark}] disabled:bg-[${theme.colors.google.disabledBgDark}]`,
        ],

        className
      )}
      {...props}
    >
      {/* Interaction overlay */}
      <View
        pointerEvents="none"
        className={classNames(
          'absolute inset-0 opacity-0 transition-opacity duration-[218ms]',
          isLight ? `bg-[${theme.colors.google.overlayDark}]` : 'bg-white',
          !disabled && 'hover:opacity-[8%] focus:opacity-[12%] active:opacity-[12%]'
        )}
      />

      {/* Disabled overlay (dark only) */}
      {!isLight && disabled ? (
        <View
          className={`absolute inset-0 bg-[${theme.colors.google.overlayLight}] opacity-[12%]`}
        />
      ) : null}

      <View className="flex-row items-center">
        {/* Google icon */}
        <GoogleLogoSvg size={24} className="mr-3" disabled={disabled} />

        {/* Button text */}
        <Text
          numberOfLines={1}
          className={classNames(
            'text-base font-medium tracking-[0.25px]',
            isLight
              ? `text-[${theme.colors.google.textLight}]`
              : `text-[${theme.colors.google.textDark}]`,
            disabled && 'opacity-[38%]'
          )}
        >
          {children || t('connectGoogleAccount.connectWithGoogle')}
        </Text>
      </View>
    </Pressable>
  );
}
