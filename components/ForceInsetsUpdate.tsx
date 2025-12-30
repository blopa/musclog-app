import { useAnimatedKeyboard, useAnimatedReaction } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ForceInsetsUpdate() {
    const keyboard = useAnimatedKeyboard();
    const insets = useSafeAreaInsets();

    useAnimatedReaction(
        () => keyboard.height.value,
        (currentKeyboardHeight, previousKeyboardHeight) => {
            if (currentKeyboardHeight !== previousKeyboardHeight) {
                // This empty block triggers the reaction when keyboard height changes
                // It forces the insets to be recalculated
            }
        },
        [insets]
    );

    return null;
}
