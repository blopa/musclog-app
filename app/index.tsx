import Dashboard from '@/app/dashboard';
import CurrentWorkout from '@/app/workout';
import { DARK, LIGHT } from '@/constants/colors';
import { CustomThemeType } from '@/utils/colors';
import { FontAwesome5 } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useFocusEffect } from 'expo-router';
import 'react-native-url-polyfill/auto';
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { BackHandler } from 'react-native';
import { useTheme } from 'react-native-paper';
import SystemNavigationBar from 'react-native-system-navigation-bar';

const Tab = createBottomTabNavigator();

function Index() {
    const { t } = useTranslation();
    const { dark } = useTheme<CustomThemeType>();

    useFocusEffect(
        useCallback(() => {
            SystemNavigationBar.setNavigationColor(
                dark ? '#FFFFFF' : '#121212',
                dark ? DARK : LIGHT,
                'navigation'
            );

            const onBackPress = () => {
                BackHandler.exitApp();
                return true;
            };

            BackHandler.addEventListener('hardwareBackPress', onBackPress);
            return () => {
                SystemNavigationBar.setNavigationColor(
                    dark ? '#121212' : '#E0E0E0',
                    dark ? LIGHT : DARK,
                    'both'
                );

                BackHandler.removeEventListener('hardwareBackPress', onBackPress);
            };
        }, [dark])
    );

    return (
        <Tab.Navigator
            screenOptions={{
                headerShown: false,
                // lazy: true,
            }}
        >
            <Tab.Screen
                component={Dashboard}
                name="home"
                options={{
                    tabBarIcon: ({ color, size }) => (
                        <FontAwesome5 color={color} name="home" size={size} />
                    ),
                    tabBarLabel: t('home'),
                }}
            />
            <Tab.Screen
                component={CurrentWorkout}
                name="workout"
                options={{
                    tabBarIcon: ({ color, size }) => (
                        <FontAwesome5 color={color} name="dumbbell" size={size} />
                    ),
                    tabBarLabel: t('workout'),
                }}
            />
        </Tab.Navigator>
    );
}

export default Index;
