import type { ChatCompletionMessageParam } from 'openai/resources';

import BotAvatar from '@/components/BotAvatar';
import BottomPageModal from '@/components/BottomPageModal';
import { Screen } from '@/components/Screen';
import ThemedModal from '@/components/ThemedModal';
import WorkoutGeneratedSuccessModal from '@/components/WorkoutGeneratedSuccessModal';
import { GENERATE_MY_WORKOUTS } from '@/constants/chat';
import useChatRenderFunctions, { AIJsonResponseType, CustomMessage } from '@/hooks/useChatRenderFunctions';
import { useChatData } from '@/storage/ChatProvider';
import { useUnreadMessages } from '@/storage/UnreadMessagesProvider';
import { generateWorkoutPlan, sendChatMessage } from '@/utils/ai';
import { CustomThemeColorsType, CustomThemeType } from '@/utils/colors';
import { formatCreatedAt, getCurrentTimestampISOString } from '@/utils/date';
// import { addBio } from '@/utils/database';
import { getChatMessagePromptContent } from '@/utils/prompts';
import { ChatInsertType } from '@/utils/types';
import { NavigationProp } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, BackHandler, Platform, StyleSheet, View } from 'react-native';
import { GiftedChat, Send, SendProps } from 'react-native-gifted-chat';
import { ActivityIndicator, Appbar, Button, IconButton, Text, useTheme } from 'react-native-paper';

export default function Chat({ navigation }: { navigation: NavigationProp<any> }) {
    const { t } = useTranslation();
    const { addNewChat, chats, deleteChat, fetchMoreChats, hasMore, isLoading } = useChatData();

    const {
        removeStoredIntention,
        renderAvatar,
        renderCustomMessage,
        renderMessageText,
        storedIntentionValue,
        updateTotalWorkoutsCount,
    } = useChatRenderFunctions();

    const [systemMessages, setSystemMessages] = useState<ChatCompletionMessageParam[]>([]);
    const [waitingForResponse, setWaitingForResponse] = useState(false);
    const [loadingNewMessages, setLoadingNewMessages] = useState(false);
    const [isToolsMenuVisible, setToolsMenuVisible] = useState(false);
    const [isSuccessModalVisible, setSuccessModalVisible] = useState(false);
    const [isGeneratingWorkout, setGeneratingWorkout] = useState(false);
    const [isActionsVisible, setActionsVisible] = useState(false);
    const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false);
    const [selectedMessage, setSelectedMessage] = useState<CustomMessage | null>(null);

    const successFadeAnim = useRef(new Animated.Value(0)).current;
    const successSlideAnim = useRef(new Animated.Value(300)).current;
    const { emptyUnreadMessages } = useUnreadMessages();
    const { colors, dark } = useTheme<CustomThemeType>();
    const styles = makeStyles(colors, dark);

    useEffect(() => {
        if (isSuccessModalVisible) {
            Animated.parallel([
                Animated.timing(successFadeAnim, {
                    duration: 300,
                    toValue: 1,
                    useNativeDriver: true,
                }),
                Animated.timing(successSlideAnim, {
                    duration: 300,
                    toValue: 0,
                    useNativeDriver: true,
                }),
            ]).start();
        } else {
            Animated.parallel([
                Animated.timing(successFadeAnim, {
                    duration: 300,
                    toValue: 0,
                    useNativeDriver: true,
                }),
                Animated.timing(successSlideAnim, {
                    duration: 300,
                    toValue: 300,
                    useNativeDriver: true,
                }),
            ]).start();
        }
    }, [isSuccessModalVisible, successFadeAnim, successSlideAnim]);

    const fetchInitialData = useCallback(async () => {
        const initialMessages: ChatCompletionMessageParam[] = [{
            content: await getChatMessagePromptContent(),
            role: 'system',
        }];

        setSystemMessages(initialMessages);
    }, []);

    useFocusEffect(
        useCallback(() => {
            fetchInitialData();
            emptyUnreadMessages();
            invisibleMessagesLoadingFix();
        }, [fetchInitialData, emptyUnreadMessages])
    );

    useFocusEffect(
        useCallback(() => {
            const onBackPress = () => {
                navigation.navigate('index');
                return true;
            };

            BackHandler.addEventListener('hardwareBackPress', onBackPress);
            return () => {
                BackHandler.removeEventListener('hardwareBackPress', onBackPress);
            };
        }, [navigation])
    );

    const handleCopyText = useCallback(async () => {
        if (selectedMessage && selectedMessage.text) {
            try {
                await Clipboard.setStringAsync(selectedMessage.text);
                console.log('Text copied to clipboard');
            } catch (error) {
                console.error('Failed to copy text: ', error);
            }
        }

        setActionsVisible(false);
    }, [selectedMessage]);

    const handleDeleteMessage = useCallback(() => {
        setIsDeleteModalVisible(true);
        setActionsVisible(false);
    }, []);

    const confirmDeleteMessage = useCallback(async () => {
        if (selectedMessage && selectedMessage._id) {
            try {
                await deleteChat(selectedMessage._id as number);
            } catch (error) {
                console.error('Failed to delete message: ', error);
            }
        }

        setIsDeleteModalVisible(false);
    }, [selectedMessage, deleteChat]);

    const handleLongPress = useCallback((context: any, message: CustomMessage) => {
        if (Platform.OS !== 'web') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }

        setSelectedMessage(message);
        setActionsVisible(true);
    }, []);

    const handleCancel = useCallback(() => {
        setActionsVisible(false);
    }, []);

    const toggleToolsMenu = useCallback(() => {
        if (isGeneratingWorkout || waitingForResponse) {
            return;
        }

        setToolsMenuVisible(!isToolsMenuVisible);
    }, [isGeneratingWorkout, waitingForResponse, isToolsMenuVisible]);

    const generateWorkouts = useCallback(async () => {
        if (waitingForResponse) {
            return;
        }

        setGeneratingWorkout(true);
        setWaitingForResponse(true);

        try {
            const result = await generateWorkoutPlan(
                chats
                    .filter((msg) => msg.type === 'text')
                    .map((msg) => ({
                        content: msg.message,
                        role: msg.sender as 'assistant' | 'user',
                    }))
            );

            let text = t('workout_plan_generated');
            if (result) {
                setSuccessModalVisible(true);
            } else {
                text = t('error_generating_workout');
            }

            const newWorkoutChat: ChatInsertType = {
                createdAt: getCurrentTimestampISOString(),
                message: text,
                misc: '',
                sender: 'assistant',
                type: 'text',
            };

            await addNewChat(newWorkoutChat);
        } catch (error) {
            console.error(t('error_calling_openai'), error);
        } finally {
            setGeneratingWorkout(false);
            setWaitingForResponse(false);
        }

        toggleToolsMenu();
    }, [chats, toggleToolsMenu, t, addNewChat, waitingForResponse]);

    const handleSend = useCallback(async (newMessages: CustomMessage[] = []) => {
        if (newMessages.length === 0) {
            return Promise.resolve();
        }

        const newMessage = newMessages[0];
        const newChat: ChatInsertType = {
            createdAt: formatCreatedAt(newMessage.createdAt),
            message: newMessage.text,
            misc: '',
            sender: 'user',
            type: 'text',
        };

        await addNewChat(newChat);
        setWaitingForResponse(true);

        try {
            const messagesToSend = chats.length > 20 ? chats.slice(0, 20) : chats;
            const messages = [
                ...systemMessages,
                ...[newChat, ...messagesToSend]
                    .filter((msg) => msg.type === 'text')
                    .map((msg) => ({
                        content: msg.message,
                        role: msg.sender as 'assistant' | 'system' | 'user',
                    }))
                    .reverse(),
            ];

            if (storedIntentionValue === GENERATE_MY_WORKOUTS) {
                const result = await generateWorkoutPlan(
                    messages.filter((m) => m.role !== 'system')
                );

                await updateTotalWorkoutsCount();
                let text = t('workout_plan_generated');
                if (!result) {
                    text = t('error_generating_workout');
                }

                const newWorkoutChat: ChatInsertType = {
                    createdAt: getCurrentTimestampISOString(),
                    message: text,
                    misc: '',
                    sender: 'assistant',
                    type: 'text',
                };

                await addNewChat(newWorkoutChat);
                await removeStoredIntention();
                return;
            }

            const jsonResponse = await sendChatMessage(messages);

            const {
                // messageToBio,
                messageToUser,
                // shouldGenerateWorkout,
            } = jsonResponse as AIJsonResponseType;

            // if (messageToBio) {
            //     await addBio(messageToBio);
            // }

            if (messageToUser) {
                const newAssistantChat: ChatInsertType = {
                    createdAt: getCurrentTimestampISOString(),
                    // remove quotes from the message
                    message: messageToUser.replace(/^"([^"]+)"$/, '$1'),
                    misc: '',
                    sender: 'assistant',
                    type: 'text',
                };

                await addNewChat(newAssistantChat);
            }

            // if (shouldGenerateWorkout) {
            //     const result = await generateWorkoutPlan(
            //         messages.filter((m) => m.role !== 'system')
            //     );
            //
            //     let text = t('workout_plan_generated');
            //     if (!result) {
            //         text = t('error_generating_workout');
            //     }
            //
            //     const newWorkoutChat: ChatInsertType = {
            //         createdAt: getCurrentTimestampISOString(),
            //         message: text,
            //         misc: '',
            //         sender: 'assistant',
            //         type: 'text',
            //     };
            //
            //     await addNewChat(newWorkoutChat);
            // }
        } catch (error) {
            console.error(t('error_calling_openai'), error);
            const newAssistantMessage: ChatInsertType = {
                createdAt: getCurrentTimestampISOString(),
                message: t('error_processing_request'),
                misc: '',
                sender: 'assistant',
                type: 'text',
            };

            await addNewChat(newAssistantMessage);
        } finally {
            setWaitingForResponse(false);
        }
    }, [addNewChat, chats, systemMessages, storedIntentionValue, updateTotalWorkoutsCount, t, removeStoredIntention]);

    const renderSend = useCallback((props: SendProps<CustomMessage>) => (
        <Send {...props} disabled={waitingForResponse}>
            <View style={styles.sendingContainer}>
                <IconButton icon="send" size={24} />
            </View>
        </Send>
    ), [styles.sendingContainer, waitingForResponse]);

    const renderLoadEarlierButton = useCallback((onLoadEarlier: () => void) => {
        const loading = loadingNewMessages || isLoading;

        return (
            <View style={styles.loadEarlierContainer}>
                {loading ? (
                    <ActivityIndicator color={colors.primary} size="small" style={styles.loadingIndicator} />
                ) : null}
                <Button
                    disabled={loading}
                    mode="outlined"
                    onPress={onLoadEarlier}
                    style={[styles.loadEarlierButton, loading ? styles.loadEarlierButtonDisabled : styles.loadEarlierButtonEnabled]}
                >
                    <Text style={loading ? styles.loadEarlierButtonTextDisabled : styles.loadEarlierButtonText}>
                        {t('load_more_messages')}
                    </Text>
                </Button>
            </View>
        );
    }, [loadingNewMessages, isLoading, styles, colors.primary, t]);

    const navigateToWorkouts = useCallback(() => {
        setSuccessModalVisible(false);
        navigation.navigate('listWorkouts');
    }, [navigation]);

    const formatMessages = useCallback(() => {
        return chats.map((chat) => ({
            _id: chat.id!,
            createdAt: chat.createdAt ? new Date(chat.createdAt) : new Date(),
            custom: chat.type === 'recentWorkout' ? JSON.parse(chat.misc || '{}') : undefined,
            text: chat.message,
            user: {
                _id: chat.sender === 'user' ? 1 : 2,
                avatar: chat.sender === 'assistant' ? <BotAvatar /> : undefined,
                name: chat.sender,
            },
        })) as CustomMessage[];
    }, [chats]);

    const onLoadEarlier = useCallback(async () => {
        if (hasMore && !isLoading) {
            setLoadingNewMessages(true);

            // this hack is necessary so that the UI can update before the async operation
            await new Promise((resolve) => setTimeout(async (data) => {
                await fetchMoreChats();
                return resolve(data);
            }, 1));

            setLoadingNewMessages(false);
        }
    }, [hasMore, fetchMoreChats, isLoading]);

    return (
        <Screen style={styles.container}>
            <Appbar.Header
                mode="small"
                statusBarHeight={0}
                style={styles.appbarHeader}
            >
                <Appbar.Content title={t('chat')} titleStyle={styles.appbarTitle} />
                <Appbar.Action icon="dots-vertical" onPress={toggleToolsMenu} />
            </Appbar.Header>
            <GiftedChat
                isLoadingEarlier={isLoading}
                loadEarlier={hasMore}
                messages={formatMessages()}
                onLoadEarlier={onLoadEarlier}
                onLongPress={handleLongPress}
                onSend={handleSend}
                renderAvatar={renderAvatar}
                renderLoadEarlier={() => renderLoadEarlierButton(onLoadEarlier)}
                renderLoading={() => isLoading && <ActivityIndicator color={colors.primary} size="large" />}
                renderMessage={renderCustomMessage}
                renderMessageText={renderMessageText}
                renderSend={renderSend}
                user={{ _id: 1, name: 'user' }}
            />
            <BottomPageModal isVisible={isToolsMenuVisible} toggleToolsMenu={toggleToolsMenu}>
                {isGeneratingWorkout ? (
                    <ActivityIndicator color={colors.primary} size="large" style={styles.loadingIndicator} />
                ) : (
                    <Button mode="contained" onPress={generateWorkouts} style={styles.menuItem}>
                        {t('generate_my_workouts')}
                    </Button>
                )}
            </BottomPageModal>
            <BottomPageModal
                isVisible={isActionsVisible}
                toggleToolsMenu={handleCancel}
            >
                <Button mode="contained" onPress={handleCopyText} style={styles.menuItem}>
                    {t('copy_text')}
                </Button>
                <Button mode="contained" onPress={handleDeleteMessage} style={styles.menuItem}>
                    {t('delete_message')}
                </Button>
                <Button mode="contained" onPress={handleCancel} style={styles.menuItem}>
                    {t('cancel')}
                </Button>
            </BottomPageModal>
            <ThemedModal
                cancelText={t('no')}
                confirmText={t('yes')}
                onClose={() => setIsDeleteModalVisible(false)}
                onConfirm={confirmDeleteMessage}
                title={t('delete_message_confirmation')}
                visible={isDeleteModalVisible}
            />
            <WorkoutGeneratedSuccessModal
                isVisible={isSuccessModalVisible}
                navigateToWorkouts={navigateToWorkouts}
                onClose={() => setSuccessModalVisible(false)}
            />
        </Screen>
    );
}

// copied from https://github.com/FaridSafi/react-native-gifted-chat/issues/2448#issuecomment-2167027162
function invisibleMessagesLoadingFix() {
    if (Platform.OS === 'web') {
        const gcLoadingContaineEl = document.querySelectorAll(
            '[data-testid="GC_LOADING_CONTAINER"]'
            // eslint-disable-next-line no-undef
        )[0] as HTMLElement;

        if (gcLoadingContaineEl) {
            gcLoadingContaineEl.style.display = 'none';
            setTimeout(() => {
                gcLoadingContaineEl.style.display = 'flex';
            }, 500);
        }
    }
}

const makeStyles = (colors: CustomThemeColorsType, dark: boolean) => StyleSheet.create({
    appbarHeader: {
        backgroundColor: colors.primary,
        justifyContent: 'center',
        paddingHorizontal: 16,
    },
    appbarTitle: {
        color: colors.onPrimary,
        fontSize: Platform.OS === 'web' ? 20 : 26,
    },
    container: {
        backgroundColor: colors.background,
        flex: 1,
    },
    loadEarlierButton: {
        paddingVertical: 10,
    },
    loadEarlierButtonDisabled: {
        backgroundColor: colors.surfaceDisabled,
    },
    loadEarlierButtonEnabled: {
        backgroundColor: colors.surface,
    },
    loadEarlierButtonText: {
        color: colors.onSurface,
    },
    loadEarlierButtonTextDisabled: {
        color: colors.onSurfaceDisabled,
    },
    loadEarlierContainer: {
        alignItems: 'center',
        marginVertical: 10,
    },
    loadingIndicator: {
        color: colors.primary,
        marginBottom: 8,
        marginVertical: 16,
    },
    menuItem: {
        marginBottom: 8,
        width: '100%',
    },
    sendingContainer: {
        alignItems: 'center',
        height: 44,
        justifyContent: 'center',
        marginRight: 10,
    },
});
