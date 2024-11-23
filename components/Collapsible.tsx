import { CustomThemeType } from '@/utils/colors';
import { Ionicons } from '@expo/vector-icons';
import React, { PropsWithChildren, useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';

export function Collapsible({ children, title }: PropsWithChildren & { title: string }) {
    const [isOpen, setIsOpen] = useState(false);
    const { colors } = useTheme<CustomThemeType>();

    return (
        <View>
            <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setIsOpen((value) => !value)}
                style={styles.heading}>
                <Ionicons
                    color={colors.primary}
                    name={isOpen ? 'chevron-down' : 'chevron-forward-outline'}
                    size={18}
                />
                <Text>{title}</Text>
            </TouchableOpacity>
            {isOpen && <View style={styles.content}>{children}</View>}
        </View>
    );
}

const styles = StyleSheet.create({
    content: {
        marginLeft: 24,
        marginTop: 6,
    },
    heading: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: 6,
    },
});
