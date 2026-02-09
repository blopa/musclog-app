import { ReactNode } from 'react';
import { Text, View } from 'react-native';

import { useTheme } from '../hooks/useTheme';
import { EditScreenInfo } from './EditScreenInfo';

type ScreenContentProps = {
  title: string;
  path: string;
  children?: ReactNode;
};

export const ScreenContent = ({ title, path, children }: ScreenContentProps) => {
  const theme = useTheme();
  return (
    <View className={styles.container}>
      <Text className={styles.title}>{title}</Text>
      <View
        className={styles.separator}
        style={{
          height: theme.spacing.gap['1'],
          backgroundColor: theme.colors.background.separatorLight,
        }}
      />
      <EditScreenInfo path={path} />
      {children}
    </View>
  );
};

const styles = {
  container: `items-center flex-1 justify-center bg-bg-primary`,
  separator: `my-7 w-4/5`,
  title: `text-xl font-bold`,
};
