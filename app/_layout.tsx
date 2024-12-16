// import TestScreen from '@/app/test';
import CustomErrorBoundary from '@/components/CustomErrorBoundary';
import DrawerMenu from '@/components/DrawerMenu';
import ForceInsetsUpdate from '@/components/ForceInsetsUpdate';
import { GEMINI_MODELS, OPENAI_MODELS } from '@/constants/ai';
import { DARK, SYSTEM_DEFAULT } from '@/constants/colors';
import {
    BUG_REPORT_TYPE,
    FIRST_BOOT,
    GEMINI_API_KEY_TYPE,
    GEMINI_MODEL_TYPE,
    LANGUAGE_CHOICE_TYPE,
    LAST_TIME_APP_USED,
    OPENAI_MODEL_TYPE,
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
import { isAllowedLocation } from '@/utils/ai';
import {
    CustomDarkTheme,
    CustomLightTheme,
} from '@/utils/colors';
import { configureDailyTasks, configureWeeklyTasks } from '@/utils/configureDailyTasks';
import { configureNotifications } from '@/utils/configureNotifications';
import {
    addAlcoholAndFiberMacroToWorkoutEventTable,
    addAlcoholMacroToUserNutritionTable,
    addExercise,
    addIsFavoriteToFoodTable,
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
    getUser,
} from '@/utils/database';
import { getCurrentTimestampISOString } from '@/utils/date';
import { getEncryptionKey } from '@/utils/encryption';
import { getLatestHealthConnectData } from '@/utils/healthConnect';
import 'react-native-reanimated';
import { captureException, captureMessage } from '@/utils/sentry';
import { getDecrypter } from '@/utils/storage';
import { ExerciseInsertType } from '@/utils/types';
import { FontAwesome } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Sentry from '@sentry/react-native';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect } from 'react';
import { I18nextProvider } from 'react-i18next';
import { PaperProvider } from 'react-native-paper';
import { initialWindowMetrics, SafeAreaProvider } from 'react-native-safe-area-context';

import packageJson from '../package.json';

// export {
//     ErrorBoundary,
// } from 'expo-router';

export const unstable_settings = {
    initialRouteName: 'index',
};

SplashScreen.preventAutoHideAsync();

function MasterRootLayout() {
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
                    await addOrUpdateSetting({
                        type: GEMINI_MODEL_TYPE,
                        value: GEMINI_MODELS.GEMINI_FLASH_1_5.value.toString(),
                    });
                    await addOrUpdateSetting({
                        type: OPENAI_MODEL_TYPE,
                        value: OPENAI_MODELS.GPT_4O_MINI.value.toString(),
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
            await addIsFavoriteToFoodTable();

            // update to latest version
            await addVersioning(packageJson.version);
            console.log(`Database schema updated to version ${packageJson.version}.`);

            const shouldInitSentry = await getSettingByType(BUG_REPORT_TYPE);
            if (shouldInitSentry?.value === 'true') {
                Sentry.init({
                    // _experiments: {
                    //     replaysOnErrorSampleRate: 1.0,
                    //     replaysSessionSampleRate: 1.0,
                    // },
                    debug: __DEV__,
                    dsn: 'https://e4a649f87e2cf7bc05e3e000cb9ce7ba@o4507421287972864.ingest.de.sentry.io/4507426322579536',
                    environment: __DEV__ ? 'development' : 'production',
                    // integrations: [
                    //     Sentry.mobileReplayIntegration(),
                    // ],
                });
            }

            await AsyncStorage.setItem(LAST_TIME_APP_USED, getCurrentTimestampISOString());
        };

        initializeApp();
    }, [addNewChat, getSettingByType, increaseUnreadMessages]);

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
                            <DrawerMenu />
                        </SafeAreaProvider>
                    </SnackbarProvider>
                </HealthConnectProvider>
            </I18nextProvider>
        </PaperProvider>
    );
}

configureNotifications();
configureDailyTasks();
configureWeeklyTasks();

export default Sentry.wrap(MasterRootLayout);
