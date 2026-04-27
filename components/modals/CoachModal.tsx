import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import type { TFunction } from 'i18next';
import {
  ClipboardList,
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
  SendProps,
} from 'react-native-gifted-chat';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomPopUpMenu, type BottomPopUpMenuItem } from '@/components/BottomPopUpMenu';
import { ChatMealCard } from '@/components/cards/ChatMealCard';
import { ChatWorkoutCard } from '@/components/cards/ChatWorkoutCard';
import { ChatWorkoutCompletedCard } from '@/components/cards/ChatWorkoutCompletedCard';
import { ChatMealPlanCarousel } from '@/components/chat/ChatMealPlanCarousel';
import { MenuButton } from '@/components/theme/MenuButton';
import { SegmentedControl } from '@/components/theme/SegmentedControl';
import {
  ANALYZE_PROGRESS,
  CHAT_INTENTION_KEY,
  GENERATE_MEAL_PLAN,
  GENERATE_MY_WORKOUTS,
  NUTRITION_CHECK,
  TRACK_MEAL,
} from '@/constants/chat';
import { useSnackbar } from '@/context/SnackbarContext';
import { useUnreadChat } from '@/context/UnreadChatContext';
import { ChatService, MuscleService, WorkoutService } from '@/database/services';
import { AI_COACH_AVATAR, type ExtendedIMessage, useChatMessages } from '@/hooks/useChatMessages';
import { useDebouncedSettings } from '@/hooks/useDebouncedSettings';
import { useNativeShareText } from '@/hooks/useNativeShareText';
import { useTheme } from '@/hooks/useTheme';
import type { Theme } from '@/theme';
import { type TrackMealIngredient } from '@/utils/coachAI';
import { FALLBACK_EXERCISE_IMAGE } from '@/utils/exerciseImage';
import { createThumbnail, pickDocument } from '@/utils/file';
import { flushLoadingPaint } from '@/utils/flushLoadingPaint';
import { handleError } from '@/utils/handleError';

import { ConfirmationModal } from './ConfirmationModal';
import { FullScreenModal } from './FullScreenModal';
import { LogMealModal } from './LogMealModal';
import PastWorkoutDetailModal from './PastWorkoutDetailModal';
import { WorkoutMusclesModal } from './WorkoutMusclesModal';

const getPendingIntentionDisplayText = (pendingIntention: string, t: TFunction): string => {
  switch (pendingIntention) {
    case GENERATE_MY_WORKOUTS:
      return t('coach.actions.workoutGen');
    case GENERATE_MEAL_PLAN:
      return t('coach.actions.mealPlan');
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

type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

const renderCustomView = (
  props: BubbleProps<ExtendedIMessage>,
  onViewWorkoutDetails?: (workoutLogId: string) => void,
  onViewMealDetails?: (meal: ExtendedIMessage['meal'], mealType: MealType) => void,
  onSeeAllMeals?: () => void,
  onViewMuscles?: (workoutLogId: string, workoutName: string) => void
) => {
  const { currentMessage } = props;
  if (currentMessage?.workoutCompleted) {
    return (
      <View className="mt-2 w-full pr-4">
        <ChatWorkoutCompletedCard
          {...currentMessage.workoutCompleted}
          onViewDetails={
            onViewWorkoutDetails
              ? () => onViewWorkoutDetails(currentMessage.workoutCompleted!.workoutLogId)
              : undefined
          }
          onViewMuscles={
            onViewMuscles
              ? () =>
                  onViewMuscles(
                    currentMessage.workoutCompleted!.workoutLogId,
                    currentMessage.workoutCompleted!.workoutName
                  )
              : undefined
          }
        />
      </View>
    );
  }

  if (currentMessage?.workout) {
    return (
      <View className="mt-2 w-full pr-4">
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

  if (currentMessage?.meal) {
    return (
      <View className="mt-2 w-full pr-4">
        <ChatMealCard
          meals={currentMessage.meal.meals}
          onViewDetails={(mealType) => onViewMealDetails?.(currentMessage.meal!, mealType)}
        />
      </View>
    );
  }

  if (currentMessage?.mealPlan?.meals) {
    return <ChatMealPlanCarousel meals={currentMessage.mealPlan.meals} onSeeAll={onSeeAllMeals} />;
  }

  return null;
};

const renderBubble = (
  props: BubbleProps<ExtendedIMessage>,
  theme: Theme,
  conversationContext: string,
  onViewWorkoutDetails?: (workoutLogId: string) => void,
  onLongPress?: (message: ExtendedIMessage) => void,
  onViewMealDetails?: (meal: ExtendedIMessage['meal'], mealType: MealType) => void,
  onGoToSettings?: () => void,
  goToSettingsLabel?: string,
  onSeeAllMeals?: () => void,
  onViewMuscles?: (workoutLogId: string, workoutName: string) => void
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
            className="mt-1 mr-1 text-right text-xs"
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
        {currentMessage?.showSettingsButton && onGoToSettings ? (
          <Pressable
            onPress={onGoToSettings}
            className="mt-2 rounded-full px-4 py-2 active:opacity-70"
            style={{ backgroundColor: theme.colors.accent.primary, alignSelf: 'flex-start' }}
          >
            <Text
              style={{
                color: theme.colors.text.black,
                fontSize: theme.typography.fontSize.sm,
                fontWeight: '600',
              }}
            >
              {goToSettingsLabel}
            </Text>
          </Pressable>
        ) : null}
        {currentMessage?.workoutCompleted ||
        currentMessage?.workout ||
        currentMessage?.meal ||
        currentMessage?.mealPlan
          ? renderCustomView(
              props,
              onViewWorkoutDetails,
              onViewMealDetails,
              onSeeAllMeals,
              onViewMuscles
            )
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

  // Avatar is rendered inside ChatMealPlanCarousel for meal plan messages
  if (props.currentMessage?.mealPlan) {
    return null;
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
        <View className="bg-bg-card rounded-full px-3 py-1">
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
  hasAttachedImage: boolean,
  isSending: boolean
) => {
  const styles = getStyles(theme);
  // When we restored failed text, GiftedChat's state may not have it yet; pass it so Send button is visible
  const effectiveText = (failedMessageText ?? props.text ?? '').trim();
  // Disable send button when: no text/image OR currently sending
  const isDisabled = (!effectiveText && !hasAttachedImage) || isSending;

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
        {isSending ? (
          <ActivityIndicator size="small" color={theme.colors.text.tertiary} />
        ) : (
          <SendIcon
            size={theme.iconSize.lg}
            color={isDisabled ? theme.colors.text.tertiary : theme.colors.text.black}
          />
        )}
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
  resetKey,
}: {
  props: ComposerProps;
  t: TFunction;
  theme: Theme;
  failedMessageText: string | null;
  clearFailedMessageText: () => void;
  onAttachFile: () => void;
  isImageAttachmentEnabled: boolean;
  resetKey: number;
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
      {isImageAttachmentEnabled ? (
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
        key={resetKey}
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
  isImageAttachmentEnabled: boolean,
  resetKey: number
) => (
  <ComposerWithRestoredText
    props={props}
    t={t}
    theme={theme}
    failedMessageText={failedMessageText}
    clearFailedMessageText={clearFailedMessageText}
    onAttachFile={onAttachFile}
    isImageAttachmentEnabled={isImageAttachmentEnabled}
    resetKey={resetKey}
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
              className="absolute -top-2 -right-2 rounded-full p-1 shadow-sm"
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
            <Text className="text-text-primary text-xs font-medium">
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
  /** Invoked after the coach closes when the user opens “My meals” from a meal plan (e.g. carousel). */
  onOpenMyMeals: () => void;
};

export function CoachModal({ visible, onClose, onOpenMyMeals }: CoachModalProps) {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const { conversationContext, handleConversationContextChange } = useDebouncedSettings();
  const {
    messages,
    pendingCoachMessage,
    pendingIntention: hookPendingIntention,
    isSending,
    isLoadingMore,
    hasMore,
    loadMore,
    sendMessage,
    clearHistory,
    deleteMessage,
    addPendingCoachMessage,
    clearPendingCoachMessage,
    failedMessageText,
    clearFailedMessageText,
    ephemeralErrorAsMessage,
    isCreditsError,
    markMealAsTracked,
    clearIntention,
    setPendingIntention: setHookPendingIntention,
  } = useChatMessages(conversationContext);

  const { clearUnreadCount } = useUnreadChat();
  const { showSnackbar } = useSnackbar();
  const { shareText } = useNativeShareText();
  const [isOnline, setIsOnline] = useState(false);
  const pendingIntention = hookPendingIntention;
  const setPendingIntention = setHookPendingIntention;
  const [selectedWorkoutId, setSelectedWorkoutId] = useState<string | null>(null);
  const [isMusclesModalVisible, setIsMusclesModalVisible] = useState(false);
  const [musclesModalGroups, setMusclesModalGroups] = useState<string[]>([]);
  const [musclesWorkoutName, setMusclesWorkoutName] = useState('');
  const [selectedMealForTracking, setSelectedMealForTracking] = useState<{
    messageId: string;
    mealTypeIdentifier: MealType;
    mealName?: string;
    calories: number;
    protein: number;
    carbs: number;
    fats: number;
    ingredients: TrackMealIngredient[];
  } | null>(null);
  const [attachedImage, setAttachedImage] = useState<{ uri: string; base64: string } | null>(null);
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [isClearHistoryModalVisible, setIsClearHistoryModalVisible] = useState(false);
  const [isClearingHistory, setIsClearingHistory] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<ExtendedIMessage | null>(null);
  const [isDeleteMessageModalVisible, setIsDeleteMessageModalVisible] = useState(false);
  const [messageToDelete, setMessageToDelete] = useState<ExtendedIMessage | null>(null);
  const [isDeletingMessage, setIsDeletingMessage] = useState(false);
  const [composerResetKey, setComposerResetKey] = useState(0);

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

  // Ensure attached image is cleared if intention is no longer Track Meal
  useEffect(() => {
    if (pendingIntention !== TRACK_MEAL && attachedImage) {
      setAttachedImage(null);
    }
  }, [pendingIntention, attachedImage]);

  // Keep screen awake while sending AI messages to prevent the phone from
  // turning off the screen and killing network requests
  useEffect(() => {
    if (isSending) {
      activateKeepAwakeAsync('coach-chat-sending').catch(() => {});
    } else {
      deactivateKeepAwake('coach-chat-sending').catch(() => {});
    }

    return () => {
      deactivateKeepAwake('coach-chat-sending').catch(() => {});
    };
  }, [isSending]);

  useEffect(() => {
    if (!visible) {
      setSelectedWorkoutId(null);
      setIsMusclesModalVisible(false);
      setMusclesModalGroups([]);
      setIsMenuVisible(false);
      setSelectedMessage(null);
      setIsClearHistoryModalVisible(false);
      setIsDeleteMessageModalVisible(false);
      setMessageToDelete(null);
    }
  }, [visible]);

  // KeyboardAvoidingView doesn't work reliably inside a Modal on either platform.
  // We manually track the keyboard height and apply it as padding instead.
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const show = Keyboard.addListener(showEvent, (e) => {
      setKeyboardHeight(e.endCoordinates.height);
    });

    const hide = Keyboard.addListener(hideEvent, () => {
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
        setComposerResetKey((k) => k + 1);
      }
    },
    [sendMessage, attachedImage]
  );

  const handleGenerateMealPlan = useCallback(async () => {
    if (pendingIntention === GENERATE_MEAL_PLAN) {
      await AsyncStorage.removeItem(CHAT_INTENTION_KEY);
      setPendingIntention(null);
      clearPendingCoachMessage();
    } else {
      await AsyncStorage.setItem(CHAT_INTENTION_KEY, GENERATE_MEAL_PLAN);
      setPendingIntention(GENERATE_MEAL_PLAN);
      addPendingCoachMessage({
        _id: `pending-meal-plan-gen-${Date.now()}`,
        text: t('coach.mealPlanPrompt'),
        createdAt: new Date(),
        user: { _id: 2, name: 'Loggy', avatar: AI_COACH_AVATAR },
      });
    }
  }, [addPendingCoachMessage, clearPendingCoachMessage, pendingIntention, setPendingIntention, t]);

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
  }, [addPendingCoachMessage, clearPendingCoachMessage, pendingIntention, setPendingIntention, t]);

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
  }, [addPendingCoachMessage, clearPendingCoachMessage, pendingIntention, setPendingIntention, t]);

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
  }, [addPendingCoachMessage, clearPendingCoachMessage, pendingIntention, setPendingIntention, t]);

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
  }, [addPendingCoachMessage, clearPendingCoachMessage, pendingIntention, setPendingIntention, t]);

  const handleClearIntention = useCallback(async () => {
    await clearIntention();
    setAttachedImage(null);
    clearPendingCoachMessage();
  }, [clearIntention, clearPendingCoachMessage]);

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
      showSnackbar('error', t('coach.errors.filePickFailed'));
    }
  }, [showSnackbar, t]);

  const handleViewWorkoutDetails = useCallback((workoutLogId: string) => {
    setSelectedWorkoutId(workoutLogId);
  }, []);

  const handleViewMuscles = useCallback(async (workoutLogId: string, workoutName: string) => {
    try {
      const { exercises } = await WorkoutService.getWorkoutWithDetails(workoutLogId);
      const exerciseIds = exercises.map((e) => e.id);
      const musclesByExercise = await MuscleService.getMusclesForExercises(exerciseIds);

      let muscleNames: string[];
      if (musclesByExercise.size > 0) {
        muscleNames = [
          ...new Set(
            Array.from(musclesByExercise.values())
              .flat()
              .map((m) => m.name)
          ),
        ];
      } else {
        // Backfill may not have run yet — fall back to coarse muscle groups
        muscleNames = [...new Set(exercises.map((e) => e.muscleGroup).filter(Boolean) as string[])];
      }

      setMusclesWorkoutName(workoutName);
      setMusclesModalGroups(muscleNames);
      setIsMusclesModalVisible(true);
    } catch (err) {
      console.error('Failed to load workout muscles:', err);
    }
  }, []);

  const handleViewMealDetails = useCallback(
    (meal: ExtendedIMessage['meal'], mealType: MealType) => {
      if (!meal) {
        return;
      }
      const entry = meal.meals.find((m) => m.mealType === mealType);
      if (!entry) {
        return;
      }
      setSelectedMealForTracking({
        messageId: meal.messageId,
        mealTypeIdentifier: mealType,
        mealName: entry.mealName,
        calories: entry.calories,
        protein: entry.protein,
        carbs: entry.carbs,
        fats: entry.fats,
        ingredients: entry.ingredients,
      });
    },
    []
  );

  const handleGoToSettings = useCallback(() => {
    onClose();
    router.navigate('/app/settings');
  }, [onClose, router]);

  const handleSeeAllMeals = useCallback(() => {
    onClose();
    onOpenMyMeals();
  }, [onClose, onOpenMyMeals]);

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
                showSnackbar('success', t('coach.message.copied'));
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
                shareText(selectedMessage.text ?? '').catch(() => {});
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
              onPress: () => {
                setMessageToDelete(selectedMessage);
                setSelectedMessage(null);
                setIsDeleteMessageModalVisible(true);
              },
            },
          ]
        : [],
    [
      selectedMessage,
      shareText,
      showSnackbar,
      t,
      theme.colors.background.iconDarker,
      theme.colors.status.error10,
      theme.colors.status.error50,
      theme.colors.text.primary,
    ]
  );

  const mealForLogMealModal = useMemo(() => {
    if (!selectedMealForTracking) {
      return undefined;
    }

    const rawIngredients = selectedMealForTracking.ingredients.map((i) => i.name).join(', ');

    const ingredientsDesc =
      rawIngredients.length > 80 ? `${rawIngredients.substring(0, 77)}...` : rawIngredients;

    const mealLabel =
      selectedMealForTracking.mealTypeIdentifier.charAt(0).toUpperCase() +
      selectedMealForTracking.mealTypeIdentifier.slice(1);

    const totalIngredientGrams = selectedMealForTracking.ingredients.reduce(
      (sum, i) => sum + i.grams,
      0
    );

    return {
      name: selectedMealForTracking.mealName ?? ingredientsDesc,
      type: mealLabel,
      calories: selectedMealForTracking.calories,
      protein: selectedMealForTracking.protein,
      carbs: selectedMealForTracking.carbs,
      fat: selectedMealForTracking.fats,
      grams: totalIngredientGrams > 0 ? totalIngredientGrams : 100,
    };
  }, [selectedMealForTracking]);

  const handleShareHistory = useCallback(async () => {
    try {
      const records = await ChatService.getMessagesByContext(conversationContext);
      if (!records.length) {
        showSnackbar('error', t('coach.share.noMessages'));
        return;
      }

      const sorted = [...records].sort((a, b) => a.createdAt - b.createdAt);
      const header = t('coach.share.title');
      const youLabel = t('coach.you');
      const coachLabel = t('coach.name');

      const lines: string[] = [header, ''];

      for (const record of sorted) {
        const senderLabel = record.sender === 'user' ? youLabel : coachLabel;
        const timestamp = new Date(record.createdAt).toLocaleString(
          i18n.resolvedLanguage ?? i18n.language
        );
        lines.push(
          t('coach.share.historyLine', {
            timestamp,
            sender: senderLabel,
            message: record.message,
          })
        );
      }

      await shareText(lines.join('\n'));
    } catch (err) {
      handleError(err, 'CoachModal.handleShareHistory', {
        snackbarMessage: t('coach.share.failed'),
      });
    }
  }, [conversationContext, i18n.resolvedLanguage, i18n.language, shareText, showSnackbar, t]);

  const handleClearHistoryPress = useCallback(() => {
    setIsMenuVisible(false);
    setIsClearHistoryModalVisible(true);
  }, []);

  const handleConfirmClearHistory = useCallback(async () => {
    setIsClearingHistory(true);
    await flushLoadingPaint();
    try {
      await clearHistory(conversationContext);
      showSnackbar('success', t('coach.success.historyCleared'));
    } catch (err) {
      handleError(err, 'CoachModal.handleConfirmClearHistory', {
        snackbarMessage: t('coach.errors.generalError'),
      });
    } finally {
      setIsClearingHistory(false);
    }
  }, [clearHistory, conversationContext, showSnackbar, t]);

  const handleConfirmDeleteMessage = useCallback(async () => {
    if (!messageToDelete) {
      return;
    }

    const id = messageToDelete._id;
    setIsDeletingMessage(true);
    await flushLoadingPaint();
    try {
      await deleteMessage(id);
      showSnackbar('success', t('coach.message.deleted'));
    } catch (err) {
      handleError(err, 'CoachModal.handleConfirmDeleteMessage', {
        snackbarMessage: t('coach.errors.generalError'),
      });
    } finally {
      setIsDeletingMessage(false);
    }
  }, [messageToDelete, deleteMessage, showSnackbar, t]);

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
          className="bg-bg-card flex-row items-center gap-2 rounded-full border px-4 py-2 whitespace-nowrap active:scale-95"
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
          <Text className="text-text-primary text-sm font-medium">
            {t('coach.actions.createWorkout')}
          </Text>
        </Pressable>
        <Pressable
          onPress={handleGenerateMealPlan}
          className="bg-bg-card flex-row items-center gap-2 rounded-full border px-4 py-2 whitespace-nowrap active:scale-95"
          style={{
            borderColor:
              pendingIntention === GENERATE_MEAL_PLAN
                ? theme.colors.accent.primary
                : theme.colors.border.light,
            borderWidth: pendingIntention === GENERATE_MEAL_PLAN ? 2 : 1,
            backgroundColor:
              pendingIntention === GENERATE_MEAL_PLAN
                ? theme.colors.accent.primary10
                : theme.colors.background.card,
          }}
        >
          <ClipboardList size={theme.iconSize.md} color={theme.colors.status.success} />
          <Text className="text-text-primary text-sm font-medium">
            {t('coach.actions.mealPlan')}
          </Text>
        </Pressable>
        <Pressable
          onPress={handleAnalyzeProgress}
          className="bg-bg-card flex-row items-center gap-2 rounded-full border px-4 py-2 whitespace-nowrap active:scale-95"
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
          <Text className="text-text-primary text-sm font-medium">
            {t('coach.actions.analyzeProgress')}
          </Text>
        </Pressable>
        <Pressable
          onPress={handleTrackMeal}
          className="bg-bg-card flex-row items-center gap-2 rounded-full border px-4 py-2 whitespace-nowrap active:scale-95"
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
          <Text className="text-text-primary text-sm font-medium">
            {t('coach.actions.trackMeal')}
          </Text>
        </Pressable>
        <Pressable
          onPress={handleNutritionCheck}
          className="bg-bg-card flex-row items-center gap-2 rounded-full border px-4 py-2 whitespace-nowrap active:scale-95"
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
          <Text className="text-text-primary text-sm font-medium">
            {t('coach.actions.nutritionCheck')}
          </Text>
        </Pressable>
      </ScrollView>
    );
  }, [
    handleAnalyzeProgress,
    handleGenerateMealPlan,
    handleGenerateWorkouts,
    handleNutritionCheck,
    handleTrackMeal,
    pendingIntention,
    t,
    theme.colors.accent.primary,
    theme.colors.accent.primary10,
    theme.colors.background.card,
    theme.colors.border.light,
    theme.colors.status.info,
    theme.colors.status.success,
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
        handleMessageLongPress,
        handleViewMealDetails,
        isCreditsError ? handleGoToSettings : undefined,
        isCreditsError ? t('coach.goToSettings') : undefined,
        handleSeeAllMeals,
        handleViewMuscles
      ),
    [
      theme,
      conversationContext,
      handleViewWorkoutDetails,
      handleMessageLongPress,
      handleViewMealDetails,
      isCreditsError,
      handleGoToSettings,
      handleSeeAllMeals,
      handleViewMuscles,
      t,
    ]
  );
  const gcRenderAvatar = useCallback(
    (props: Parameters<typeof renderAvatar>[0]) => renderAvatar(props, theme),
    [theme]
  );

  const gcRenderCustomView = useCallback(
    (props: Parameters<typeof renderCustomView>[0]) =>
      renderCustomView(
        props,
        handleViewWorkoutDetails,
        handleViewMealDetails,
        handleSeeAllMeals,
        handleViewMuscles
      ),
    [handleViewWorkoutDetails, handleViewMealDetails, handleSeeAllMeals, handleViewMuscles]
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
        pendingIntention === TRACK_MEAL,
        composerResetKey
      ),
    [
      t,
      theme,
      failedMessageText,
      clearFailedMessageText,
      handleAttachFile,
      pendingIntention,
      composerResetKey,
    ]
  );

  const gcRenderSend = useCallback(
    (props: Parameters<typeof renderSend>[0]) =>
      renderSend(
        props,
        theme,
        failedMessageText,
        !!attachedImage && pendingIntention === TRACK_MEAL,
        isSending
      ),
    [theme, failedMessageText, attachedImage, pendingIntention, isSending]
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
      <View className="bg-bg-primary flex-1">
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
              className="absolute right-0 bottom-0 h-3 w-3 rounded-full border-2"
              style={{
                backgroundColor: isOnline ? theme.colors.accent.primary : theme.colors.status.error,
                borderColor: theme.colors.background.primary,
                borderWidth: theme.borderWidth.medium,
              }}
            />
          </View>
          <View className="flex-1">
            <View className="flex-row flex-wrap items-baseline gap-1.5">
              <Text className="text-text-primary text-lg font-bold">{t('coach.name')}</Text>
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

        {/* AI Disclaimer */}
        <View className="px-4 py-2" style={{ backgroundColor: theme.colors.background.primary }}>
          <Text
            className="text-center text-xs"
            style={{ color: theme.colors.text.tertiary, fontStyle: 'italic' }}
          >
            {t('coach.disclaimer')}
          </Text>
        </View>
      </View>

      <PastWorkoutDetailModal
        visible={!!selectedWorkoutId}
        onClose={() => setSelectedWorkoutId(null)}
        workoutId={selectedWorkoutId || undefined}
      />

      <WorkoutMusclesModal
        visible={isMusclesModalVisible}
        onClose={() => setIsMusclesModalVisible(false)}
        title={musclesWorkoutName || undefined}
        muscleGroups={musclesModalGroups}
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

      <ConfirmationModal
        visible={isDeleteMessageModalVisible}
        onClose={() => {
          setIsDeleteMessageModalVisible(false);
          setMessageToDelete(null);
        }}
        onConfirm={handleConfirmDeleteMessage}
        title={t('coach.message.delete')}
        message={t('coach.message.deleteDesc')}
        confirmLabel={t('common.delete')}
        variant="destructive"
        isLoading={isDeletingMessage}
      />

      {selectedMealForTracking && mealForLogMealModal ? (
        <LogMealModal
          visible
          onClose={() => setSelectedMealForTracking(null)}
          meal={mealForLogMealModal}
          ingredients={selectedMealForTracking.ingredients}
          initialMealType={selectedMealForTracking.mealTypeIdentifier}
          onLogMeal={async (date, logMealType, portionGrams) => {
            await markMealAsTracked(
              selectedMealForTracking.messageId,
              selectedMealForTracking.mealTypeIdentifier,
              selectedMealForTracking.ingredients,
              date,
              logMealType,
              portionGrams,
              selectedMealForTracking.mealName ??
                t(`food.meals.${selectedMealForTracking.mealTypeIdentifier}`)
            );
            setSelectedMealForTracking(null);
          }}
        />
      ) : null}
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
      maxWidth: '100%',
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
      maxWidth: '85%',
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
