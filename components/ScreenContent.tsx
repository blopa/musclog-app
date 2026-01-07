import React from 'react';
import { Text, View } from 'react-native';
import { EditScreenInfo } from './EditScreenInfo';
import { theme } from '../theme';

type ScreenContentProps = {
  title: string;
  path: string;
  children?: React.ReactNode;
};

export const ScreenContent = ({ title, path, children }: ScreenContentProps) => {
  return (
    <View className={styles.container}>
      <Text className={styles.title}>{title}</Text>
      <View
        className={styles.separator}
        style={{ backgroundColor: theme.colors.background.separatorLight }}
      />
      <EditScreenInfo path={path} />
      {children}
    </View>
  );
};

const styles = {
  container: `items-center flex-1 justify-center bg-white`,
  separator: `h-[1px] my-7 w-4/5`,
  title: `text-xl font-bold`,
};
