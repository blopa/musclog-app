import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import type { TFunction } from 'i18next';
import {
  Copy,
  Dumbbell,
  Images,
  Paperclip,
  PlusCircle,
  Send as SendIcon,
  Share2,
  Trash2,
  TrendingUp,
  UtensilsCrossed,
  X,
  Zap,
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
  Share,
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
  TRACK_MEAL,
} from '../../constants/chat';
import { ChatService } from '../../database/services';
import {
  AI_COACH_AVATAR,
  type ExtendedIMessage,
  useChatMessages,
} from '../../hooks/useChatMessages';
import { useDebouncedSettings } from '../../hooks/useDebouncedSettings';
import { useTheme } from '../../hooks/useTheme';
import type { Theme } from '../../theme';
import { FALLBACK_EXERCISE_IMAGE } from '../../utils/exerciseImage';
import { createThumbnail, pickDocument } from '../../utils/file';
import { BottomPopUpMenu, type BottomPopUpMenuItem } from '../BottomPopUpMenu';
import { ChatWorkoutCard } from '../cards/ChatWorkoutCard';
import { ChatWorkoutCompletedCard } from '../cards/ChatWorkoutCompletedCard';
import { useSnackbar } from '../SnackbarContext';
import { MenuButton } from '../theme/MenuButton';
import { SegmentedControl } from '../theme/SegmentedControl';
import { useUnreadChat } from '../UnreadChatContext';
import { ConfirmationModal } from './ConfirmationModal';
import { FullScreenModal } from './FullScreenModal';
import PastWorkoutDetailModal from './PastWorkoutDetailModal';

const ENABLE_FILE_ATTACHMENT = true;

const getPendingIntentionDisplayText = (pendingIntention: string, t: TFunction): string => {
  switch (pendingIntention) {
    case GENERATE_MY_WORKOUTS:
      return t('coach.actions.workoutGen');
    case ANALYZE_PROGRESS:
      return t('coach.actions.analyzeProgress');
    case NUTRITION_CHECK:
      return t('coach.actions.nutritionCheck');
    case TRACK_MEAL:
      return t('coach.actions.trackMeal');
    default:
      return pendingIntention;
  }
};

const getConversationContextBackgroundColor = (
  conversationContext: string,
  theme: Theme
): string => {
  switch (conversationContext) {
    case 'general':
      return 'transparent';
    case 'exercise':
      return theme.colors.status.info20;
    case 'nutrition':
      return theme.colors.accent.primary20;
    default:
      return 'transparent';
  }
};

const getConversationContextBubbleGradient = (
  conversationContext: string,
  theme: Theme
): readonly [string, string, ...string[]] => {
  switch (conversationContext) {
    case 'general':
      // Indigo to purple gradient for general context
      return theme.colors.gradients.userBubble;
    case 'exercise':
      // Blue to emerald gradient for exercise context
      return theme.colors.gradients.blueEmerald;
    case 'nutrition':
      // Green to jade gradient for nutrition context (current default)
      return theme.colors.gradients.celebrationGlow;
    default:
      return theme.colors.gradients.userBubble;
  }
};

const getConversationContextIcon = (
  conversationContext: string,
  theme: Theme
): { Icon: typeof Zap | typeof Dumbbell | typeof UtensilsCrossed; color: string } => {
  switch (conversationContext) {
    case 'general':
      return { Icon: Zap, color: theme.colors.background.gray700 };
    case 'exercise':
      return { Icon: Dumbbell, color: theme.colors.status.info };
    case 'nutrition':
      return { Icon: UtensilsCrossed, color: theme.colors.accent.primary };
    default:
      return { Icon: Zap, color: theme.colors.background.gray700 };
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

const MessageImage = ({ props, theme }: { props: any; theme: Theme }) => {
  const [hasError, setHasError] = useState(false);

  if (hasError) {
    return (
      <View
        style={{
          width: 150,
          height: 100,
          borderRadius: 8,
          backgroundColor: theme.colors.background.card,
          alignItems: 'center',
          justifyContent: 'center',
          margin: 3,
        }}
      >
        <Images size={24} color={theme.colors.text.tertiary} />
      </View>
    );
  }

  return (
    <Image
      source={{ uri: props.currentMessage.image }}
      style={{
        width: 150,
        height: 100,
        borderRadius: 8,
        margin: 3,
      }}
      resizeMode="cover"
      onError={() => setHasError(true)}
    />
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
          image={FALLBACK_EXERCISE_IMAGE}
          onStartWorkout={() => {
            // TODO: Implement workout start functionality from coach modal
            console.log('Start workout');
          }}
        />
      </View>
    );
  }

  return null;
};

const renderBubble = (
  props: BubbleProps<ExtendedIMessage>,
  theme: Theme,
  conversationContext: string,
  onViewWorkoutDetails?: (workoutLogId: string) => void,
  onLongPress?: (message: ExtendedIMessage) => void
) => {
  const { currentMessage, user } = props;
  const isUser = user && currentMessage?.user._id === user._id;
  const styles = getStyles(theme);

  if (isUser) {
    const bubbleGradient = getConversationContextBubbleGradient(conversationContext, theme);
    return (
      <Pressable
        style={styles.userBubbleContainer}
        onLongPress={() => currentMessage && onLongPress?.(currentMessage)}
        delayLongPress={350}
      >
        {!!currentMessage?.image ? <MessageImage props={props} theme={theme} /> : null}
        {!!currentMessage?.text ? (
          <LinearGradient
            colors={bubbleGradient as readonly [string, string, ...string[]]}
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
      </Pressable>
    );
  } else {
    return (
      <Pressable
        style={styles.aiBubbleContainer}
        onLongPress={() => currentMessage && onLongPress?.(currentMessage)}
        delayLongPress={350}
      >
        {!!currentMessage?.user.name ? (
          <Text className="mb-1 ml-1 text-xs" style={{ color: theme.colors.text.secondary }}>
            {currentMessage.user.name}
          </Text>
        ) : null}
        {!!currentMessage?.image ? <MessageImage props={props} theme={theme} /> : null}
        {!!currentMessage?.text && !currentMessage?.workoutCompleted ? (
          <View style={styles.aiBubbleContent}>{renderMessageText(props, theme)}</View>
        ) : null}
        {currentMessage?.workoutCompleted || currentMessage?.workout
          ? renderCustomView(props, onViewWorkoutDetails)
          : null}
      </Pressable>
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
  failedMessageText: string | null,
  hasAttachedImage: boolean
) => {
  const styles = getStyles(theme);
  // When we restored failed text, GiftedChat's state may not have it yet; pass it so Send button is visible
  const effectiveText = (failedMessageText ?? props.text ?? '').trim();
  const isDisabled = !effectiveText && !hasAttachedImage;

  // Always render the send button, regardless of GiftedChat's internal logic
  return (
    <View style={styles.sendContainer}>
      <Pressable
        onPress={() => {
          if (!isDisabled && props.onSend) {
            props.onSend({ text: effectiveText }, true);
          }
        }}
        disabled={isDisabled}
        className="h-12 w-12 items-center justify-center rounded-full active:scale-90"
        style={{
          backgroundColor: isDisabled ? theme.colors.border.light : theme.colors.accent.primary,
          opacity: isDisabled ? 0.5 : 1,
        }}
      >
        <SendIcon
          size={theme.iconSize.lg}
          color={isDisabled ? theme.colors.text.tertiary : theme.colors.text.black}
        />
      </Pressable>
    </View>
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
  onAttachFile,
  isImageAttachmentEnabled,
}: {
  props: ComposerProps;
  t: TFunction;
  theme: Theme;
  failedMessageText: string | null;
  clearFailedMessageText: () => void;
  onAttachFile: () => void;
  isImageAttachmentEnabled: boolean;
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
      {ENABLE_FILE_ATTACHMENT && isImageAttachmentEnabled ? (
        <Pressable
          onPress={onAttachFile}
          className="mr-2 items-center justify-center p-2 active:scale-90"
          style={({ pressed }) => ({
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Paperclip size={theme.iconSize.md} color={theme.colors.text.tertiary} />
        </Pressable>
      ) : null}
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
  clearFailedMessageText: () => void,
  onAttachFile: () => void,
  isImageAttachmentEnabled: boolean
) => (
  <ComposerWithRestoredText
    props={props}
    t={t}
    theme={theme}
    failedMessageText={failedMessageText}
    clearFailedMessageText={clearFailedMessageText}
    onAttachFile={onAttachFile}
    isImageAttachmentEnabled={isImageAttachmentEnabled}
  />
);

const renderInputToolbar = (
  props: InputToolbarProps<ExtendedIMessage>,
  theme: Theme,
  pendingIntention: string | null,
  onClearIntention: () => void,
  attachedImage: { uri: string } | null,
  onRemoveImage: () => void,
  t: TFunction
) => {
  const styles = getStyles(theme);

  return (
    <View>
      {attachedImage ? (
        <View className="px-4 py-2">
          <View
            className="relative h-20 w-20 rounded-lg"
            style={{ backgroundColor: theme.colors.background.card }}
          >
            <Image
              source={{ uri: attachedImage.uri }}
              style={{ width: '100%', height: '100%', borderRadius: 8 }}
              resizeMode="cover"
            />
            <Pressable
              onPress={onRemoveImage}
              className="absolute -right-2 -top-2 rounded-full p-1 shadow-sm"
              style={{ backgroundColor: theme.colors.background.gray700 }}
            >
              <X size={12} color={theme.colors.text.white} />
            </Pressable>
          </View>
        </View>
      ) : null}
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

// TODO: if the message fails to be sent to Gemini or Openai due to lack of credits, show a message in the chat
// explaining it and with a button to open the setting screen.
export function CoachModal({ visible, onClose }: CoachModalProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const { conversationContext, handleConversationContextChange } = useDebouncedSettings();
  const {
    messages,
    pendingCoachMessage,
    isSending,
    isLoadingMore,
    hasMore,
    loadMore,
    sendMessage,
    clearHistory,
    deleteMessage,
    sessionId,
    addPendingCoachMessage,
    clearPendingCoachMessage,
    failedMessageText,
    clearFailedMessageText,
    ephemeralErrorAsMessage,
  } = useChatMessages(conversationContext);

  const { clearUnreadCount } = useUnreadChat();
  const { showSnackbar } = useSnackbar();
  const [isOnline, setIsOnline] = useState(false);
  const [pendingIntention, setPendingIntention] = useState<string | null>(null);
  const [selectedWorkoutId, setSelectedWorkoutId] = useState<string | null>(null);
  const [attachedImage, setAttachedImage] = useState<{ uri: string; base64: string } | null>(null);
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [isClearHistoryModalVisible, setIsClearHistoryModalVisible] = useState(false);
  const [isClearingHistory, setIsClearingHistory] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<ExtendedIMessage | null>(null);

  useEffect(() => {
    return NetInfo.addEventListener((state) => {
      setIsOnline(state.isConnected ?? false);
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

  // Ensure attached image is cleared if intention is no longer Track Meal
  useEffect(() => {
    if (pendingIntention !== TRACK_MEAL && attachedImage) {
      setAttachedImage(null);
    }
  }, [pendingIntention, attachedImage]);

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
      const image = attachedImage?.base64;
      if (text || image) {
        sendMessage(text ?? '', image);
        setAttachedImage(null);
      }
    },
    [sendMessage, attachedImage]
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

  const handleTrackMeal = useCallback(async () => {
    if (pendingIntention === TRACK_MEAL) {
      await AsyncStorage.removeItem(CHAT_INTENTION_KEY);
      setPendingIntention(null);
      clearPendingCoachMessage();
    } else {
      await AsyncStorage.setItem(CHAT_INTENTION_KEY, TRACK_MEAL);
      setPendingIntention(TRACK_MEAL);
      addPendingCoachMessage({
        _id: `pending-track-meal-${Date.now()}`,
        text: t('coach.trackMealPrompt'),
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
    setAttachedImage(null);
    clearPendingCoachMessage();
  }, [clearPendingCoachMessage]);

  const handleAttachFile = useCallback(async () => {
    try {
      const result = await pickDocument(['image/*']);

      if (!result.canceled && result.assets?.[0]) {
        const file = result.assets[0];

        // Create a thumbnail for efficient chat preview (max 300px)
        const { uri, base64 } = await createThumbnail(file.uri, 300);

        setAttachedImage({
          uri,
          base64: base64 || '',
        });
      }
    } catch (error) {
      console.error('Error picking document:', error);
      showSnackbar('error', t('coach.errors.filePickFailed'), {
        action: t('snackbar.ok'),
      });
    }
  }, [sendMessage, showSnackbar, t]);

  const handleViewWorkoutDetails = useCallback((workoutLogId: string) => {
    setSelectedWorkoutId(workoutLogId);
  }, []);

  const handleMessageLongPress = useCallback((message: ExtendedIMessage) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setSelectedMessage(message);
  }, []);

  const messageMenuItems = useMemo(
    () =>
      selectedMessage
        ? [
            {
              icon: Copy,
              iconColor: theme.colors.text.primary,
              iconBgColor: theme.colors.background.iconDarker,
              title: t('coach.message.copy'),
              description: t('coach.message.copyDesc'),
              onPress: async () => {
                setSelectedMessage(null);
                await Clipboard.setStringAsync(selectedMessage.text ?? '');
                showSnackbar('success', t('coach.message.copied'), { action: t('snackbar.ok') });
              },
            },
            {
              icon: Share2,
              iconColor: theme.colors.text.primary,
              iconBgColor: theme.colors.background.iconDarker,
              title: t('coach.message.share'),
              description: t('coach.message.shareDesc'),
              onPress: () => {
                setSelectedMessage(null);
                Share.share({ message: selectedMessage.text ?? '' }).catch(() => {});
              },
            },
            {
              icon: Trash2,
              iconColor: theme.colors.status.error50,
              iconBgColor: theme.colors.status.error10,
              title: t('coach.message.delete'),
              description: t('coach.message.deleteDesc'),
              titleColor: theme.colors.status.error50,
              descriptionColor: theme.colors.status.error50,
              onPress: async () => {
                setSelectedMessage(null);
                await deleteMessage(selectedMessage._id);
                showSnackbar('success', t('coach.message.deleted'), { action: t('snackbar.ok') });
              },
            },
          ]
        : [],
    [
      selectedMessage,
      deleteMessage,
      showSnackbar,
      t,
      theme.colors.background.iconDarker,
      theme.colors.status.error10,
      theme.colors.status.error50,
      theme.colors.text.primary,
    ]
  );

  const handleShareHistory = useCallback(async () => {
    if (!sessionId) {
      showSnackbar('error', t('coach.errors.generalError'), {
        action: t('snackbar.ok'),
      });
      return;
    }

    try {
      const records = await ChatService.getSessionMessages(sessionId);
      if (!records.length) {
        showSnackbar('error', t('coach.share.noMessages'), {
          action: t('snackbar.ok'),
        });
        return;
      }

      const sorted = [...records].sort((a, b) => a.createdAt - b.createdAt);
      const header = t('coach.share.title');
      const youLabel = t('coach.you');
      const coachLabel = t('coach.name');

      const lines: string[] = [header, ''];

      for (const record of sorted) {
        const senderLabel = record.sender === 'user' ? youLabel : coachLabel;
        const timestamp = new Date(record.createdAt).toLocaleString();
        lines.push(`${timestamp} - ${senderLabel}: ${record.message}`);
      }

      await Share.share({ message: lines.join('\n') });
    } catch (err) {
      console.error('[CoachModal] shareHistory failed:', err);
      showSnackbar('error', t('coach.share.failed'), {
        action: t('snackbar.ok'),
      });
    }
  }, [sessionId, showSnackbar, t]);

  const handleClearHistoryPress = useCallback(() => {
    setIsMenuVisible(false);
    setIsClearHistoryModalVisible(true);
  }, []);

  const handleConfirmClearHistory = useCallback(async () => {
    try {
      setIsClearingHistory(true);
      await clearHistory(conversationContext);
      showSnackbar('success', t('coach.success.historyCleared'), {
        action: t('snackbar.ok'),
      });
    } catch (err) {
      console.error('[CoachModal] clearHistory failed:', err);
      showSnackbar('error', t('coach.errors.generalError'), {
        action: t('snackbar.ok'),
      });
    } finally {
      setIsClearingHistory(false);
    }
  }, [clearHistory, conversationContext, showSnackbar, t]);

  const headerMenuItems: BottomPopUpMenuItem[] = useMemo(
    () => [
      {
        icon: Share2,
        iconColor: theme.colors.text.primary,
        iconBgColor: theme.colors.background.iconDarker,
        title: t('coach.menu.shareHistory'),
        description: t('coach.menu.shareHistoryDesc'),
        onPress: handleShareHistory,
      },
      {
        icon: Trash2,
        iconColor: theme.colors.status.error50,
        iconBgColor: theme.colors.status.error10,
        title: t('coach.menu.clearHistory'),
        description: t('coach.menu.clearHistoryDesc'),
        titleColor: theme.colors.status.error50,
        descriptionColor: theme.colors.status.error50,
        onPress: handleClearHistoryPress,
      },
    ],
    [
      handleClearHistoryPress,
      handleShareHistory,
      t,
      theme.colors.background.iconDarker,
      theme.colors.status.error10,
      theme.colors.status.error50,
      theme.colors.text.primary,
    ]
  );

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
          onPress={handleTrackMeal}
          className="flex-row items-center gap-2 whitespace-nowrap rounded-full border bg-bg-card px-4 py-2 active:scale-95"
          style={{
            borderColor:
              pendingIntention === TRACK_MEAL
                ? theme.colors.accent.primary
                : theme.colors.border.light,
            borderWidth: pendingIntention === TRACK_MEAL ? 2 : 1,
            backgroundColor:
              pendingIntention === TRACK_MEAL
                ? theme.colors.accent.primary10
                : theme.colors.background.card,
          }}
        >
          <UtensilsCrossed size={theme.iconSize.md} color={theme.colors.accent.primary} />
          <Text className="text-sm font-medium text-text-primary">
            {t('coach.actions.trackMeal')}
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
    () => (
      <MenuButton
        size="lg"
        onPress={() => {
          setIsMenuVisible(true);
        }}
        className="h-10 w-10 active:bg-white/5"
      />
    ),
    []
  );

  // Memoize GiftedChat render callbacks so message bubbles don't re-render
  // on every keystroke / state update. The module-level render functions are
  // stable; only the wrapper closures need to be stabilized here.
  const gcRenderBubble = useCallback(
    (props: Parameters<typeof renderBubble>[0]) =>
      renderBubble(
        props,
        theme,
        conversationContext,
        handleViewWorkoutDetails,
        handleMessageLongPress
      ),
    [theme, conversationContext, handleViewWorkoutDetails, handleMessageLongPress]
  );
  const gcRenderAvatar = useCallback(
    (props: Parameters<typeof renderAvatar>[0]) => renderAvatar(props, theme),
    [theme]
  );

  const gcRenderCustomView = useCallback(
    (props: Parameters<typeof renderCustomView>[0]) =>
      renderCustomView(props, handleViewWorkoutDetails),
    [handleViewWorkoutDetails]
  );

  const gcRenderInputToolbar = useCallback(
    (props: Parameters<typeof renderInputToolbar>[0]) =>
      renderInputToolbar(
        props,
        theme,
        pendingIntention,
        handleClearIntention,
        attachedImage,
        () => setAttachedImage(null),
        t
      ),
    [theme, pendingIntention, handleClearIntention, attachedImage, t]
  );

  const gcRenderComposer = useCallback(
    (props: Parameters<typeof renderComposer>[0]) =>
      renderComposer(
        props,
        t,
        theme,
        failedMessageText,
        clearFailedMessageText,
        handleAttachFile,
        pendingIntention === TRACK_MEAL
      ),
    [t, theme, failedMessageText, clearFailedMessageText, handleAttachFile, pendingIntention]
  );

  const gcRenderSend = useCallback(
    (props: Parameters<typeof renderSend>[0]) =>
      renderSend(
        props,
        theme,
        failedMessageText,
        !!attachedImage && pendingIntention === TRACK_MEAL
      ),
    [theme, failedMessageText, attachedImage, pendingIntention]
  );

  const gcRenderDay = useCallback(
    (props: Parameters<typeof renderDay>[0]) => renderDay(props, t, theme),
    [t, theme]
  );

  const gcRenderMessageImage = useCallback(
    (props: any) => <MessageImage props={props} theme={theme} />,
    [theme]
  );

  const gcScrollToBottomComponent = useCallback(() => null, []);

  const contextIcon = useMemo(() => {
    const { Icon, color } = getConversationContextIcon(conversationContext, theme);
    return <Icon size={theme.iconSize.lg} color={color} />;
  }, [conversationContext, theme]);

  const conversationContextOptions = useMemo(
    () => [
      {
        value: 'general',
        label: t('coach.context.general'),
        icon: (
          <Zap
            size={theme.iconSize.sm}
            color={
              conversationContext === 'general'
                ? theme.colors.text.primary
                : theme.colors.text.tertiary
            }
          />
        ),
      },
      {
        value: 'exercise',
        label: t('coach.context.exercise'),
        icon: (
          <Dumbbell
            size={theme.iconSize.sm}
            color={
              conversationContext === 'exercise'
                ? theme.colors.text.primary
                : theme.colors.text.tertiary
            }
          />
        ),
      },
      {
        value: 'nutrition',
        label: t('coach.context.nutrition'),
        icon: (
          <UtensilsCrossed
            size={theme.iconSize.sm}
            color={
              conversationContext === 'nutrition'
                ? theme.colors.text.primary
                : theme.colors.text.tertiary
            }
          />
        ),
      },
    ],
    [conversationContext, theme, t]
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
          style={{
            borderColor: theme.colors.border.light,
            backgroundColor: getConversationContextBackgroundColor(conversationContext, theme),
          }}
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
                backgroundColor: isOnline ? theme.colors.accent.primary : theme.colors.status.error,
                borderColor: theme.colors.background.primary,
                borderWidth: theme.borderWidth.medium,
              }}
            />
          </View>
          <View className="flex-1">
            <View className="flex-row flex-wrap items-baseline gap-1.5">
              <Text className="text-lg font-bold text-text-primary">{t('coach.name')}</Text>
              <Text className="text-sm font-medium" style={{ color: theme.colors.text.secondary }}>
                - {conversationContext.charAt(0).toUpperCase() + conversationContext.slice(1)}
              </Text>
            </View>
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
          {contextIcon}
        </View>

        <View className="border-b px-4 py-3" style={{ borderColor: theme.colors.border.light }}>
          <SegmentedControl
            options={conversationContextOptions}
            value={conversationContext}
            onValueChange={(value) =>
              handleConversationContextChange(value as 'general' | 'exercise' | 'nutrition')
            }
            variant="elevated"
          />
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
            renderBubble={gcRenderBubble}
            renderAvatar={gcRenderAvatar}
            renderCustomView={gcRenderCustomView}
            renderInputToolbar={gcRenderInputToolbar}
            renderComposer={gcRenderComposer}
            renderSend={gcRenderSend}
            renderAccessory={renderAccessory}
            renderDay={gcRenderDay}
            renderMessageImage={gcRenderMessageImage}
            scrollToBottomComponent={gcScrollToBottomComponent}
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

      <BottomPopUpMenu
        visible={isMenuVisible}
        onClose={() => setIsMenuVisible(false)}
        title={t('coach.menu.title')}
        items={headerMenuItems}
      />

      <BottomPopUpMenu
        visible={!!selectedMessage}
        onClose={() => setSelectedMessage(null)}
        title={t('coach.message.menuTitle')}
        items={messageMenuItems}
      />

      <ConfirmationModal
        visible={isClearHistoryModalVisible}
        onClose={() => setIsClearHistoryModalVisible(false)}
        onConfirm={handleConfirmClearHistory}
        title={t('coach.confirmClear.title')}
        message={t('coach.confirmClear.message')}
        confirmLabel={t('common.delete')}
        variant="destructive"
        isLoading={isClearingHistory}
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
