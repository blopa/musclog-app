import { FAB_ICON_SIZE } from '@/constants/ui';
import { CustomThemeColorsType, CustomThemeType } from '@/utils/colors';
import { FontAwesome5 } from '@expo/vector-icons';
import React, { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { FAB, FABGroupProps, useTheme } from 'react-native-paper';

interface FABWrapperProps {
    actions: FABGroupProps['actions'];
    children: React.ReactNode;
    icon?: string;
    visible: boolean;
}

const FABWrapper: React.FC<FABWrapperProps> = ({
    actions,
    children,
    icon = 'plus',
    visible,
}) => {
    const [fabOpen, setFabOpen] = useState(false);
    const { colors, dark } = useTheme<CustomThemeType>();
    const styles = makeStyles(colors, dark);

    const onFabStateChange = useCallback(
        ({ open }: { open: boolean }) => setFabOpen(open),
        []
    );

    return (
        <View style={styles.container}>
            {children}
            {visible && (
                actions.length > 1 ? (
                    <FAB.Group
                        actions={actions}
                        fabStyle={{ backgroundColor: colors.surface }}
                        icon={() => <FontAwesome5 color={colors.primary} name={fabOpen ? 'times-circle' : icon} size={FAB_ICON_SIZE} />}
                        onStateChange={onFabStateChange}
                        open={fabOpen}
                        visible
                    />
                ) : (
                    <FAB
                        icon={actions[0].icon}
                        onPress={actions[0].onPress}
                        style={styles.fabButton}
                    />
                )
            )}
        </View>
    );
};

const makeStyles = (colors: CustomThemeColorsType, dark: boolean) => StyleSheet.create({
    container: {
        flex: 1,
        position: 'relative',
    },
    fabButton: {
        backgroundColor: colors.surface,
        bottom: 16,
        position: 'absolute',
        right: 16,
    },
});

export default FABWrapper;
