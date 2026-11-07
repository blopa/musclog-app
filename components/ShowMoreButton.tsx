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
    // A bare text link is about 12pt tall. It gets the 44pt touch height through its own box, kept
    // inside the heading row it sits in (a negative margin would push the target outside its
    // parent, where iOS discards touches). Callers drop the row's bottom margin to match.
    <Pressable onPress={onPress} className="min-h-11 justify-center" {...rest}>
      <Text className={className ?? 'text-sm font-medium text-text-accent'}>{label}</Text>
    </Pressable>
  );
}
