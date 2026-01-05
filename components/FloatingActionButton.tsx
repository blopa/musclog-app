import { Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Plus } from 'lucide-react-native';

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
        colors={['#a78bfa', '#34d399']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={{
          borderRadius: 16,
          height: 64,
          width: 64,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <Plus size={28} color="#000000" strokeWidth={3} />
      </LinearGradient>
    </Pressable>
  );
}
