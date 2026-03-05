import { LinearGradient } from 'expo-linear-gradient';
import type { TFunction } from 'i18next';
import {
  Mic,
  PlusCircle,
  Send as SendIcon,
  TrendingUp,
  UtensilsCrossed,
} from 'lucide-react-native';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Image,
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

import {
  AI_COACH_AVATAR,
  type ExtendedIMessage,
  useChatMessages,
} from '../../hooks/useChatMessages';
import { useTheme } from '../../hooks/useTheme';
import type { Theme } from '../../theme';
import { ChatWorkoutCard } from '../cards/ChatWorkoutCard';
import { MenuButton } from '../theme/MenuButton';
import { FullScreenModal } from './FullScreenModal';

// Workout image URL (used for future workout card messages)
const WORKOUT_IMAGE_URL =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuC8wdyvHF33Emd_otj2gCXb_-DtuZnk1Yynloi9mvz8s2ZtTJ1fFbg_J8B8x02R5Njk5nPX1SonjXw5sEU1gwylKXq3buzHpa2EoRQfBpA6BTNRGfSjYnqBMRSyDW7tl5DHtCWM5DOUd91Ka2gB8Y-rdvJB99_hQED2ZIqMdcWkgxVdv_pRnWFXwFirvEOSMuCveL2ZxoS3oQpkrQoYXVBSunvPf8QQ6xtQQw-v_r9wOPDB6W6pKw22mPLs0nsdG-MkvUJTj7VCxnSe';

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

const renderCustomView = (props: BubbleProps<ExtendedIMessage>) => {
  const { currentMessage } = props;
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

const renderBubble = (props: BubbleProps<ExtendedIMessage>, theme: Theme) => {
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
        {!!currentMessage?.text ? (
          <View style={styles.aiBubbleContent}>{renderMessageText(props, theme)}</View>
        ) : null}
        {!!currentMessage?.workout ? renderCustomView(props) : null}
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
  return <Image source={{ uri: AI_COACH_AVATAR }} style={styles.avatar} resizeMode="cover" />;
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

const renderSend = (props: SendProps<ExtendedIMessage>, theme: Theme) => {
  const styles = getStyles(theme);

  return (
    <Send {...props} containerStyle={styles.sendContainer}>
      <View
        className="h-12 w-12 items-center justify-center rounded-full active:scale-90"
        style={{ backgroundColor: theme.colors.accent.primary }}
      >
        <SendIcon size={theme.iconSize.lg} color={theme.colors.text.black} />
      </View>
    </Send>
  );
};

const renderComposer = (props: ComposerProps, t: TFunction, theme: Theme) => {
  const styles = getStyles(theme);

  return (
    <View style={styles.composerWrapper}>
      <Composer
        {...props}
        textInputProps={{
          ...props.textInputProps,
          style: [styles.composerTextInput, props.textInputProps?.style],
          placeholder: t('coach.placeholder'),
          placeholderTextColor: theme.colors.text.tertiary,
          multiline: true,
        }}
      />
      <Pressable className="p-2" onPress={() => console.log('Mic pressed')}>
        <Mic size={theme.iconSize.lg} color={theme.colors.text.tertiary} />
      </Pressable>
    </View>
  );
};

const renderInputToolbar = (props: InputToolbarProps<ExtendedIMessage>, theme: Theme) => {
  const styles = getStyles(theme);

  return (
    <InputToolbar
      {...props}
      containerStyle={styles.inputToolbarContainer}
      primaryStyle={styles.inputToolbarPrimary}
    />
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
  const { messages, isSending, isLoadingMore, hasMore, loadMore, sendMessage } = useChatMessages();

  const onSend = useCallback(
    (newMessages: ExtendedIMessage[] = []) => {
      const text = newMessages[0]?.text;
      if (text) {
        sendMessage(text);
      }
    },
    [sendMessage]
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
          className="flex-row items-center gap-2 whitespace-nowrap rounded-full border px-4 py-2 active:scale-95"
          style={{
            backgroundColor: theme.colors.status.indigo10,
            borderColor: theme.colors.accent.primary30,
          }}
        >
          <PlusCircle size={theme.iconSize.md} color={theme.colors.accent.primary} />
          <Text className="text-sm font-medium" style={{ color: theme.colors.accent.primary }}>
            {t('coach.actions.createWorkout')}
          </Text>
        </Pressable>
        <Pressable
          className="flex-row items-center gap-2 whitespace-nowrap rounded-full border bg-bg-card px-4 py-2 active:scale-95"
          style={{ borderColor: theme.colors.border.light }}
        >
          <TrendingUp size={theme.iconSize.md} color={theme.colors.status.info} />
          <Text className="text-sm font-medium text-text-primary">
            {t('coach.actions.analyzeProgress')}
          </Text>
        </Pressable>
        <Pressable
          className="flex-row items-center gap-2 whitespace-nowrap rounded-full border bg-bg-card px-4 py-2 active:scale-95"
          style={{ borderColor: theme.colors.border.light }}
        >
          <UtensilsCrossed size={theme.iconSize.md} color={theme.colors.status.warning} />
          <Text className="text-sm font-medium text-text-primary">
            {t('coach.actions.nutritionCheck')}
          </Text>
        </Pressable>
      </ScrollView>
    );
  }, [
    t,
    theme.colors.accent.primary,
    theme.colors.accent.primary30,
    theme.colors.border.light,
    theme.colors.status.indigo10,
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
              source={{ uri: AI_COACH_AVATAR }}
              className="h-10 w-10 rounded-full"
              style={{
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
            <Text className="text-lg font-bold text-text-primary">{t('coach.title')}</Text>
            <View className="flex-row items-center gap-1">
              <View
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: theme.colors.accent.primary }}
              />
              <Text className="text-xs font-medium" style={{ color: theme.colors.accent.primary }}>
                {t('coach.status')}
              </Text>
            </View>
          </View>
        </View>

        <View className="flex-1">
          <GiftedChat
            messages={messages}
            onSend={onSend}
            user={{ _id: 1 }}
            isTyping={isSending}
            renderBubble={(props) => renderBubble(props, theme)}
            renderAvatar={(props) => renderAvatar(props, theme)}
            renderCustomView={renderCustomView}
            renderInputToolbar={(props) => renderInputToolbar(props, theme)}
            renderComposer={(props) => renderComposer(props, t, theme)}
            renderSend={(props) => renderSend(props, theme)}
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
