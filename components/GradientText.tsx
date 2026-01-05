import { Text } from 'react-native';
import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';

type GradientTextProps = {
  colors: readonly [string, string, ...string[]];
  style?: any;
  children: React.ReactNode;
};

export function GradientText({ colors, style, children }: GradientTextProps) {
  return (
    <MaskedView
      maskElement={
        <Text className="bg-transparent" style={style}>
          {children}
        </Text>
      }>
      <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
        <Text className="bg-transparent" style={[style, { opacity: 0 }]}>
          {children}
        </Text>
      </LinearGradient>
    </MaskedView>
  );
}
