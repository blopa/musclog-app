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
import CustomErrorBoundary from '@/components/CustomErrorBoundary';
import ForceInsetsUpdate from '@/components/ForceInsetsUpdate';
import Onboarding from '@/components/Onboarding';
import { Screen } from '@/components/Screen';
import { DARK, LIGHT, SYSTEM_DEFAULT } from '@/constants/colors';
import {
    AI_SETTINGS_TYPE,
    BUG_REPORT_TYPE,
    FIRST_BOOT,
    GEMINI_API_KEY_TYPE,
    HAS_COMPLETED_ONBOARDING,
    LANGUAGE_CHOICE_TYPE,
    LAST_TIME_APP_USED,
    THEME_CHOICE_TYPE,
} from '@/constants/storage';
import i18n, { getExerciseData, LanguageKeys } from '@/lang/lang';
import { ChatProvider, useChatData } from '@/storage/ChatProvider';
import { CustomThemeProvider, useCustomTheme } from '@/storage/CustomThemeProvider';
import { HealthConnectProvider } from '@/storage/HealthConnectProvider';
import { LayoutReloaderProvider } from '@/storage/LayoutReloaderProvider';
import { SettingsProvider, useSettings } from '@/storage/SettingsContext';
import { SnackbarProvider } from '@/storage/SnackbarProvider';
import { UnreadMessagesProvider, useUnreadMessages } from '@/storage/UnreadMessagesProvider';
import { getAiApiVendor, isAllowedLocation } from '@/utils/ai';
import {
    addTransparency,
    CustomDarkTheme,
    CustomLightTheme,
    CustomThemeColorsType,
    CustomThemeType,
} from '@/utils/colors';
import {
    addAlcoholAndFiberMacroToWorkoutEventTable,
    addAlcoholMacroToUserNutritionTable,
    addExercise,
    addMacrosToWorkoutEventTable,
    addMealTypeGramsToUserNutritionTable,
    addOrUpdateSetting,
    addOrUpdateUser,
    addUserMeasurementsTable,
    addVersioning,
    countExercises,
    createFitnessGoalsTable,
    createFoodTable,
    createMigrationsTable,
    createNewWorkoutTables,
    getLatestUser,
    getUser,
} from '@/utils/database';
import { getCurrentTimestampISOString } from '@/utils/date';
import { getEncryptionKey } from '@/utils/encryption';
import { getLatestHealthConnectData } from '@/utils/healthConnect';
import { captureException, captureMessage } from '@/utils/sentry';
import { getDecrypter } from '@/utils/storage';
import { ExerciseInsertType } from '@/utils/types';
import { FontAwesome } from '@expo/vector-icons';
import 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    createDrawerNavigator,
    DrawerContentComponentProps,
    DrawerContentScrollView,
    DrawerItem,
    DrawerItemList,
} from '@react-navigation/drawer';
import * as Sentry from '@sentry/react-native';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { I18nextProvider, useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { ActivityIndicator, PaperProvider, useTheme } from 'react-native-paper';
import { initialWindowMetrics, SafeAreaProvider } from 'react-native-safe-area-context';
import SystemNavigationBar from 'react-native-system-navigation-bar';

import packageJson from '../package.json';

// export {
//     ErrorBoundary,
// } from 'expo-router';

export const unstable_settings = {
    initialRouteName: 'index',
};

SplashScreen.preventAutoHideAsync();

const Drawer = createDrawerNavigator();

interface CustomDrawerContentProps extends DrawerContentComponentProps {
    isAiEnabled: boolean;
    unreadMessages: number;
}

export default function MasterRootLayout() {
    return (
        <CustomErrorBoundary>
            <LayoutReloaderProvider>
                <SettingsProvider>
                    <CustomThemeProvider>
                        <ChatProvider>
                            <UnreadMessagesProvider>
                                <RootLayout />
                            </UnreadMessagesProvider>
                        </ChatProvider>
                    </CustomThemeProvider>
                </SettingsProvider>
            </LayoutReloaderProvider>
        </CustomErrorBoundary>
    );
}

function CustomDrawerContent(props: CustomDrawerContentProps) {
    const currentRoute = props.state.routeNames[props.state.index];
    const { colors, dark } = useTheme<CustomThemeType>();
    const styles = makeStyles(colors, dark, currentRoute);
    const { t } = useTranslation();

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
                    onPress={() => props.navigation.navigate('index')}
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
                        onPress={() => props.navigation.navigate('chat')}
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

function RootLayout() {
    const { theme: colorScheme } = useCustomTheme();
    const { addNewChat } = useChatData();
    const { increaseUnreadMessages } = useUnreadMessages();
    const { getSettingByType } = useSettings();

    const [loaded, error] = useFonts({
        SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
        ...FontAwesome.font,
    });

    useEffect(() => {
        if (error) {
            throw error;
        }
    }, [error]);

    useEffect(() => {
        if (loaded) {
            SplashScreen.hideAsync();
        }
    }, [loaded]);

    useEffect(() => {
        const initializeApp = async () => {
            const isFirstBoot = await AsyncStorage.getItem(FIRST_BOOT);

            if (isFirstBoot === null) {
                await AsyncStorage.setItem(FIRST_BOOT, 'true');
                const count = await countExercises();

                const exercisesData = getExerciseData(i18n.language as LanguageKeys);
                if (count === 0) {
                    // Just to make sure we have the encryption key created
                    await getEncryptionKey();

                    for (const exercise of exercisesData as ExerciseInsertType[]) {
                        await addExercise(exercise);
                    }

                    const encryptedKey = process.env.EXPO_PUBLIC_ENCRYPTED_GEMINI_API_KEY;
                    try {
                        if (encryptedKey) {
                            const decrypter = getDecrypter();
                            const key = decrypter(encryptedKey);

                            if (await isAllowedLocation(key, GEMINI_API_KEY_TYPE)) {
                                await addOrUpdateSetting({
                                    type: GEMINI_API_KEY_TYPE,
                                    value: key,
                                });
                            } else {
                                captureMessage('Country not allowed!');
                            }
                        } else {
                            captureMessage('No GEMINI encrypted key found');
                        }
                    } catch (error) {
                        captureException({
                            encryptedKey,
                            error,
                        });
                    }

                    await addOrUpdateUser({});
                    await addOrUpdateSetting({
                        type: THEME_CHOICE_TYPE,
                        value: SYSTEM_DEFAULT,
                    });
                    await addOrUpdateSetting({
                        type: LANGUAGE_CHOICE_TYPE,
                        value: i18n.language,
                    });
                    await addOrUpdateSetting({
                        type: BUG_REPORT_TYPE,
                        value: 'true',
                    });
                    // await addOrUpdateSetting({
                    //     type: USE_FAT_PERCENTAGE_TDEE_TYPE,
                    //     value: 'false',
                    // });

                    console.log('Data seeded successfully');

                    // const lang = await getSetting(LANGUAGE_CHOICE_TYPE);
                    // await i18n.changeLanguage(lang?.value || EN_US);

                    increaseUnreadMessages(1);
                    // set version for the first time
                    await addVersioning(packageJson.version);

                    const user = await getUser();
                    const userName = user?.name ? user.name : i18n.t('default_name');
                    const fitnessGoalMessage = user?.fitnessGoals
                        ? i18n.t('goal_message', { fitnessGoals: i18n.t(user?.fitnessGoals) })
                        : '';

                    await addNewChat({
                        createdAt: getCurrentTimestampISOString(),
                        message: `${i18n.t('greeting_message', { name: userName })}${fitnessGoalMessage} ${i18n.t('ending_message')}`,
                        misc: '',
                        sender: 'assistant',
                        type: 'text',
                    });
                } else {
                    console.log('Exercises table is not empty, skipping seeding');
                }
            }

            const user = await getUser();
            if (user) {
                await getLatestHealthConnectData();
            }

            // TODO: migrations only work if user update on every version
            // every time it's out, which is not ideal
            // await addVersioning('0.0.1'); // for debugging
            await addMacrosToWorkoutEventTable();
            await addUserMeasurementsTable();
            await addAlcoholAndFiberMacroToWorkoutEventTable();
            await addAlcoholMacroToUserNutritionTable();
            await createNewWorkoutTables();
            await addMealTypeGramsToUserNutritionTable();
            await createFoodTable();
            await createFitnessGoalsTable();
            await createMigrationsTable();

            // update to latest version
            await addVersioning(packageJson.version);
            console.log(`Database schema updated to version ${packageJson.version}.`);

            const shouldInitSentry = await getSettingByType(BUG_REPORT_TYPE);

            if (shouldInitSentry) {
                Sentry.init({
                    _experiments: {
                        replaysOnErrorSampleRate: 1.0,
                        replaysSessionSampleRate: 1.0,
                    },
                    debug: __DEV__,
                    dsn: 'https://e4a649f87e2cf7bc05e3e000cb9ce7ba@o4507421287972864.ingest.de.sentry.io/4507426322579536',
                    environment: __DEV__ ? 'development' : 'production',
                    integrations: [
                        Sentry.mobileReplayIntegration(),
                    ],
                });
            }

            await AsyncStorage.setItem(LAST_TIME_APP_USED, getCurrentTimestampISOString());
        };

        initializeApp();
    }, [addNewChat, increaseUnreadMessages]);

    if (!loaded) {
        return null;
    }

    const theme = colorScheme === DARK ? CustomDarkTheme : CustomLightTheme;
    return (
        <PaperProvider theme={theme}>
            {/*<ExpoStatusBar.StatusBar*/}
            {/*    backgroundColor={theme.colors.background}*/}
            {/*/>*/}
            <ForceInsetsUpdate />
            <I18nextProvider i18n={i18n}>
                <HealthConnectProvider>
                    <SnackbarProvider>
                        <SafeAreaProvider initialMetrics={initialWindowMetrics}>
                            <RootLayoutNav />
                        </SafeAreaProvider>
                    </SnackbarProvider>
                </HealthConnectProvider>
            </I18nextProvider>
        </PaperProvider>
    );
}

function RootLayoutNav() {
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
