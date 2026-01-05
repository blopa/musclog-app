import { View, Text, Pressable } from 'react-native';
import { Dumbbell, UtensilsCrossed } from 'lucide-react-native';

type ActionButtonVariant = 'workout' | 'food';

type ActionButtonProps = {
  variant: ActionButtonVariant;
  label: string;
  onPress?: () => void;
};

const variantConfig = {
  workout: {
    bgColor: 'bg-[#22c55e]',
    iconBgColor: 'bg-[#16a34a]',
    icon: Dumbbell,
    iconColor: '#0a1f1a',
    textColor: 'text-[#0a1f1a]',
    backgroundIconColor: '#0a1f1a',
  },
  food: {
    bgColor: 'bg-[#1a2f2a]',
    iconBgColor: 'bg-[#243d37]',
    icon: UtensilsCrossed,
    iconColor: '#ffffff',
    textColor: 'text-white',
    backgroundIconColor: '#6b7280',
  },
};

export function ActionButton({ variant, label, onPress }: ActionButtonProps) {
  const config = variantConfig[variant];
  const Icon = config.icon;

  return (
    <Pressable
      className={`relative min-h-[180px] flex-1 justify-between overflow-hidden rounded-3xl ${config.bgColor} p-6`}
      onPress={onPress}>
      <View className={`h-12 w-12 items-center justify-center rounded-full ${config.iconBgColor}`}>
        <Icon size={24} color={config.iconColor} strokeWidth={2.5} />
      </View>
      <Text className={`text-2xl font-bold leading-tight ${config.textColor}`}>{label}</Text>
      <View className="absolute -bottom-6 -right-6 opacity-[0.08]">
        <Icon size={160} color={config.backgroundIconColor} strokeWidth={1} />
      </View>
    </Pressable>
  );
}
