import { addTransparency, CustomThemeColorsType, CustomThemeType } from '@/utils/colors';
import React, { useEffect, useRef } from 'react';
import { Animated, Modal, Pressable, StyleSheet } from 'react-native';
import { useTheme } from 'react-native-paper';

type BottomPageModalProps = {
    children: React.ReactNode;
    isVisible: boolean;
    toggleToolsMenu: () => void;
};

const BottomPageModal = ({ children, isVisible, toggleToolsMenu }: BottomPageModalProps) => {
    const { colors } = useTheme<CustomThemeType>();
    const styles = makeStyles(colors);

    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(300)).current;

    useEffect(() => {
        if (isVisible) {
            Animated.parallel([
                Animated.timing(fadeAnim, {
                    duration: 300,
                    toValue: 1,
                    useNativeDriver: true,
                }),
                Animated.timing(slideAnim, {
                    duration: 300,
                    toValue: 0,
                    useNativeDriver: true,
                }),
            ]).start();
        } else {
            Animated.parallel([
                Animated.timing(fadeAnim, {
                    duration: 300,
                    toValue: 0,
                    useNativeDriver: true,
                }),
                Animated.timing(slideAnim, {
                    duration: 300,
                    toValue: 300,
                    useNativeDriver: true,
                }),
            ]).start();
        }
    }, [isVisible, fadeAnim, slideAnim]);

    return (
        <Modal animationType="none" onRequestClose={toggleToolsMenu} transparent={true} visible={isVisible}>
            <Pressable onPress={toggleToolsMenu} style={styles.modalOverlay}>
                <Animated.View style={[styles.modalWrapper, { opacity: fadeAnim }]}>
                    <Pressable onPress={() => { }}>
                        <Animated.View style={[styles.toolsMenu, { transform: [{ translateY: slideAnim }] }]}>
                            {children}
                        </Animated.View>
                    </Pressable>
                </Animated.View>
            </Pressable>
        </Modal>
    );
};

const makeStyles = (colors: CustomThemeColorsType) => StyleSheet.create({
    modalOverlay: {
        alignItems: 'center',
        backgroundColor: addTransparency(colors.background, 0.5),
        flex: 1,
        justifyContent: 'flex-end',
    },
    modalWrapper: {
        width: '100%',
    },
    toolsMenu: {
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        padding: 16,
        width: '100%',
    },
});

export default BottomPageModal;
