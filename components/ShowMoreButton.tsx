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
    // A bare text link is about 12pt tall. It sits in a heading row, so it gets the 44pt touch
    // height through padding and takes the same back as negative margin: the row does not grow.
    <Pressable onPress={onPress} className="-my-3 min-h-11 justify-center" {...rest}>
      <Text className={className ?? 'text-sm font-medium text-text-accent'}>{label}</Text>
    </Pressable>
  );
}
