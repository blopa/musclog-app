import { Pressable, View, Text, PressableProps } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import classNames from 'classnames';

interface GoogleSignInButtonProps extends PressableProps {
  children?: React.ReactNode;
  variant?: 'light' | 'dark';
}

export function GoogleSignInButton({
  children,
  disabled,
  variant = 'dark',
  className,
  ...props
}: GoogleSignInButtonProps) {
  const isLight = variant === 'light';

  return (
    <Pressable
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel="Connect with Google"
      className={classNames(
        'relative h-10 min-w-min max-w-[400px] flex-row items-center overflow-hidden rounded-[20px] border px-3',
        'transition-[background-color,border-color,box-shadow] duration-[218ms]',
        'hover:shadow-[0_1px_2px_0_rgba(60,64,67,0.30),0_1px_3px_1px_rgba(60,64,67,0.15)]',

        isLight && [
          'border-[#747775] bg-white',
          'disabled:border-[#1f1f1f1f] disabled:bg-[#ffffff61]',
        ],

        !isLight && [
          'border-[#8e918f] bg-[#131314]',
          'disabled:border-[#8e918f1f] disabled:bg-[#13131461]',
        ],

        className
      )}
      {...props}>
      {/* Interaction overlay */}
      <View
        pointerEvents="none"
        className={classNames(
          'absolute inset-0 opacity-0 transition-opacity duration-[218ms]',
          isLight ? 'bg-[#303030]' : 'bg-white',
          !disabled && 'hover:opacity-[8%] focus:opacity-[12%] active:opacity-[12%]'
        )}
      />

      {/* Disabled overlay (dark only) */}
      {!isLight && disabled && <View className="absolute inset-0 bg-[#e3e3e3] opacity-[12%]" />}

      <View className="w-full flex-row items-center">
        {/* Google icon */}
        <View className={classNames('mr-2.5 h-5 w-5', disabled && 'opacity-[38%]')}>
          <Svg viewBox="0 0 48 48" width="100%" height="100%">
            <Path
              fill="#EA4335"
              d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
            />
            <Path
              fill="#4285F4"
              d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
            />
            <Path
              fill="#FBBC05"
              d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
            />
            <Path
              fill="#34A853"
              d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
            />
          </Svg>
        </View>

        {/* Button text */}
        <Text
          numberOfLines={1}
          className={classNames(
            'flex-1 text-sm font-medium tracking-[0.25px]',
            isLight ? 'text-[#1f1f1f]' : 'text-[#e3e3e3]',
            disabled && 'opacity-[38%]'
          )}>
          {children || 'Connect with Google'}
        </Text>
      </View>
    </Pressable>
  );
}
