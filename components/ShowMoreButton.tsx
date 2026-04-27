import { Pressable, PressableProps, Text } from 'react-native';

type ShowMoreButtonProps = {
  onPress: () => void;
  label: string;
  className?: string;
} & PressableProps;

export default function ShowMoreButton({
  onPress,
  label,
  className,
  ...rest
}: ShowMoreButtonProps) {
  return (
    <Pressable onPress={onPress} {...rest}>
      <Text className={className ?? 'text-text-accent text-sm font-medium'}>{label}</Text>
    </Pressable>
  );
}
