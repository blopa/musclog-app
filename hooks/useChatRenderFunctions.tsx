import BotAvatar from '@/components/BotAvatar';
import RecentWorkoutMessageCard from '@/components/RecentWorkoutMessageCard';
import { CANCEL_GENERATE_MY_WORKOUTS, GENERATE_MY_WORKOUTS, GET_WORKOUT_FEEDBACK } from '@/constants/chat';
import { CHAT_INTENTION } from '@/constants/storage';
import useAsyncStorage from '@/hooks/useAsyncStorage';
import { useChatData } from '@/storage/ChatProvider';
import { sendChatMessage } from '@/utils/ai';
import { CustomThemeColorsType, CustomThemeType } from '@/utils/colors';
import { isEmptyObject } from '@/utils/data';
import { getRecentWorkoutById, getTotalWorkoutsCount, getWorkoutById } from '@/utils/database';
import { getCurrentTimestampISOString } from '@/utils/date';
import { getCalculateNextWorkoutVolumePrompt } from '@/utils/prompts';
import { ChatInsertType } from '@/utils/types';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, TextStyle, View } from 'react-native';
import { AvatarProps, IMessage, Message, MessageProps, MessageTextProps, Reply } from 'react-native-gifted-chat';
import { QuickReplies } from 'react-native-gifted-chat/lib/QuickReplies';
import Markdown from 'react-native-markdown-display';
import { ActivityIndicator, useTheme } from 'react-native-paper';

export type AIJsonResponseType = {
    messageToBio?: string;
    messageToUser: string;
    // shouldGenerateWorkout: boolean;
};

export interface CustomMessage extends IMessage {
    custom?: {
        recentWorkoutId?: string;
    };
}

type QuickReplyPayload = {
    recentWorkoutId?: number;
};

const WAIT_TIME = 500;

const useChatRenderFunctions = () => {
    const { colors, dark } = useTheme<CustomThemeType>();
    const styles = makeStyles(colors, dark);
    const { t } = useTranslation();
    const { addNewChat } = useChatData();

    const {
        getValue: getStoredIntention,
        removeValue: removeStoredIntention,
        setValue: setStoredIntention,
        value: storedIntentionValue,
    } = useAsyncStorage<null | string>(CHAT_INTENTION, null);

    const [isHandlingQuickReply, setIsHandlingQuickReply] = useState(false);
    const [totalWorkoutsCount, setTotalWorkoutsCount] = useState(0);

    const fetchTotalWorkoutsCount = useCallback(async () => {
        const totalCount = await getTotalWorkoutsCount();
        setTotalWorkoutsCount(totalCount);
    }, []);

    useFocusEffect(
        useCallback(() => {
            fetchTotalWorkoutsCount();
        }, [fetchTotalWorkoutsCount])
    );

    const renderMessageText = useCallback((props: MessageTextProps<CustomMessage>) => {
        const { currentMessage } = props;
        if (!currentMessage) {
            return null;
        }

        const { text, user } = currentMessage;
        const textColor = user.name === 'user' ? '#FAFAFA' : '#212121';
        const markdownStyles = {
            blocklink: {
                color: textColor,
            },
            blockquote: {
                borderLeftColor: user.name === 'user' ? colors.onPrimary : colors.primary,
                borderLeftWidth: 4,
                color: textColor,
                fontStyle: 'italic',
                paddingLeft: 8,
            },
            body: {
                color: textColor,
            },
            code_block: {
                backgroundColor: user.name === 'user' ? colors.primary : colors.primaryContainer,
                borderRadius: 4,
                color: textColor,
                fontFamily: 'monospace',
                padding: 8,
            },
            code_inline: {
                backgroundColor: user.name === 'user' ? colors.primary : colors.primaryContainer,
                borderRadius: 4,
                color: textColor,
                fontFamily: 'monospace',
                padding: 4,
            },
            em: {
                color: textColor,
                fontStyle: 'italic' as TextStyle['fontStyle'],
            },
            fence: {
                backgroundColor: user.name === 'user' ? colors.primary : colors.primaryContainer,
                borderRadius: 4,
                color: textColor,
                fontFamily: 'monospace',
                padding: 8,
            },
            heading1: {
                color: textColor,
                fontSize: 24,
                fontWeight: 'bold' as TextStyle['fontWeight'],
            },
            heading2: {
                color: textColor,
                fontSize: 22,
                fontWeight: 'bold' as TextStyle['fontWeight'],
            },
            heading3: {
                color: textColor,
                fontSize: 20,
                fontWeight: 'bold' as TextStyle['fontWeight'],
            },
            heading4: {
                color: textColor,
                fontSize: 18,
                fontWeight: 'bold' as TextStyle['fontWeight'],
            },
            heading5: {
                color: textColor,
                fontSize: 16,
                fontWeight: 'bold' as TextStyle['fontWeight'],
            },
            heading6: {
                color: textColor,
                fontSize: 14,
                fontWeight: 'bold' as TextStyle['fontWeight'],
            },
            hr: {
                borderBottomColor: textColor,
                borderBottomWidth: 1,
                marginVertical: 8,
            },
            inline: {
                color: textColor,
            },
            link: {
                color: textColor,
                textDecorationLine: 'underline' as TextStyle['textDecorationLine'],
            },
            paragraph: {
                color: textColor,
            },
            pre: {
                backgroundColor: user.name === 'user' ? colors.primary : colors.primaryContainer,
                borderRadius: 4,
                color: textColor,
                fontFamily: 'monospace',
                padding: 8,
            },
            s: {
                color: textColor,
                textDecorationLine: 'line-through' as TextStyle['textDecorationLine'],
            },
            softbreak: {
                backgroundColor: textColor,
                height: 1,
                marginVertical: 8,
            },
            span: {
                color: textColor,
            },
            strong: {
                color: textColor,
                fontWeight: 'bold' as TextStyle['fontWeight'],
            },
        };

        return (
            <View style={styles.messageWrapper}>
                <Markdown style={markdownStyles}>
                    {text}
                </Markdown>
            </View>
        );
    }, [colors.onPrimary, colors.primary, colors.primaryContainer, styles.messageWrapper]);


    const renderAvatar = useCallback((props: AvatarProps<CustomMessage>) => {
        const { currentMessage } = props;
        if (currentMessage?.user._id === 2) {
            return <BotAvatar />;
        }

        return null;
    }, []);

    const handleQuickReply = useCallback(async (replies: Reply[], payload: QuickReplyPayload = {}) => {
        setIsHandlingQuickReply(true);
        const reply = replies[0];

        switch (reply.value) {
            case CANCEL_GENERATE_MY_WORKOUTS: {
                await removeStoredIntention();
                const newChat: ChatInsertType = {
                    createdAt: getCurrentTimestampISOString(),
                    message: t('never_mind'),
                    misc: '',
                    sender: 'user',
                    type: 'text',
                };

                await addNewChat(newChat);

                setTimeout(() => {
                    const newBotChat: ChatInsertType = {
                        createdAt: getCurrentTimestampISOString(),
                        message: t('no_worries_let_me_know'),
                        misc: '',
                        sender: 'assistant',
                        type: 'text',
                    };

                    addNewChat(newBotChat);
                }, WAIT_TIME);

                break;
            }

            case GENERATE_MY_WORKOUTS: {
                await setStoredIntention(GENERATE_MY_WORKOUTS);
                const newChat: ChatInsertType = {
                    createdAt: getCurrentTimestampISOString(),
                    message: t('can_you_generate_me_some_workouts'),
                    misc: '',
                    sender: 'user',
                    type: 'text',
                };

                await addNewChat(newChat);

                setTimeout(() => {
                    const newBotChat: ChatInsertType = {
                        createdAt: getCurrentTimestampISOString(),
                        message: t('sure_thing_anything_workout_details'),
                        misc: '',
                        sender: 'assistant',
                        type: 'text',
                    };

                    addNewChat(newBotChat);
                }, WAIT_TIME);

                break;
            }

            case GET_WORKOUT_FEEDBACK: {
                const { recentWorkoutId } = payload;
                if (recentWorkoutId) {
                    const workoutEvent = await getRecentWorkoutById(recentWorkoutId);

                    if (workoutEvent) {
                        const workout = await getWorkoutById(workoutEvent.workoutId);

                        if (workout) {
                            const newChat: ChatInsertType = {
                                createdAt: getCurrentTimestampISOString(),
                                message: t('can_you_give_me_feedback_on', { pastWorkout: workoutEvent.title }),
                                misc: '',
                                sender: 'user',
                                type: 'text',
                            };

                            await addNewChat(newChat);

                            const jsonResponse = await sendChatMessage([
                                ...await getCalculateNextWorkoutVolumePrompt(workout, false),
                                {
                                    content: newChat.message,
                                    role: 'user',
                                }]);

                            const { messageToUser } = jsonResponse as AIJsonResponseType;

                            if (messageToUser) {
                                const newAssistantChat: ChatInsertType = {
                                    createdAt: getCurrentTimestampISOString(),
                                    // Remove quotes from the message
                                    message: messageToUser.replace(/^"([^"]+)"$/, '$1'),
                                    misc: '',
                                    sender: 'assistant',
                                    type: 'text',
                                };

                                await addNewChat(newAssistantChat);
                            }
                        }
                    }
                }

                break;
            }

            default: {
                break;
            }
        }

        setIsHandlingQuickReply(false);
    }, [addNewChat, removeStoredIntention, setStoredIntention, t]);

    const renderCustomMessage = useCallback((props: MessageProps<CustomMessage>) => {
        const { currentMessage, nextMessage } = props;
        const isBotMessage = currentMessage?.user._id !== 1; // TODO: for now user id is always 1
        const isLastMessage = isEmptyObject(nextMessage);
        let quickReplies;

        if (currentMessage?.custom && currentMessage.custom.recentWorkoutId) {
            const recentWorkoutId = Number(currentMessage.custom.recentWorkoutId);

            return (
                <>
                    {isLastMessage ? (
                        <View style={styles.quickRepliesContainer}>
                            {!isHandlingQuickReply ? (
                                <QuickReplies
                                    currentMessage={{
                                        ...currentMessage,
                                        quickReplies: {
                                            type: 'radio',
                                            values: [
                                                { title: t('get_workout_feedback'), value: GET_WORKOUT_FEEDBACK },
                                            ],
                                        },
                                    }}
                                    onQuickReply={(replies) => handleQuickReply(replies, { recentWorkoutId })}
                                    quickReplyStyle={styles.quickReplyStyle}
                                    quickReplyTextStyle={styles.quickReplyTextStyle}
                                />
                            ) : <ActivityIndicator />}
                        </View>
                    ) : null}
                    <RecentWorkoutMessageCard
                        recentWorkoutId={recentWorkoutId}
                    />
                </>
            );
        }

        if (isLastMessage && isBotMessage && currentMessage?._id) {
            if (storedIntentionValue === GENERATE_MY_WORKOUTS) {
                quickReplies = (
                    <View style={styles.quickRepliesContainer}>
                        {!isHandlingQuickReply ? (
                            <QuickReplies
                                currentMessage={{
                                    ...currentMessage,
                                    quickReplies: {
                                        type: 'radio',
                                        values: [
                                            { title: t('never_mind'), value: CANCEL_GENERATE_MY_WORKOUTS },
                                        ],
                                    },
                                }}
                                onQuickReply={handleQuickReply}
                                quickReplyStyle={styles.quickReplyStyle}
                                quickReplyTextStyle={styles.quickReplyTextStyle}
                            />
                        ) : <ActivityIndicator />}
                    </View>
                );
            } else if (totalWorkoutsCount === 0) {
                quickReplies = (
                    <View style={styles.quickRepliesContainer}>
                        {!isHandlingQuickReply ? (
                            <QuickReplies
                                currentMessage={{
                                    ...currentMessage,
                                    quickReplies: {
                                        type: 'radio',
                                        values: [
                                            { title: t('generate_my_workouts'), value: GENERATE_MY_WORKOUTS },
                                        ],
                                    },
                                }}
                                onQuickReply={handleQuickReply}
                                quickReplyStyle={styles.quickReplyStyle}
                                quickReplyTextStyle={styles.quickReplyTextStyle}
                            />
                        ) : <ActivityIndicator />}
                    </View>
                );
            }
        }

        return (
            <>
                {quickReplies}
                <Message {...props} />
            </>
        );
    }, [handleQuickReply, isHandlingQuickReply, storedIntentionValue, styles.quickRepliesContainer, styles.quickReplyStyle, styles.quickReplyTextStyle, t, totalWorkoutsCount]);

    return {
        removeStoredIntention,
        renderAvatar,
        renderCustomMessage,
        renderMessageText,
        storedIntentionValue,
        updateTotalWorkoutsCount: fetchTotalWorkoutsCount,
    };
};

const makeStyles = (colors: CustomThemeColorsType, dark: boolean) => StyleSheet.create({
    messageWrapper: {
        paddingHorizontal: 16,
    },
    quickRepliesContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
    },
    quickReplyStyle: {
        backgroundColor: '#0084ff',
        minHeight: 32,
    },
    quickReplyTextStyle: {
        color: '#FAFAFA',
        fontSize: 14,
    },
});

export default useChatRenderFunctions;
