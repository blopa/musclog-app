import { Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Plus } from 'lucide-react-native';
import { theme } from '../theme';

type FloatingActionButtonProps = {
  onPress?: () => void;
  position?: 'left' | 'right';
  bottom?: number;
};

export function FloatingActionButton({
  onPress,
  position = 'right',
  bottom = 24,
}: FloatingActionButtonProps) {
  const positionClass = position === 'left' ? 'left-5' : 'right-5';

  return (
    <Pressable
      className={`absolute ${positionClass} h-16 w-16 rounded-2xl shadow-lg`}
      style={{ bottom }}
      onPress={onPress}>
      <LinearGradient
        colors={[theme.colors.status.purple, theme.colors.accent.secondary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={{
          borderRadius: theme.borderRadius.lg,
          height: theme.components.floatingActionButton.size,
          width: theme.components.floatingActionButton.size,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <Plus size={theme.iconSize['2xl']} color={theme.colors.text.black} strokeWidth={theme.strokeWidth.thick} />
      </LinearGradient>
    </Pressable>
  );
}
