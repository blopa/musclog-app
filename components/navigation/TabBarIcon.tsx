// You can explore the built-in icon families and icons on the web at https://icons.expo.fyi/

import { Ionicons } from '@expo/vector-icons';
import { type IconProps } from '@expo/vector-icons/build/createIconSet';
import { type ComponentProps } from 'react';

type TabBarIconProps = IconProps<ComponentProps<typeof Ionicons>['name']>;

export function TabBarIcon({ style, ...rest }: TabBarIconProps) {
    return <Ionicons size={28} style={[{ marginBottom: -3 }, style]} {...rest} />;
}
