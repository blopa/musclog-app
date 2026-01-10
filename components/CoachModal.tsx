import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { View, Text, Image, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  GiftedChat,
  IMessage,
  BubbleProps,
  Send,
  Composer,
  InputToolbar,
  SendProps,
  ComposerProps,
  InputToolbarProps,
} from 'react-native-gifted-chat';
import { LinearGradient } from 'expo-linear-gradient';
import {
  MoreVertical,
  Mic,
  Send as SendIcon,
  PlusCircle,
  TrendingUp,
  UtensilsCrossed,
} from 'lucide-react-native';
import { theme } from '../theme';
import { FullScreenModal } from './FullScreenModal';
import { ChatWorkoutCard } from './ChatWorkoutCard';

// AI Coach avatar URL
const AI_COACH_AVATAR =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuAXxrp6riIDnXZkR98-jJEX8IIqKuGBbD6Nlxrt4t8oifz8KgM3q3VjFPKYVzNwfFBEbdvjEkEU1a8oYivCY0oJHBD1HEi-Pjg0638r8tULKurmfvFPaF6OSNcWQvlzhK3coc8DccgtARUtSOOmqSOoHEQM8JQIOwBYvElVbb2XsURsvRMicbylHk1qeA98fvyZhS3mwy_S67AKXjSWGEGJ5IJBSZNpAQRfaMWXjKg6b5xV_xg0ScM8K_urNvzJV1Pa5ATJZO9yDjw7';

// Workout image URL
const WORKOUT_IMAGE_URL =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuC8wdyvHF33Emd_otj2gCXb_-DtuZnk1Yynloi9mvz8s2ZtTJ1fFbg_J8B8x02R5Njk5nPX1SonjXw5sEU1gwylKXq3buzHpa2EoRQfBpA6BTNRGfSjYnqBMRSyDW7tl5DHtCWM5DOUd91Ka2gB8Y-rdvJB99_hQED2ZIqMdcWkgxVdv_pRnWFXwFirvEOSMuCveL2ZxoS3oQpkrQoYXVBSunvPf8QQ6xtQQw-v_r9wOPDB6W6pKw22mPLs0nsdG-MkvUJTj7VCxnSe';

// Extend IMessage to include workout data
interface ExtendedIMessage extends IMessage {
  workout?: {
    title: string;
    duration: string;
    level: string;
    exerciseCount: number;
    calories: number;
  };
}

// Mock initial messages
const getInitialMessages = (): ExtendedIMessage[] => {
  const now = new Date();
  const today9_41 = new Date(now);
  today9_41.setHours(9, 41, 0, 0);
  const today9_42 = new Date(now);
  today9_42.setHours(9, 42, 0, 0);

  return [
    {
      _id: 8,
      text: 'Got it. Here is a high-intensity leg workout based on your previous logs. Get ready to sweat! 🔥',
      createdAt: today9_42.getTime(),
      user: {
        _id: 2,
        name: 'Musclog Trainer',
        avatar: AI_COACH_AVATAR,
      },
    },
    {
      _id: 7,
      text: 'Got it. Here is a high-intensity leg workout based on your previous logs. Get ready to sweat! 🔥',
      createdAt: today9_42.getTime(),
      user: {
        _id: 2,
        name: 'Musclog Trainer',
        avatar: AI_COACH_AVATAR,
      },
    },
    {
      _id: 6,
      text: 'Got it. Here is a high-intensity leg workout based on your previous logs. Get ready to sweat! 🔥',
      createdAt: today9_42.getTime(),
      user: {
        _id: 2,
        name: 'Musclog Trainer',
        avatar: AI_COACH_AVATAR,
      },
    },
    {
      _id: 5,
      text: 'Got it. Here is a high-intensity leg workout based on your previous logs. Get ready to sweat! 🔥',
      createdAt: today9_42.getTime(),
      user: {
        _id: 2,
        name: 'Musclog Trainer',
        avatar: AI_COACH_AVATAR,
      },
    },
    {
      _id: 4,
      text: '',
      createdAt: today9_42.getTime(),
      user: {
        _id: 2,
        name: 'AI Coach',
        avatar: AI_COACH_AVATAR,
      },
      workout: {
        title: 'Leg Day Intensity',
        duration: '45 mins',
        level: 'Advanced',
        exerciseCount: 6,
        calories: 420,
      },
    },
    {
      _id: 3,
      text: 'Got it. Here is a high-intensity leg workout based on your previous logs. Get ready to sweat! 🔥',
      createdAt: today9_42.getTime(),
      user: {
        _id: 2,
        name: 'Musclog Trainer',
        avatar: AI_COACH_AVATAR,
      },
    },
    {
      _id: 2,
      text: 'I want to focus on legs today. Can you make it intense?',
      createdAt: today9_42.getTime(),
      user: {
        _id: 1,
      },
    },
    {
      _id: 1,
      text: "Hello! I'm ready to help. Should we plan your next session or look at your stats?",
      createdAt: today9_41.getTime(),
      user: {
        _id: 2,
        name: 'Musclog Trainer',
        avatar: AI_COACH_AVATAR,
      },
    },
  ];
};

// --- Custom Render Functions (Defined Outside for Stability) ---

const renderMessageText = (props: any) => {
  return (
    <Text
      style={{
        fontSize: 15,
        lineHeight: 22,
        color:
          props.currentMessage?.user._id === 1
            ? theme.colors.text.black
            : theme.colors.text.primary,
      }}>
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

const renderBubble = (props: BubbleProps<ExtendedIMessage>) => {
  const { currentMessage, user } = props;
  const isUser = user && currentMessage?.user._id === user._id;

  if (isUser) {
    return (
      <View style={styles.userBubbleContainer}>
        {!!currentMessage?.text && (
          <LinearGradient
            colors={[theme.colors.accent.primary, '#1aa869']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.userBubbleGradient}>
            {renderMessageText(props)}
          </LinearGradient>
        )}
        {!!currentMessage?.workout && renderCustomView(props)}
        {!!currentMessage?.createdAt && (
          <Text
            className="mr-1 mt-1 text-right text-xs"
            style={{ color: theme.colors.text.tertiary }}>
            {new Date(currentMessage.createdAt).toLocaleTimeString('en-US', {
              hour: 'numeric',
              minute: '2-digit',
            })}
          </Text>
        )}
      </View>
    );
  } else {
    return (
      <View style={styles.aiBubbleContainer}>
        {!!currentMessage?.user.name && (
          <Text className="mb-1 ml-1 text-xs" style={{ color: theme.colors.text.secondary }}>
            {currentMessage.user.name}
          </Text>
        )}
        {!!currentMessage?.text && (
          <View style={styles.aiBubbleContent}>{renderMessageText(props)}</View>
        )}
        {!!currentMessage?.workout && renderCustomView(props)}
      </View>
    );
  }
};

const renderAvatar = (props: any) => {
  if (props.currentMessage?.user._id === 1) return null;
  if (!props.currentMessage?.text && props.currentMessage?.workout) {
    return <View style={{ width: 32 }} />;
  }
  return <Image source={{ uri: AI_COACH_AVATAR }} style={styles.avatar} resizeMode="cover" />;
};

const renderDay = (props: any, t: any) => {
  if (!props.currentMessage?.createdAt) return null;
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

const renderSend = (props: SendProps<ExtendedIMessage>) => {
  return (
    <Send {...props} containerStyle={styles.sendContainer}>
      <View
        className="h-12 w-12 items-center justify-center rounded-full active:scale-90"
        style={{ backgroundColor: theme.colors.accent.primary }}>
        <SendIcon size={20} color={theme.colors.text.black} />
      </View>
    </Send>
  );
};

const renderComposer = (props: ComposerProps, t: any) => {
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
        <Mic size={20} color={theme.colors.text.tertiary} />
      </Pressable>
    </View>
  );
};

const renderInputToolbar = (props: InputToolbarProps<ExtendedIMessage>) => {
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
  const { t } = useTranslation();
  const [messages, setMessages] = useState<ExtendedIMessage[]>([]);

  useEffect(() => {
    if (visible) {
      setMessages(getInitialMessages());
    }
  }, [visible, t]);

  const onSend = useCallback((newMessages: ExtendedIMessage[] = []) => {
    setMessages((previousMessages) => GiftedChat.append(previousMessages, newMessages));
  }, []);

  const renderAccessory = useCallback(() => {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="px-4 py-3"
        contentContainerStyle={{ gap: 8 }}>
        <Pressable
          className="flex-row items-center gap-2 whitespace-nowrap rounded-full border px-4 py-2 active:scale-95"
          style={{
            backgroundColor: 'rgba(99, 102, 241, 0.2)',
            borderColor: 'rgba(34, 197, 94, 0.3)',
          }}>
          <PlusCircle size={18} color={theme.colors.accent.primary} />
          <Text className="text-sm font-medium" style={{ color: theme.colors.accent.primary }}>
            {t('coach.actions.createWorkout')}
          </Text>
        </Pressable>
        <Pressable
          className="flex-row items-center gap-2 whitespace-nowrap rounded-full border bg-bg-card px-4 py-2 active:scale-95"
          style={{ borderColor: theme.colors.border.light }}>
          <TrendingUp size={18} color={theme.colors.status.info} />
          <Text className="text-sm font-medium text-text-primary">
            {t('coach.actions.analyzeProgress')}
          </Text>
        </Pressable>
        <Pressable
          className="flex-row items-center gap-2 whitespace-nowrap rounded-full border bg-bg-card px-4 py-2 active:scale-95"
          style={{ borderColor: theme.colors.border.light }}>
          <UtensilsCrossed size={18} color={theme.colors.status.warning} />
          <Text className="text-sm font-medium text-text-primary">
            {t('coach.actions.nutritionCheck')}
          </Text>
        </Pressable>
      </ScrollView>
    );
  }, [t]);

  const headerRight = useMemo(
    () => (
      <Pressable className="h-10 w-10 items-center justify-center rounded-full active:bg-white/5">
        <MoreVertical size={20} color={theme.colors.text.secondary} />
      </Pressable>
    ),
    []
  );

  return (
    <FullScreenModal
      visible={visible}
      onClose={onClose}
      title={t('coach.title')}
      headerRight={headerRight}
      scrollable={false}>
      <View className="flex-1 bg-bg-primary">
        <View
          className="flex-row items-center gap-3 border-b px-4 py-3"
          style={{ borderColor: theme.colors.border.light }}>
          <View className="relative">
            <Image
              source={{ uri: AI_COACH_AVATAR }}
              className="h-10 w-10 rounded-full"
              style={{ borderWidth: 2, borderColor: `${theme.colors.accent.primary}33` }}
              resizeMode="cover"
            />
            <View
              className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2"
              style={{
                backgroundColor: theme.colors.accent.primary,
                borderColor: theme.colors.background.primary,
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
            renderBubble={renderBubble}
            renderAvatar={renderAvatar}
            renderCustomView={renderCustomView}
            renderInputToolbar={renderInputToolbar}
            renderComposer={(props) => renderComposer(props, t)}
            renderSend={renderSend}
            renderAccessory={renderAccessory}
            renderDay={(props) => renderDay(props, t)}
            scrollToBottomComponent={() => null}
            minInputToolbarHeight={0}
            listProps={{
              contentContainerStyle: { paddingBottom: 16, paddingHorizontal: 16 },
            }}
          />
        </View>
      </View>
    </FullScreenModal>
  );
}

const styles = StyleSheet.create({
  userBubbleContainer: {
    maxWidth: '85%',
    marginRight: 0,
    marginLeft: 'auto',
    alignItems: 'flex-end',
  },
  userBubbleGradient: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    borderBottomRightRadius: 4,
  },
  aiBubbleContainer: {
    maxWidth: '85%',
    marginLeft: 0,
    marginRight: 'auto',
    alignItems: 'flex-start',
  },
  aiBubbleContent: {
    backgroundColor: theme.colors.background.cardElevated,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    borderBottomLeftRadius: 4,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 4,
  },
  sendContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'flex-end',
    marginLeft: 8,
  },
  composerWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.border.light,
    backgroundColor: theme.colors.background.card,
    paddingLeft: 4,
  },
  composerTextInput: {
    fontSize: 16,
    color: theme.colors.text.primary,
    marginTop: 8,
    marginBottom: 8,
  },
  inputToolbarContainer: {
    backgroundColor: 'transparent',
    borderTopWidth: 0,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  inputToolbarPrimary: {
    alignItems: 'flex-end',
  },
});
