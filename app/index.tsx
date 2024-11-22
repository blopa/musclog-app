import Dashboard from '@/app/dashboard';
import CurrentWorkout from '@/app/workout';
import { FontAwesome5 } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import * as Sentry from '@sentry/react-native';
import { useFocusEffect } from 'expo-router';
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { BackHandler } from 'react-native';
import 'react-native-url-polyfill/auto';

Sentry.init({
    _experiments: {
        replaysOnErrorSampleRate: 1.0,
        replaysSessionSampleRate: 1.0,
    },
    debug: __DEV__,
    dsn: 'https://e4a649f87e2cf7bc05e3e000cb9ce7ba@o4507421287972864.ingest.de.sentry.io/4507426322579536',
    environment: __DEV__ ? 'development' : 'production',
    integrations: [Sentry.mobileReplayIntegration()],
});

const Tab = createBottomTabNavigator();

function Index() {
    const { t } = useTranslation();

    useFocusEffect(
        useCallback(() => {
            const onBackPress = () => {
                BackHandler.exitApp();
                return true;
            };

            BackHandler.addEventListener('hardwareBackPress', onBackPress);
            return () => {
                BackHandler.removeEventListener('hardwareBackPress', onBackPress);
            };
        }, [])
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

export default Sentry.wrap(Index);
