import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, Image, Pressable, ScrollView, TextInput } from 'react-native';
import {
  GiftedChat,
  IMessage,
  BubbleProps,
  InputToolbarProps,
  RenderMessageTextProps,
  ComposerProps,
} from 'react-native-gifted-chat';
import { LinearGradient } from 'expo-linear-gradient';
import {
  MoreVertical,
  Mic,
  Send,
  PlusCircle,
  TrendingUp,
  UtensilsCrossed,
} from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../theme';
import { FullScreenModal } from './FullScreenModal';
import { ChatWorkoutCard } from './ChatWorkoutCard';

// AI Coach avatar URL from the HTML
const AI_COACH_AVATAR =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuAXxrp6riIDnXZkR98-jJEX8IIqKuGBbD6Nlxrt4t8oifz8KgM3q3VjFPKYVzNwfFBEbdvjEkEU1a8oYivCY0oJHBD1HEi-Pjg0638r8tULKurmfvFPaF6OSNcWQvlzhK3coc8DccgtARUtSOOmqSOoHEQM8JQIOwBYvElVbb2XsURsvRMicbylHk1qeA98fvyZhS3mwy_S67AKXjSWGEGJ5IJBSZNpAQRfaMWXjKg6b5xV_xg0ScM8K_urNvzJV1Pa5ATJZO9yDjw7';

// Workout image URL from the HTML
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

type CoachModalProps = {
  visible: boolean;
  onClose: () => void;
};

export function CoachModal({ visible, onClose }: CoachModalProps) {
  const [messages, setMessages] = useState<ExtendedIMessage[]>([]);

  useEffect(() => {
    if (visible) {
      setMessages(getInitialMessages());
    }
  }, [visible]);

  // Custom render for message bubbles
  const renderBubble = (props: BubbleProps<ExtendedIMessage>) => {
    const { currentMessage, user } = props;
    const isUser = currentMessage?.user._id === user._id;

    if (isUser) {
      // User message - gradient green bubble
      return (
        <View
          style={{
            maxWidth: '85%',
            marginRight: 0,
            marginLeft: 'auto',
            alignItems: 'flex-end',
          }}>
          {currentMessage?.text && (
            <LinearGradient
              colors={[theme.colors.accent.primary, '#1aa869']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                paddingHorizontal: 16,
                paddingVertical: 12,
                borderRadius: 20,
                borderBottomRightRadius: 4,
              }}>
              {props.renderMessageText && props.renderMessageText(props as any)}
            </LinearGradient>
          )}
          {currentMessage?.workout && props.renderCustomView && props.renderCustomView(props)}
          {currentMessage?.createdAt && (
            <Text
              className="mr-1 mt-1 text-right text-xs"
              style={{ color: theme.colors.text.tertiary }}>
              Read{' '}
              {new Date(currentMessage.createdAt).toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
              })}
            </Text>
          )}
        </View>
      );
    } else {
      // AI message - dark card bubble
      return (
        <View
          style={{
            maxWidth: '85%',
            marginLeft: 0,
            marginRight: 'auto',
            alignItems: 'flex-start',
          }}>
          {currentMessage?.user.name && (
            <Text className="mb-1 ml-1 text-xs" style={{ color: theme.colors.text.secondary }}>
              {currentMessage.user.name}
            </Text>
          )}
          {currentMessage?.text && (
            <View
              style={{
                backgroundColor: theme.colors.background.cardElevated,
                paddingHorizontal: 16,
                paddingVertical: 12,
                borderRadius: 20,
                borderBottomLeftRadius: 4,
              }}>
              {props.renderMessageText && props.renderMessageText(props as any)}
            </View>
          )}
          {currentMessage?.workout && props.renderCustomView && props.renderCustomView(props)}
        </View>
      );
    }
  };

  // Custom render for message text
  const renderMessageText = (props: RenderMessageTextProps<ExtendedIMessage>) => {
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

  // Custom render for avatar
  const renderAvatar = (props: any) => {
    if (props.currentMessage?.user._id === 1) {
      // Don't show avatar for user messages
      return null;
    }
    if (!props.currentMessage?.text && props.currentMessage?.workout) {
      // Don't show avatar for workout cards (they're standalone)
      return <View style={{ width: 32 }} />;
    }
    return (
      <Image
        source={{ uri: AI_COACH_AVATAR }}
        style={{
          width: 32,
          height: 32,
          borderRadius: 16,
          marginRight: 8,
          marginBottom: 4,
        }}
        resizeMode="cover"
      />
    );
  };

  // Custom render for custom views (workout cards)
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

  // Custom composer
  const renderComposer = (props: ComposerProps) => {
    return (
      <TextInput
        {...props.textInputProps}
        value={props.text}
        onChangeText={props.onTextChanged}
        placeholder={props.placeholder}
        placeholderTextColor={theme.colors.text.tertiary}
        style={[
          {
            fontSize: 16,
            color: theme.colors.text.primary,
            paddingVertical: 0,
            paddingHorizontal: 0,
            margin: 0,
            flex: 1,
          },
          props.textInputProps?.style,
        ]}
        multiline
      />
    );
  };

  // Custom input toolbar
  const renderInputToolbar = (props: InputToolbarProps<ExtendedIMessage>) => {
    return (
      <View
        className="border-t bg-bg-primary px-4 pb-4 pt-1"
        style={{ borderColor: theme.colors.border.light }}>
        <View className="mb-2 flex-row items-end gap-2">
          <View
            className="flex-1 flex-row items-center rounded-2xl border bg-bg-card pl-4"
            style={{ borderColor: theme.colors.border.light }}>
            <View className="flex-1 py-2.5">{renderComposer(props)}</View>
            <Pressable className="p-2" onPress={() => console.log('Mic pressed')}>
              <Mic size={20} color={theme.colors.text.tertiary} />
            </Pressable>
          </View>
          <Pressable
            className="h-12 w-12 items-center justify-center rounded-full active:scale-90"
            style={{ backgroundColor: theme.colors.accent.primary }}
            onPress={() => {
              if (props.text && props.text.trim() && props.onSend) {
                props.onSend([{ text: props.text.trim(), user: { _id: 1 } }], true);
              }
            }}>
            <Send size={20} color={theme.colors.text.black} />
          </Pressable>
        </View>
      </View>
    );
  };

  // Custom accessory (quick actions)
  const renderAccessory = () => {
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
            Create Workout
          </Text>
        </Pressable>
        <Pressable
          className="flex-row items-center gap-2 whitespace-nowrap rounded-full border bg-bg-card px-4 py-2 active:scale-95"
          style={{ borderColor: theme.colors.border.light }}>
          <TrendingUp size={18} color={theme.colors.status.info} />
          <Text className="text-sm font-medium text-text-primary">Analyze Progress</Text>
        </Pressable>
        <Pressable
          className="flex-row items-center gap-2 whitespace-nowrap rounded-full border bg-bg-card px-4 py-2 active:scale-95"
          style={{ borderColor: theme.colors.border.light }}>
          <UtensilsCrossed size={18} color={theme.colors.status.warning} />
          <Text className="text-sm font-medium text-text-primary">Nutrition Check</Text>
        </Pressable>
      </ScrollView>
    );
  };

  const onSend = useCallback((newMessages: ExtendedIMessage[] = []) => {
    setMessages((previousMessages) => GiftedChat.append(previousMessages, newMessages));
  }, []);

  // Custom render for day separators
  const renderDay = (props: any) => {
    if (!props.currentMessage?.createdAt) return null;
    const date = new Date(props.currentMessage.createdAt);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    if (isToday) {
      return (
        <View className="my-6 items-center">
          <View className="rounded-full bg-bg-card px-3 py-1">
            <Text className="text-xs font-medium" style={{ color: theme.colors.text.tertiary }}>
              Today, {date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
            </Text>
          </View>
        </View>
      );
    }
    return null;
  };

  // Custom header right component
  const headerRight = (
    <Pressable className="h-10 w-10 items-center justify-center rounded-full active:bg-white/5">
      <MoreVertical size={20} color={theme.colors.text.secondary} />
    </Pressable>
  );

  return (
    <FullScreenModal
      visible={visible}
      onClose={onClose}
      title="AI Coach"
      headerRight={headerRight}
      scrollable={false}>
      <View className="flex-1 bg-bg-primary">
        {/* Custom Header with Avatar - positioned right after modal header */}
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
            <Text className="text-lg font-bold text-text-primary">AI Coach</Text>
            <View className="flex-row items-center gap-1">
              <View
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: theme.colors.accent.primary }}
              />
              <Text className="text-xs font-medium" style={{ color: theme.colors.accent.primary }}>
                Online
              </Text>
            </View>
          </View>
        </View>

        {/* GiftedChat */}
        <View className="flex-1">
          <GiftedChat
            messages={messages}
            onSend={onSend}
            user={{
              _id: 1,
            }}
            renderBubble={renderBubble}
            renderMessageText={renderMessageText}
            renderAvatar={renderAvatar}
            renderCustomView={renderCustomView}
            renderInputToolbar={renderInputToolbar}
            renderAccessory={renderAccessory}
            renderDay={renderDay}
            placeholder="Ask about exercises, nutrition..."
            alwaysShowSend={false}
            scrollToBottom
            scrollToBottomComponent={() => null}
            infiniteScroll
            minInputToolbarHeight={0}
            listViewProps={{
              contentContainerStyle: { paddingBottom: 16, paddingHorizontal: 16 },
            }}
          />
        </View>
      </View>
    </FullScreenModal>
  );
}
