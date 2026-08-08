import NetInfo from '@react-native-community/netinfo';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import type { TFunction } from 'i18next';
import {
  Copy,
  Dumbbell,
  Images,
  Paperclip,
  Send as SendIcon,
  Share2,
  SlidersHorizontal,
  Trash2,
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
import { COACH_INTENTIONS } from '@/components/coach/coachIntentions';
import { MenuButton } from '@/components/theme/MenuButton';
import { SegmentedControl } from '@/components/theme/SegmentedControl';
import { CHAT_INTENTIONS, type ChatIntention, TRACK_MEAL } from '@/constants/chat';
import { useSnackbar } from '@/context/SnackbarContext';
import { useUnreadChat } from '@/context/UnreadChatContext';
import { ChatService, MuscleService, WorkoutService } from '@/database/services';
import { AI_COACH_AVATAR, type ExtendedIMessage, useChatMessages } from '@/hooks/useChatMessages';
import { useDebouncedSettings } from '@/hooks/useDebouncedSettings';
import { useKeepScreenAwake } from '@/hooks/useKeepScreenAwake';
import { useNativeShareText } from '@/hooks/useNativeShareText';
import { useTheme } from '@/hooks/useTheme';
import type { Theme } from '@/theme';
import { formatTimeInTimezone } from '@/utils/calendarDate';
import { type TrackMealIngredient } from '@/utils/coachAI';
import { FALLBACK_EXERCISE_IMAGE } from '@/utils/exerciseImage';
import { createThumbnail } from '@/utils/file';
import { flushLoadingPaint } from '@/utils/flushLoadingPaint';
import { pickAndCropImageFromGallery } from '@/utils/galleryImagePicker';
import { handleError } from '@/utils/handleError';

import { CoachQuickSettingsModal } from './CoachQuickSettingsModal';
import { ConfirmationModal } from './ConfirmationModal';
import { FullScreenModal } from './FullScreenModal';
import { LogMealModal } from './LogMealModal';
import PastWorkoutDetailModal from './PastWorkoutDetailModal';
import { WorkoutMusclesModal } from './WorkoutMusclesModal';

const getPendingIntentionDisplayText = (pendingIntention: ChatIntention, t: TFunction): string =>
  t(COACH_INTENTIONS[pendingIntention].bannerLabelKey);

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
  onViewMealDetails?: (meal: ExtendedIMessage['meal'], mealIndex: number) => void,
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
          onViewDetails={(mealIndex) => onViewMealDetails?.(currentMessage.meal!, mealIndex)}
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
  locale: string,
  onViewWorkoutDetails?: (workoutLogId: string) => void,
  onLongPress?: (message: ExtendedIMessage) => void,
  onViewMealDetails?: (meal: ExtendedIMessage['meal'], mealIndex: number) => void,
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
            className="mr-1 mt-1 text-right text-xs"
            style={{ color: theme.colors.text.tertiary }}
          >
            {formatTimeInTimezone(new Date(currentMessage.createdAt).getTime(), undefined, locale)}
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

const renderDay = (props: any, t: TFunction, theme: Theme, locale: string) => {
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
              time: formatTimeInTimezone(date.getTime(), undefined, locale),
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
  composerSeedText: string | null,
  hasAttachedImage: boolean,
  isSending: boolean
) => {
  const styles = getStyles(theme);
  // The seed (restored failed text, or a caller's prefill) may not be in GiftedChat's state yet;
  // pass it so the Send button is enabled without the user typing a character first.
  const effectiveText = (composerSeedText ?? props.text ?? '').trim();
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

/**
 * Wrapper that seeds GiftedChat's composer with text the user did not type. Two sources share this
 * path: the restored text of a send that failed, and a prefill from whoever opened the coach
 * (a note's "Track this"). Either way the seed is synced into GiftedChat's internal state so Send
 * works without a keystroke, and it is cleared the moment the user edits.
 */
function SeededComposer({
  props,
  t,
  theme,
  seedText,
  clearSeedText,
  onAttachFile,
  isImageAttachmentEnabled,
  resetKey,
}: {
  props: ComposerProps;
  t: TFunction;
  theme: Theme;
  seedText: string | null;
  clearSeedText: () => void;
  onAttachFile: () => void;
  isImageAttachmentEnabled: boolean;
  resetKey: number;
}) {
  const styles = getStyles(theme);
  const propsWithText = props as ComposerPropsWithText;

  // Sync the seed into GiftedChat's internal state so Send uses it
  useEffect(() => {
    if (seedText != null && propsWithText.onTextChanged) {
      propsWithText.onTextChanged(seedText);
    }
    // Intentionally not including props to run only when seedText is set
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seedText]);

  const text = seedText !== null ? seedText : propsWithText.text;
  const onTextChanged = (newText: string) => {
    if (seedText !== null) {
      clearSeedText();
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
  seedText: string | null,
  clearSeedText: () => void,
  onAttachFile: () => void,
  isImageAttachmentEnabled: boolean,
  resetKey: number
) => (
  <SeededComposer
    props={props}
    t={t}
    theme={theme}
    seedText={seedText}
    clearSeedText={clearSeedText}
    onAttachFile={onAttachFile}
    isImageAttachmentEnabled={isImageAttachmentEnabled}
    resetKey={resetKey}
  />
);

const renderInputToolbar = (
  props: InputToolbarProps<ExtendedIMessage>,
  theme: Theme,
  pendingIntention: ChatIntention | null,
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
  /** Invoked after the coach closes when the user opens “My meals” from a meal plan (e.g. carousel). */
  onOpenMyMeals: () => void;
  /** Seeds the composer without sending (e.g. “Track this” from a note). */
  initialComposerText?: string;
  /** Intention to arm when the coach opens. Any member of the union works. */
  initialIntention?: ChatIntention;
};

export function CoachModal({
  visible,
  onClose,
  onOpenMyMeals,
  initialComposerText,
  initialIntention,
}: CoachModalProps) {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const { conversationContext, handleConversationContextChange } = useDebouncedSettings();
  const {
    messages,
    pendingCoachMessage,
    pendingIntention,
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
    setIntention,
    clearIntention,
    showConfetti,
  } = useChatMessages(conversationContext, initialIntention);

  const { clearUnreadCount } = useUnreadChat();
  const { showSnackbar } = useSnackbar();
  const { shareText } = useNativeShareText();
  const [isOnline, setIsOnline] = useState(false);
  const [prefillText, setPrefillText] = useState<null | string>(initialComposerText ?? null);
  const [selectedWorkoutId, setSelectedWorkoutId] = useState<string | null>(null);
  const [isMusclesModalVisible, setIsMusclesModalVisible] = useState(false);
  const [musclesModalGroups, setMusclesModalGroups] = useState<string[]>([]);
  const [musclesWorkoutName, setMusclesWorkoutName] = useState('');
  const [selectedMealForTracking, setSelectedMealForTracking] = useState<{
    messageId: string;
    mealIndex: number;
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
  const [isQuickSettingsVisible, setIsQuickSettingsVisible] = useState(false);
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
      const clearImage = () => {
        setAttachedImage(null);
      };
      clearImage();
    }
  }, [pendingIntention, attachedImage]);

  useKeepScreenAwake('coach-chat-sending', visible && isSending);

  useEffect(() => {
    if (!visible) {
      const reset = () => {
        setSelectedWorkoutId(null);
        setIsMusclesModalVisible(false);
        setMusclesModalGroups([]);
        setIsMenuVisible(false);
        setIsQuickSettingsVisible(false);
        setSelectedMessage(null);
        setIsClearHistoryModalVisible(false);
        setIsDeleteMessageModalVisible(false);
        setMessageToDelete(null);
      };
      reset();
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
        // sendMessage clears the hook's failedMessageText but not our local seed, so the
        // composer would repopulate with the prefill right after sending.
        setPrefillText(null);
        sendMessage(text ?? '', image);
        setAttachedImage(null);
        setComposerResetKey((k) => k + 1);
      }
    },
    [sendMessage, attachedImage]
  );

  /** Shows the intention's prompt as a parked coach message above the composer. */
  const parkIntentionPrompt = useCallback(
    (intention: ChatIntention) => {
      const { idPrefix, promptKey } = COACH_INTENTIONS[intention];

      addPendingCoachMessage({
        _id: `${idPrefix}-${Date.now()}`,
        text: t(promptKey),
        createdAt: new Date(),
        user: { _id: 2, name: 'Loggy', avatar: AI_COACH_AVATAR },
      });
    },
    [addPendingCoachMessage, t]
  );

  // Arm and disarm are separate primitives on purpose: the chips want the toggle, while an
  // externally requested intention (a note's "Track this") wants a plain arm — folding the two
  // into one toggling handler is what previously forced callers to copy the arming block.
  // Persistence is `useChatMessages`' job (`setIntention`/`clearIntention`); this only adds the
  // chat-visible half.
  const armIntention = useCallback(
    async (intention: ChatIntention) => {
      await setIntention(intention);
      parkIntentionPrompt(intention);
    },
    [setIntention, parkIntentionPrompt]
  );

  const disarmIntention = useCallback(async () => {
    await clearIntention();
    clearPendingCoachMessage();
  }, [clearIntention, clearPendingCoachMessage]);

  const toggleIntention = useCallback(
    (intention: ChatIntention) =>
      pendingIntention === intention ? disarmIntention() : armIntention(intention),
    [armIntention, disarmIntention, pendingIntention]
  );

  // `useChatMessages` arms `initialIntention` itself as it loads (it owns CHAT_INTENTION_KEY, and
  // a second writer here would race its read), so a caller-requested intention arrives as state
  // rather than through `armIntention`. Only its prompt is left to park — pure UI, no storage, so
  // there is no ordering to get wrong. `initialIntention` is a fixed prop and `parkIntentionPrompt`
  // is stable, so this runs exactly once per open.
  useEffect(() => {
    if (initialIntention) {
      parkIntentionPrompt(initialIntention);
    }
  }, [initialIntention, parkIntentionPrompt]);

  // The composer seed and the hook's failed-send restore share one render path.
  const composerSeedText = failedMessageText ?? prefillText;
  const clearComposerSeed = useCallback(() => {
    clearFailedMessageText();
    setPrefillText(null);
  }, [clearFailedMessageText]);

  const handleClearIntention = useCallback(async () => {
    await disarmIntention();
    setAttachedImage(null);
  }, [disarmIntention]);

  const handleAttachFile = useCallback(async () => {
    try {
      const croppedPath = await pickAndCropImageFromGallery();
      if (!croppedPath) {
        return;
      }

      // Create a thumbnail for efficient chat preview (max 300px)
      const { uri, base64 } = await createThumbnail(croppedPath, 300);

      setAttachedImage({
        uri,
        base64: base64 || '',
      });
    } catch (error) {
      console.error('Error picking image:', error);
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

  const handleViewMealDetails = useCallback((meal: ExtendedIMessage['meal'], mealIndex: number) => {
    if (!meal) {
      return;
    }

    const entry = meal.meals[mealIndex];
    if (!entry) {
      return;
    }

    setSelectedMealForTracking({
      messageId: meal.messageId,
      mealIndex,
      mealTypeIdentifier: entry.mealType,
      mealName: entry.mealName,
      calories: entry.calories,
      protein: entry.protein,
      carbs: entry.carbs,
      fats: entry.fats,
      ingredients: entry.ingredients,
    });
  }, []);

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

  const handleQuickSettingsPress = useCallback(() => {
    setIsMenuVisible(false);
    setIsQuickSettingsVisible(true);
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
        icon: SlidersHorizontal,
        iconColor: theme.colors.accent.primary,
        iconBgColor: theme.colors.accent.primary10,
        title: t('coach.menu.quickSettings'),
        description: t('coach.menu.quickSettingsDesc'),
        onPress: handleQuickSettingsPress,
      },
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
      handleQuickSettingsPress,
      handleShareHistory,
      t,
      theme.colors.accent.primary,
      theme.colors.accent.primary10,
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
        {CHAT_INTENTIONS.map((intention) => {
          const { icon: Icon, iconColor, labelKey } = COACH_INTENTIONS[intention];
          const isArmed = pendingIntention === intention;

          return (
            <Pressable
              key={intention}
              onPress={() => void toggleIntention(intention)}
              className="flex-row items-center gap-2 whitespace-nowrap rounded-full border bg-bg-card px-4 py-2 active:scale-95"
              style={{
                borderColor: isArmed ? theme.colors.accent.primary : theme.colors.border.light,
                borderWidth: isArmed ? 2 : 1,
                backgroundColor: isArmed
                  ? theme.colors.accent.primary10
                  : theme.colors.background.card,
              }}
            >
              <Icon size={theme.iconSize.md} color={iconColor(theme)} />
              <Text className="text-sm font-medium text-text-primary">{t(labelKey)}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    );
  }, [pendingIntention, t, theme, toggleIntention]);

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
        locale,
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
      locale,
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
        composerSeedText,
        clearComposerSeed,
        handleAttachFile,
        pendingIntention === TRACK_MEAL,
        composerResetKey
      ),
    [
      t,
      theme,
      composerSeedText,
      clearComposerSeed,
      handleAttachFile,
      pendingIntention,
      composerResetKey,
    ]
  );

  // composerSeedText must reach renderSend too: it computes the enabled state from that value,
  // so seeding only the composer would leave Send disabled until the user typed a character.
  const gcRenderSend = useCallback(
    (props: Parameters<typeof renderSend>[0]) =>
      renderSend(
        props,
        theme,
        composerSeedText,
        !!attachedImage && pendingIntention === TRACK_MEAL,
        isSending
      ),
    [theme, composerSeedText, attachedImage, pendingIntention, isSending]
  );

  const gcRenderDay = useCallback(
    (props: Parameters<typeof renderDay>[0]) => renderDay(props, t, theme, locale),
    [t, theme, locale]
  );

  const gcRenderMessageImage = useCallback(
    (props: any) => <MessageImage props={props} theme={theme} />,
    [theme]
  );

  // TODO: implement using this
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
      showConfetti={showConfetti}
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

      <CoachQuickSettingsModal
        visible={isQuickSettingsVisible}
        onClose={() => setIsQuickSettingsVisible(false)}
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
          key={`log-meal-${selectedMealForTracking.messageId}-${selectedMealForTracking.mealIndex}`}
          visible
          onClose={() => setSelectedMealForTracking(null)}
          meal={mealForLogMealModal}
          ingredients={selectedMealForTracking.ingredients}
          initialMealType={selectedMealForTracking.mealTypeIdentifier}
          onLogMeal={async (date, logMealType, portionGrams) => {
            await markMealAsTracked(
              selectedMealForTracking.messageId,
              selectedMealForTracking.mealIndex,
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
