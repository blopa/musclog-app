import AISettings from '@/app/aiSettings';
import Chat from '@/app/chat';
import CreateExercise from '@/app/createExercise';
import CreateFitnessGoals from '@/app/createFitnessGoals';
import CreateFood from '@/app/createFood';
import CreateRecentWorkout from '@/app/createRecentWorkout';
import CreateUserMeasurements from '@/app/createUserMeasurements';
import CreateUserMetrics from '@/app/createUserMetrics';
import CreateUserNutrition from '@/app/createUserNutrition';
import CreateWorkout from '@/app/createWorkout';
import FoodDetails from '@/app/foodDetails';
import FoodLog from '@/app/foodLog';
import FoodSearch from '@/app/foodSearch';
import Index from '@/app/index';
import ListExercises from '@/app/listExercises';
import ListFitnessGoals from '@/app/listFitnessGoals';
import ListUserMeasurements from '@/app/listUserMeasurements';
import ListUserMetrics from '@/app/listUserMetrics';
import ListUserNutrition from '@/app/listUserNutrition';
import ListWorkouts from '@/app/listWorkouts';
import OneRepMaxes from '@/app/oneRepMaxes';
import Profile from '@/app/profile';
import RecentWorkoutDetails from '@/app/recentWorkoutDetails';
import RecentWorkouts from '@/app/recentWorkouts';
import Settings from '@/app/settings';
// import TestScreen from '@/app/test';
import UserMetricsCharts from '@/app/userMetricsCharts';
import WorkoutDetails from '@/app/workoutDetails';
import Onboarding from '@/components/Onboarding';
import { Screen } from '@/components/Screen';
import { DARK, LIGHT } from '@/constants/colors';
import {
    AI_SETTINGS_TYPE,
    HAS_COMPLETED_ONBOARDING,
} from '@/constants/storage';
import { useCustomTheme } from '@/storage/CustomThemeProvider';
import { useSettings } from '@/storage/SettingsContext';
import { useUnreadMessages } from '@/storage/UnreadMessagesProvider';
import { getAiApiVendor } from '@/utils/ai';
import {
    addTransparency,
    CustomDarkTheme,
    CustomLightTheme,
    CustomThemeColorsType,
    CustomThemeType,
} from '@/utils/colors';
import 'react-native-reanimated';
import {
    getLatestUser,
} from '@/utils/database';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    createDrawerNavigator,
    DrawerContentComponentProps,
    DrawerContentScrollView,
    DrawerItem,
    DrawerItemList,
} from '@react-navigation/drawer';
import { NavigationProp, useNavigation } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { ActivityIndicator, useTheme } from 'react-native-paper';
import SystemNavigationBar from 'react-native-system-navigation-bar';

import packageJson from '../package.json';

const Drawer = createDrawerNavigator();

interface CustomDrawerContentProps extends DrawerContentComponentProps {
    isAiEnabled: boolean;
    unreadMessages: number;
}

export default function DrawerMenu() {
    const { theme: colorScheme } = useCustomTheme();
    const { unreadMessages } = useUnreadMessages();
    const [isAiEnabled, setIsAiEnabled] = useState(false);
    const [showUserMetrics, setShowUserMetrics] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const { t } = useTranslation();
    const [onboardingCompleted, setOnboardingCompleted] = useState(false);

    const { getSettingByType, settings } = useSettings();

    useEffect(() => {
        SystemNavigationBar.setNavigationColor(
            colorScheme === DARK ? '#121212' : '#E0E0E0',
            colorScheme === DARK ? LIGHT : DARK,
            'both'
        );

        // ExpoStatusBar.setStatusBarBackgroundColor(colorScheme === DARK ? '#212121' : '#E0E0E0');
        // SystemNavigationBar.setBarMode(colorScheme as typeof LIGHT | typeof DARK, 'both');
    }, [colorScheme, settings]);

    const checkDynamicMenuItems = useCallback(async () => {
        const vendor = await getAiApiVendor();
        const isAiSettingsEnabled = await getSettingByType(AI_SETTINGS_TYPE);

        const hasAiEnabled = Boolean(vendor) && isAiSettingsEnabled?.value === 'true';
        setIsAiEnabled(hasAiEnabled);

        const user = await getLatestUser();
        if (user?.metrics.weight || user?.metrics.fatPercentage) {
            setShowUserMetrics(true);
        }
    }, [getSettingByType]);

    useEffect(() => {
        checkDynamicMenuItems();
    }, [checkDynamicMenuItems, settings]);

    const routes = useMemo(() => {
        const routes = [
            // { component: UpcomingWorkouts, label: 'upcoming_workouts', name: 'upcomingWorkouts' },
            { component: Profile, label: 'profile', name: 'profile' },
            // { component: TestScreen, label: 'test', name: 'test' },
            { component: ListWorkouts, label: 'workouts', name: 'listWorkouts' },
            { component: FoodLog, label: 'food_log', name: 'foodLog' },
            { component: RecentWorkouts, label: 'recent_workouts', name: 'recentWorkouts' },
            { component: UserMetricsCharts, hidden: !showUserMetrics, label: 'user_metrics_charts', name: 'userMetricsCharts' },
            { component: Settings, label: 'settings', name: 'settings' },

            // Hidden routes
            { component: Chat, hidden: true, label: 'chat', name: 'chat' },
            { component: Index, hidden: true, label: 'home', name: 'index' },
            { component: OneRepMaxes, hidden: true, label: 'one_rep_maxes', name: 'oneRepMaxes' },
            { component: CreateWorkout, hidden: true, label: 'create_workout', name: 'createWorkout' },
            { component: ListUserMetrics, hidden: true, label: 'user_metrics', name: 'listUserMetrics' },
            { component: WorkoutDetails, hidden: true, label: 'workout_details', name: 'workoutDetails' },
            { component: CreateExercise, hidden: true, label: 'create_exercise', name: 'createExercise' },
            // { component: ScheduleWorkout, hidden: true, label: 'schedule_workout', name: 'scheduleWorkout' },
            { component: ListUserNutrition, hidden: true, label: 'user_nutrition', name: 'listUserNutrition' },
            { component: CreateUserMetrics, hidden: true, label: 'create_user_metrics', name: 'createUserMetrics' },
            { component: ListUserMeasurements, hidden: true, label: 'list_user_measurements', name: 'listUserMeasurements' },
            { component: CreateUserMeasurements, hidden: true, label: 'create_user_measurements', name: 'createUserMeasurements' },
            { component: CreateUserNutrition, hidden: true, label: 'create_user_nutrition', name: 'createUserNutrition' },
            { component: CreateRecentWorkout, hidden: true, label: 'create_recent_workout', name: 'createRecentWorkout' },
            { component: RecentWorkoutDetails, hidden: true, label: 'recent_workout_details', name: 'recentWorkoutDetails' },
            { component: FoodSearch, hidden: true, label: 'food_search', name: 'foodSearch' },
            { component: FoodDetails, hidden: true, label: 'food_details', name: 'foodDetails' },
            { component: CreateFood, hidden: true, label: 'create_food', name: 'createFood' },
            { component: ListFitnessGoals, hidden: true, label: 'fitness_goals', name: 'listFitnessGoals' },
            { component: CreateFitnessGoals, hidden: true, label: 'create_fitness_goals', name: 'createFitnessGoals' },
            { component: ListExercises, hidden: true, label: 'exercises', name: 'listExercises' },
            { component: AISettings, hidden: true, label: 'ai_settings', name: 'aiSettings' },
        ];

        return routes;
    }, [showUserMetrics]);

    useEffect(() => {
        const checkOnboarding = async () => {
            setIsLoading(true);
            try {
                const onboardingStatus = await AsyncStorage.getItem(HAS_COMPLETED_ONBOARDING);
                setIsLoading(false);
                if (onboardingStatus === 'true') {
                    setOnboardingCompleted(true);
                }
            } catch (error) {
                console.error('Failed to check onboarding status:', error);
            }
        };

        checkOnboarding();
    }, []);

    const theme = colorScheme === DARK ? CustomDarkTheme : CustomLightTheme;
    const styles = makeStyles(theme.colors, colorScheme === DARK, '');

    if (isLoading) {
        return (
            <View style={styles.overlay}>
                <ActivityIndicator color={theme.colors.primary} size="large" />
            </View>
        );
    }

    if (!onboardingCompleted) {
        return (
            <Screen
                style={{
                    backgroundColor: theme.colors.background,
                    flex: 1,
                }}
            >
                <Onboarding onFinish={() => setOnboardingCompleted(true)} />
            </Screen>
        );
    }

    return (
        <Drawer.Navigator
            drawerContent={(props) => (
                <CustomDrawerContent
                    {...props}
                    isAiEnabled={isAiEnabled}
                    unreadMessages={unreadMessages}
                />
            )}
            initialRouteName="index"
            screenOptions={{
                headerBackground: () => (
                    <View
                        style={{
                            backgroundColor: theme.colors.background,
                            // height: StatusBar.currentHeight || 0,
                        }}
                    />
                ),
                headerBackgroundContainerStyle: {
                    backgroundColor: theme.colors.background,
                },
                headerTintColor: theme.colors.onBackground,
                headerTitleStyle: {
                    fontWeight: 'bold',
                },
            }}
        >
            {routes.map((route) => (
                <Drawer.Screen
                    component={route.component}
                    key={route.name}
                    name={route.name}
                    options={{
                        drawerItemStyle: route.hidden ? { display: 'none' } : undefined,
                        drawerLabel: t(route.label),
                        headerTitle: '',
                    }}
                />
            ))}
        </Drawer.Navigator>
    );
}

function CustomDrawerContent(props: CustomDrawerContentProps) {
    const currentRoute = props.state.routeNames[props.state.index];
    const { colors, dark } = useTheme<CustomThemeType>();
    const styles = makeStyles(colors, dark, currentRoute);
    const { t } = useTranslation();
    const navigation = useNavigation<NavigationProp<any>>();

    return (
        <DrawerContentScrollView {...props} contentContainerStyle={styles.drawerContainer}>
            <View>
                <DrawerItem
                    focused={currentRoute === 'index'}
                    label={() => (
                        <View style={styles.customItem}>
                            <Text style={styles.indexItemText}>
                                {t('home')}
                            </Text>
                        </View>
                    )}
                    onPress={() => navigation.navigate('index')}
                />
                {props.isAiEnabled && (
                    <DrawerItem
                        focused={currentRoute === 'chat'}
                        label={() => (
                            <View style={styles.customItem}>
                                <Text style={styles.chatItemText}>
                                    {t('chat')}
                                </Text>
                                {props.unreadMessages > 0 && (
                                    <View style={styles.badge}>
                                        <Text style={styles.badgeText}>{props.unreadMessages}</Text>
                                    </View>
                                )}
                            </View>
                        )}
                        onPress={() => navigation.navigate('chat')}
                    />
                )}
                <DrawerItemList {...props} />
            </View>
            <View style={styles.footer}>
                <Text style={styles.footerText}>{`v${packageJson.version}`}</Text>
            </View>
        </DrawerContentScrollView>
    );
}

const determineTextColor = (currentRoute: string, dark: boolean, targetRoute: string) => {
    if (currentRoute === targetRoute) {
        return '#007aff';
    }

    return '#1c1c1ead';
};

const makeStyles = (colors: CustomThemeColorsType, dark: boolean, currentRoute: string) => StyleSheet.create({
    badge: {
        alignItems: 'center',
        backgroundColor: colors.tertiary,
        borderRadius: 10,
        height: 20,
        justifyContent: 'center',
        marginLeft: 10,
        width: 20,
    },
    badgeText: {
        color: colors.onTertiary,
        fontSize: 12,
        fontWeight: 'bold',
    },
    chatItemText: {
        color: determineTextColor(currentRoute, dark, 'chat'),
        fontWeight: '500',
    },
    customItem: {
        alignItems: 'center',
        flexDirection: 'row',
    },
    drawerContainer: {
        backgroundColor: '#f5f5f5',
        flex: 1,
        justifyContent: 'space-between',
    },
    footer: {
        alignItems: 'center',
        borderTopColor: colors.shadow,
        borderTopWidth: 1,
        padding: 10,
    },
    footerText: {
        color: '#212121',
    },
    indexItemText: {
        color: determineTextColor(currentRoute, dark, 'index'),
        fontWeight: '500',
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        backgroundColor: addTransparency(colors.background, 0.5),
        flex: 1,
        justifyContent: 'center',
    },
});
