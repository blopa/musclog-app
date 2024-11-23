import { FC } from 'react';
import { StyleSheet, View, ViewProps } from 'react-native';
import { SafeAreaView, SafeAreaViewProps } from 'react-native-safe-area-context';

type ScreenProps = ViewProps &
    (
        | { hideSafeArea: true }
        | {
              hideSafeArea?: false;
              safeAreaMode?: SafeAreaViewProps['mode'];
              safeAreaEdges?: SafeAreaViewProps['edges'];
          }
    );

export const Screen: FC<ScreenProps> = (props) => {
    const { children, style, ...rest } = props;

    if (props.hideSafeArea) {
        return (
            <View style={[styles.container, style]} {...rest}>
                {children}
            </View>
        );
    }

    return (
        <SafeAreaView
            mode={props.safeAreaMode ?? 'padding'}
            // No top safe area by default because all the screens are wrapped in a drawer
            edges={props.safeAreaEdges ?? ['bottom', 'left', 'right']}
            style={[styles.container, style]}
            {...rest}
        >
            {children}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
});
