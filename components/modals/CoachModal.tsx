import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { LinearGradient } from 'expo-linear-gradient';
import type { TFunction } from 'i18next';
import {
  PlusCircle,
  Send as SendIcon,
  TrendingUp,
  UtensilsCrossed,
  X,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Image,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  BubbleProps,
  Composer,
  ComposerProps,
  GiftedChat,
  InputToolbar,
  InputToolbarProps,
  Send,
  SendProps,
} from 'react-native-gifted-chat';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  ANALYZE_PROGRESS,
  CHAT_INTENTION_KEY,
  GENERATE_MY_WORKOUTS,
  NUTRITION_CHECK,
} from '../../constants/chat';
import {
  AI_COACH_AVATAR,
  type ExtendedIMessage,
  useChatMessages,
} from '../../hooks/useChatMessages';
import { useTheme } from '../../hooks/useTheme';
import type { Theme } from '../../theme';
import { ChatWorkoutCard } from '../cards/ChatWorkoutCard';
import { ChatWorkoutCompletedCard } from '../cards/ChatWorkoutCompletedCard';
import { MenuButton } from '../theme/MenuButton';
import { useUnreadChat } from '../UnreadChatContext';
import { FullScreenModal } from './FullScreenModal';
import PastWorkoutDetailModal from './PastWorkoutDetailModal';

// Workout image URL (used for future workout card messages)
const WORKOUT_IMAGE_URL =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuC8wdyvHF33Emd_otj2gCXb_-DtuZnk1Yynloi9mvz8s2ZtTJ1fFbg_J8B8x02R5Njk5nPX1SonjXw5sEU1gwylKXq3buzHpa2EoRQfBpA6BTNRGfSjYnqBMRSyDW7tl5DHtCWM5DOUd91Ka2gB8Y-rdvJB99_hQED2ZIqMdcWkgxVdv_pRnWFXwFirvEOSMuCveL2ZxoS3oQpkrQoYXVBSunvPf8QQ6xtQQw-v_r9wOPDB6W6pKw22mPLs0nsdG-MkvUJTj7VCxnSe';

const getPendingIntentionDisplayText = (
  pendingIntention: string,
  t: TFunction
): string => {
  switch (pendingIntention) {
    case GENERATE_MY_WORKOUTS:
      return 'Workout Gen.';
    case ANALYZE_PROGRESS:
      return t('coach.actions.analyzeProgress');
    case NUTRITION_CHECK:
      return t('coach.actions.nutritionCheck');
    default:
      return pendingIntention;
  }
};

// --- Custom Render Functions (Defined Outside for Stability) ---

const renderMessageText = (props: any, theme: Theme) => {
  return (
    <Text
      style={{
        fontSize: theme.typography.fontSize.sm,
        lineHeight: theme.typography.lineHeight.normal * theme.typography.fontSize.sm,
        color:
          props.currentMessage?.user._id === 1
            ? theme.colors.text.black
            : theme.colors.text.primary,
      }}
    >
      {props.currentMessage?.text}
    </Text>
  );
};

const renderCustomView = (
  props: BubbleProps<ExtendedIMessage>,
  onViewWorkoutDetails?: (workoutLogId: string) => void
) => {
  const { currentMessage } = props;
  if (currentMessage?.workoutCompleted) {
    return (
      <ChatWorkoutCompletedCard
        {...currentMessage.workoutCompleted}
        onViewDetails={
          onViewWorkoutDetails
            ? () => onViewWorkoutDetails(currentMessage.workoutCompleted!.workoutLogId)
            : undefined
        }
      />
    );
  }
  if (currentMessage?.workout) {
    return (
      <View className="mt-2 w-full max-w-sm">
        <ChatWorkoutCard
          title={currentMessage.workout.title}
          duration={currentMessage.workout.duration}
          level={currentMessage.workout.level}
          exerciseCount={currentMessage.workout.exerciseCount}
          calories={currentMessage.workout.calories}
          image={{ uri: WORKOUT_IMAGE_URL }}
          onStartWorkout={() => console.log('Start workout')}
        />
      </View>
    );
  }
  return null;
};

const renderBubble = (
  props: BubbleProps<ExtendedIMessage>,
  theme: Theme,
  onViewWorkoutDetails?: (workoutLogId: string) => void
) => {
  const { currentMessage, user } = props;
  const isUser = user && currentMessage?.user._id === user._id;
  const styles = getStyles(theme);

  if (isUser) {
    return (
      <View style={styles.userBubbleContainer}>
        {!!currentMessage?.text ? (
          <LinearGradient
            colors={theme.colors.gradients.userBubble}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.userBubbleGradient}
          >
            {renderMessageText(props, theme)}
          </LinearGradient>
        ) : null}
        {!!currentMessage?.workout ? renderCustomView(props) : null}
        {!!currentMessage?.createdAt ? (
          <Text
            className="mr-1 mt-1 text-right text-xs"
            style={{ color: theme.colors.text.tertiary }}
          >
            {new Date(currentMessage.createdAt).toLocaleTimeString('en-US', {
              hour: 'numeric',
              minute: '2-digit',
            })}
          </Text>
        ) : null}
      </View>
    );
  } else {
    return (
      <View style={styles.aiBubbleContainer}>
        {!!currentMessage?.user.name ? (
          <Text className="mb-1 ml-1 text-xs" style={{ color: theme.colors.text.secondary }}>
            {currentMessage.user.name}
          </Text>
        ) : null}
        {!!currentMessage?.text && !currentMessage?.workoutCompleted ? (
          <View style={styles.aiBubbleContent}>{renderMessageText(props, theme)}</View>
        ) : null}
        {currentMessage?.workoutCompleted || currentMessage?.workout
          ? renderCustomView(props, onViewWorkoutDetails)
          : null}
      </View>
    );
  }
};

const renderAvatar = (props: any, theme: Theme) => {
  const styles = getStyles(theme);

  if (props.currentMessage?.user._id === 1) {
    return null;
  }
  if (!props.currentMessage?.text && props.currentMessage?.workout) {
    return <View style={{ width: theme.size['8'] }} />;
  }
  return (
    <View style={[styles.avatar, { overflow: 'hidden' }]}>
      <Image
        source={AI_COACH_AVATAR}
        style={{ width: theme.size['8'], height: theme.size['8'] }}
        resizeMode="cover"
      />
    </View>
  );
};

const renderDay = (props: any, t: TFunction, theme: Theme) => {
  if (!props.currentMessage?.createdAt) {
    return null;
  }
  const date = new Date(props.currentMessage.createdAt);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();

  if (isToday) {
    return (
      <View className="my-6 items-center">
        <View className="rounded-full bg-bg-card px-3 py-1">
          <Text className="text-xs font-medium" style={{ color: theme.colors.text.tertiary }}>
            {t('coach.todayAt', {
              time: date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
            })}
          </Text>
        </View>
      </View>
    );
  }
  return null;
};

const renderSend = (
  props: SendProps<ExtendedIMessage>,
  theme: Theme,
  failedMessageText: string | null
) => {
  const styles = getStyles(theme);
  // When we restored failed text, GiftedChat's state may not have it yet; pass it so Send button is visible
  const effectiveText = (failedMessageText ?? props.text ?? '').trim();

  return (
    <Send {...props} text={effectiveText} containerStyle={styles.sendContainer}>
      <View
        className="h-12 w-12 items-center justify-center rounded-full active:scale-90"
        style={{ backgroundColor: theme.colors.accent.primary }}
      >
        <SendIcon size={theme.iconSize.lg} color={theme.colors.text.black} />
      </View>
    </Send>
  );
};

/** ComposerProps from gifted-chat may use a different name for the text callback; we use a relaxed type for our overrides. */
type ComposerPropsWithText = ComposerProps & {
  text?: string;
  onTextChanged?: (text: string) => void;
};

/** Wrapper so we can run an effect to sync restored (failed) message text into GiftedChat's state when user taps Send without typing. */
function ComposerWithRestoredText({
  props,
  t,
  theme,
  failedMessageText,
  clearFailedMessageText,
}: {
  props: ComposerProps;
  t: TFunction;
  theme: Theme;
  failedMessageText: string | null;
  clearFailedMessageText: () => void;
}) {
  const styles = getStyles(theme);
  const propsWithText = props as ComposerPropsWithText;

  // When we have restored text, sync it into GiftedChat's internal state so Send uses it
  useEffect(() => {
    if (failedMessageText != null && propsWithText.onTextChanged) {
      propsWithText.onTextChanged(failedMessageText);
    }
    // Intentionally not including props to run only when failedMessageText is set
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [failedMessageText]);

  const text = failedMessageText !== null ? failedMessageText : propsWithText.text;
  const onTextChanged = (newText: string) => {
    if (failedMessageText !== null) {
      clearFailedMessageText();
    }
    propsWithText.onTextChanged?.(newText);
  };

  return (
    <View style={styles.composerWrapper}>
      <Composer
        {...({ ...props, text, onTextChanged } as ComposerProps)}
        textInputProps={{
          ...props.textInputProps,
          style: [styles.composerTextInput, props.textInputProps?.style],
          placeholder: t('coach.placeholder'),
          placeholderTextColor: theme.colors.text.tertiary,
          multiline: true,
        }}
      />
    </View>
  );
}

const renderComposer = (
  props: ComposerProps,
  t: TFunction,
  theme: Theme,
  failedMessageText: string | null,
  clearFailedMessageText: () => void
) => (
  <ComposerWithRestoredText
    props={props}
    t={t}
    theme={theme}
    failedMessageText={failedMessageText}
    clearFailedMessageText={clearFailedMessageText}
  />
);

const renderInputToolbar = (
  props: InputToolbarProps<ExtendedIMessage>,
  theme: Theme,
  pendingIntention: string | null,
  onClearIntention: () => void,
  t: TFunction
) => {
  const styles = getStyles(theme);

  return (
    <View>
      {pendingIntention ? (
        <View className="px-4 py-2">
          <View
            className="flex-row items-center gap-1.5 rounded-full px-3 py-1"
            style={{
              backgroundColor: theme.colors.accent.primary20,
              alignSelf: 'flex-start',
            }}
          >
            <View
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: theme.colors.accent.primary }}
            />
            <Text className="text-xs font-medium text-text-primary">
              {getPendingIntentionDisplayText(pendingIntention, t)}
            </Text>
            <Pressable onPress={onClearIntention} className="p-0.5">
              <X size={14} color={theme.colors.accent.primary} />
            </Pressable>
          </View>
        </View>
      ) : null}
      <InputToolbar
        {...props}
        containerStyle={styles.inputToolbarContainer}
        primaryStyle={styles.inputToolbarPrimary}
      />
    </View>
  );
};

// --- Main Component ---

type CoachModalProps = {
  visible: boolean;
  onClose: () => void;
};

export function CoachModal({ visible, onClose }: CoachModalProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const {
    messages,
    pendingCoachMessage,
    isSending,
    isLoadingMore,
    hasMore,
    loadMore,
    sendMessage,
    addPendingCoachMessage,
    clearPendingCoachMessage,
    failedMessageText,
    clearFailedMessageText,
    ephemeralErrorAsMessage,
  } = useChatMessages();
  const { clearUnreadCount } = useUnreadChat();
  const [isOnline, setIsOnline] = useState(true);
  const [pendingIntention, setPendingIntention] = useState<string | null>(null);
  const [selectedWorkoutId, setSelectedWorkoutId] = useState<string | null>(null);

  useEffect(() => {
    return NetInfo.addEventListener((state) => {
      setIsOnline(state.isConnected ?? true);
    });
  }, []);

  // Clear unread badge whenever the modal becomes visible
  useEffect(() => {
    if (visible) {
      clearUnreadCount();
    }
  }, [visible, clearUnreadCount]);

  // Load pending intention from AsyncStorage when modal opens
  useEffect(() => {
    if (!visible) {
      return;
    }
    const loadIntention = async () => {
      const intention = await AsyncStorage.getItem(CHAT_INTENTION_KEY);
      setPendingIntention(intention);
    };
    loadIntention();
  }, [visible]);

  // When messages change and a pending intention is set, sync with AsyncStorage so we turn off
  // the pill as soon as the LLM response is saved (useChatMessages clears the key)
  useEffect(() => {
    if (!visible || !pendingIntention) {
      return;
    }

    const syncIntention = async () => {
      const intention = await AsyncStorage.getItem(CHAT_INTENTION_KEY);
      if (!intention) {
        setPendingIntention(null);
        clearPendingCoachMessage();
      }
    };

    syncIntention();
  }, [visible, pendingIntention, messages, clearPendingCoachMessage]);

  // On Android, KeyboardAvoidingView doesn't work inside a Modal.
  // We manually track the keyboard height and apply it as padding.
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  useEffect(() => {
    if (Platform.OS !== 'android') {
      return;
    }
    const show = Keyboard.addListener('keyboardDidShow', (e) => {
      setKeyboardHeight(e.endCoordinates.height);
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardHeight(0);
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const displayMessages = [
    ...(ephemeralErrorAsMessage ? [ephemeralErrorAsMessage] : []),
    ...(pendingCoachMessage ? [pendingCoachMessage] : []),
    ...messages,
  ];

  const onSend = useCallback(
    (newMessages: ExtendedIMessage[] = []) => {
      const text = newMessages[0]?.text;
      if (text) {
        sendMessage(text);
      }
    },
    [sendMessage]
  );

  const handleGenerateWorkouts = useCallback(async () => {
    if (pendingIntention === GENERATE_MY_WORKOUTS) {
      await AsyncStorage.removeItem(CHAT_INTENTION_KEY);
      setPendingIntention(null);
      clearPendingCoachMessage();
    } else {
      await AsyncStorage.setItem(CHAT_INTENTION_KEY, GENERATE_MY_WORKOUTS);
      setPendingIntention(GENERATE_MY_WORKOUTS);
      addPendingCoachMessage({
        _id: `pending-workout-gen-${Date.now()}`,
        text: t('coach.workoutGenerationPrompt'),
        createdAt: new Date(),
        user: { _id: 2, name: 'Loggy', avatar: AI_COACH_AVATAR },
      });
    }
  }, [addPendingCoachMessage, clearPendingCoachMessage, pendingIntention, t]);

  const handleAnalyzeProgress = useCallback(async () => {
    if (pendingIntention === ANALYZE_PROGRESS) {
      await AsyncStorage.removeItem(CHAT_INTENTION_KEY);
      setPendingIntention(null);
      clearPendingCoachMessage();
    } else {
      await AsyncStorage.setItem(CHAT_INTENTION_KEY, ANALYZE_PROGRESS);
      setPendingIntention(ANALYZE_PROGRESS);
      addPendingCoachMessage({
        _id: `pending-analyze-progress-${Date.now()}`,
        text: t('coach.analyzeProgressPrompt'),
        createdAt: new Date(),
        user: { _id: 2, name: 'Loggy', avatar: AI_COACH_AVATAR },
      });
    }
  }, [addPendingCoachMessage, clearPendingCoachMessage, pendingIntention, t]);

  const handleNutritionCheck = useCallback(async () => {
    if (pendingIntention === NUTRITION_CHECK) {
      await AsyncStorage.removeItem(CHAT_INTENTION_KEY);
      setPendingIntention(null);
      clearPendingCoachMessage();
    } else {
      await AsyncStorage.setItem(CHAT_INTENTION_KEY, NUTRITION_CHECK);
      setPendingIntention(NUTRITION_CHECK);
      addPendingCoachMessage({
        _id: `pending-nutrition-check-${Date.now()}`,
        text: t('coach.nutritionCheckPrompt'),
        createdAt: new Date(),
        user: { _id: 2, name: 'Loggy', avatar: AI_COACH_AVATAR },
      });
    }
  }, [addPendingCoachMessage, clearPendingCoachMessage, pendingIntention, t]);

  const handleClearIntention = useCallback(async () => {
    await AsyncStorage.removeItem(CHAT_INTENTION_KEY);
    setPendingIntention(null);
    clearPendingCoachMessage();
  }, [clearPendingCoachMessage]);

  const handleViewWorkoutDetails = useCallback((workoutLogId: string) => {
    setSelectedWorkoutId(workoutLogId);
  }, []);

  const renderAccessory = useCallback(() => {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="px-4 py-3"
        contentContainerStyle={{ gap: theme.spacing.gap.sm }}
      >
        <Pressable
          onPress={handleGenerateWorkouts}
          className="flex-row items-center gap-2 whitespace-nowrap rounded-full border bg-bg-card px-4 py-2 active:scale-95"
          style={{
            borderColor:
              pendingIntention === GENERATE_MY_WORKOUTS
                ? theme.colors.accent.primary
                : theme.colors.border.light,
            borderWidth: pendingIntention === GENERATE_MY_WORKOUTS ? 2 : 1,
            backgroundColor:
              pendingIntention === GENERATE_MY_WORKOUTS
                ? theme.colors.accent.primary10
                : theme.colors.background.card,
          }}
        >
          <PlusCircle size={theme.iconSize.md} color={theme.colors.accent.primary} />
          <Text className="text-sm font-medium text-text-primary">
            {t('coach.actions.createWorkout')}
          </Text>
        </Pressable>
        <Pressable
          onPress={handleAnalyzeProgress}
          className="flex-row items-center gap-2 whitespace-nowrap rounded-full border bg-bg-card px-4 py-2 active:scale-95"
          style={{
            borderColor:
              pendingIntention === ANALYZE_PROGRESS
                ? theme.colors.accent.primary
                : theme.colors.border.light,
            borderWidth: pendingIntention === ANALYZE_PROGRESS ? 2 : 1,
            backgroundColor:
              pendingIntention === ANALYZE_PROGRESS
                ? theme.colors.accent.primary10
                : theme.colors.background.card,
          }}
        >
          <TrendingUp size={theme.iconSize.md} color={theme.colors.status.info} />
          <Text className="text-sm font-medium text-text-primary">
            {t('coach.actions.analyzeProgress')}
          </Text>
        </Pressable>
        <Pressable
          onPress={handleNutritionCheck}
          className="flex-row items-center gap-2 whitespace-nowrap rounded-full border bg-bg-card px-4 py-2 active:scale-95"
          style={{
            borderColor:
              pendingIntention === NUTRITION_CHECK
                ? theme.colors.accent.primary
                : theme.colors.border.light,
            borderWidth: pendingIntention === NUTRITION_CHECK ? 2 : 1,
            backgroundColor:
              pendingIntention === NUTRITION_CHECK
                ? theme.colors.accent.primary10
                : theme.colors.background.card,
          }}
        >
          <UtensilsCrossed size={theme.iconSize.md} color={theme.colors.status.warning} />
          <Text className="text-sm font-medium text-text-primary">
            {t('coach.actions.nutritionCheck')}
          </Text>
        </Pressable>
      </ScrollView>
    );
  }, [
    handleAnalyzeProgress,
    handleGenerateWorkouts,
    handleNutritionCheck,
    pendingIntention,
    t,
    theme.colors.accent.primary,
    theme.colors.accent.primary10,
    theme.colors.background.card,
    theme.colors.border.light,
    theme.colors.status.info,
    theme.colors.status.warning,
    theme.iconSize.md,
    theme.spacing.gap.sm,
  ]);

  const headerRight = useMemo(
    () => <MenuButton size="lg" onPress={() => {}} className="h-10 w-10 active:bg-white/5" />,
    []
  );

  return (
    <FullScreenModal
      visible={visible}
      onClose={onClose}
      title={t('coach.title')}
      headerRight={headerRight}
      scrollable={false}
    >
      <View className="flex-1 bg-bg-primary">
        <View
          className="flex-row items-center gap-3 border-b px-4 py-3"
          style={{ borderColor: theme.colors.border.light }}
        >
          <View className="relative">
            <Image
              source={AI_COACH_AVATAR}
              className="rounded-full"
              style={{
                width: theme.size['10'],
                height: theme.size['10'],
                borderWidth: theme.borderWidth.medium,
                borderColor: theme.colors.accent.primary40,
              }}
              resizeMode="cover"
            />
            <View
              className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2"
              style={{
                backgroundColor: theme.colors.accent.primary,
                borderColor: theme.colors.background.primary,
                borderWidth: theme.borderWidth.medium,
              }}
            />
          </View>
          <View>
            <Text className="text-lg font-bold text-text-primary">{t('coach.name')}</Text>
            <View className="flex-row items-center gap-1">
              <View
                className="h-1.5 w-1.5 rounded-full"
                style={{
                  backgroundColor: isOnline
                    ? theme.colors.accent.primary
                    : theme.colors.status.error,
                }}
              />
              <Text
                className="text-xs font-medium"
                style={{
                  color: isOnline ? theme.colors.accent.primary : theme.colors.status.error,
                }}
              >
                {isOnline ? t('coach.status') : t('coach.statusOffline')}
              </Text>
            </View>
          </View>
        </View>

        <View
          className="flex-1"
          style={keyboardHeight > 0 ? { paddingBottom: keyboardHeight - insets.bottom } : undefined}
        >
          <GiftedChat
            messages={displayMessages}
            onSend={onSend}
            user={{ _id: 1 }}
            isTyping={isSending}
            renderBubble={(props) => renderBubble(props, theme, handleViewWorkoutDetails)}
            renderAvatar={(props) => renderAvatar(props, theme)}
            renderCustomView={(props) => renderCustomView(props, handleViewWorkoutDetails)}
            renderInputToolbar={(props) =>
              renderInputToolbar(props, theme, pendingIntention, handleClearIntention, t)
            }
            renderComposer={(props) =>
              renderComposer(props, t, theme, failedMessageText, clearFailedMessageText)
            }
            renderSend={(props) => renderSend(props, theme, failedMessageText)}
            renderAccessory={renderAccessory}
            renderDay={(props) => renderDay(props, t, theme)}
            scrollToBottomComponent={() => null}
            minInputToolbarHeight={0}
            listProps={{
              contentContainerStyle: {
                paddingBottom: theme.spacing.padding.base,
                paddingHorizontal: theme.spacing.padding.base,
              },
              ListFooterComponent: hasMore ? (
                <Pressable
                  onPress={loadMore}
                  disabled={isLoadingMore}
                  className="mb-4 items-center py-2"
                >
                  {isLoadingMore ? (
                    <ActivityIndicator size="small" color={theme.colors.accent.primary} />
                  ) : (
                    <Text
                      className="text-sm font-medium"
                      style={{ color: theme.colors.accent.primary }}
                    >
                      {t('replaceExercise.loadMore')}
                    </Text>
                  )}
                </Pressable>
              ) : null,
            }}
          />
        </View>
      </View>

      <PastWorkoutDetailModal
        visible={!!selectedWorkoutId}
        onClose={() => setSelectedWorkoutId(null)}
        workoutId={selectedWorkoutId || undefined}
      />
    </FullScreenModal>
  );
}

const getStyles = (theme: Theme) =>
  StyleSheet.create({
    userBubbleContainer: {
      maxWidth: '85%',
      marginRight: theme.spacing.margin.zero,
      marginLeft: 'auto',
      alignItems: 'flex-end',
    },
    userBubbleGradient: {
      paddingHorizontal: theme.spacing.padding.base,
      paddingVertical: theme.spacing.padding.md,
      borderRadius: theme.borderRadius.xl,
      borderBottomRightRadius: theme.spacing.padding.xs,
    },
    aiBubbleContainer: {
      maxWidth: '85%',
      marginLeft: theme.spacing.margin.zero,
      marginRight: 'auto',
      alignItems: 'flex-start',
    },
    aiBubbleContent: {
      backgroundColor: theme.colors.background.cardElevated,
      paddingHorizontal: theme.spacing.padding.base,
      paddingVertical: theme.spacing.padding.md,
      borderRadius: theme.borderRadius.xl,
      borderBottomLeftRadius: theme.spacing.padding.xs,
    },
    avatar: {
      width: theme.size['8'],
      height: theme.size['8'],
      borderRadius: theme.borderRadius.full / 2,
      marginRight: theme.spacing.padding.sm,
      marginBottom: theme.spacing.padding.xs,
    },
    sendContainer: {
      justifyContent: 'center',
      alignItems: 'center',
      alignSelf: 'flex-end',
      marginLeft: theme.spacing.padding.sm,
    },
    composerWrapper: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: theme.borderRadius.xl,
      borderWidth: theme.borderWidth.thin,
      borderColor: theme.colors.border.light,
      backgroundColor: theme.colors.background.card,
      paddingLeft: theme.spacing.padding.xs,
    },
    composerTextInput: {
      fontSize: theme.typography.fontSize.base,
      color: theme.colors.text.primary,
      marginTop: theme.spacing.padding.sm,
      marginBottom: theme.spacing.padding.sm,
    },
    inputToolbarContainer: {
      backgroundColor: 'transparent',
      borderTopWidth: theme.borderWidth.none,
      paddingHorizontal: theme.spacing.padding.base,
      paddingBottom: theme.spacing.padding.sm,
    },
    inputToolbarPrimary: {
      alignItems: 'flex-end',
    },
  });
