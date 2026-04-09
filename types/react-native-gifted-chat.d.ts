// Type stub for react-native-gifted-chat
// The library ships TypeScript source files which cause type errors.
// This stub overrides the types to avoid those errors.

import * as React from 'react';
import {
  ColorSchemeName,
  TextInput,
  TextInputProps,
  TextStyle,
  ViewProps,
  ViewStyle,
} from 'react-native';

export interface User {
  _id: string | number;
  name?: string;
  avatar?: string | number;
}

export interface IMessage {
  _id: string | number;
  text: string;
  createdAt: Date | number;
  user: User;
  image?: string;
  video?: string;
  audio?: string;
  system?: boolean;
  sent?: boolean;
  received?: boolean;
  pending?: boolean;
  quickReplies?: QuickReplies;
}

export interface QuickReplies {
  type: 'radio' | 'checkbox';
  values: Reply[];
  keepIt?: boolean;
}

export interface Reply {
  title: string;
  value: string;
  messageId?: string | number;
}

// Bubble types
export interface BubbleProps<TMessage extends IMessage = IMessage> {
  message: TMessage;
  position: 'left' | 'right';
  currentMessage?: TMessage;
  nextMessage?: TMessage;
  previousMessage?: TMessage;
  user?: User;
  containerStyle?: {
    left?: ViewStyle;
    right?: ViewStyle;
  };
  wrapperStyle?: {
    left?: ViewStyle;
    right?: ViewStyle;
  };
  textStyle?: {
    left?: TextStyle;
    right?: TextStyle;
  };
  bottomContainerStyle?: {
    left?: ViewStyle;
    right?: ViewStyle;
  };
  tickStyle?: TextStyle;
  usernameStyle?: TextStyle;
  containerToNextStyle?: {
    left?: ViewStyle;
    right?: ViewStyle;
  };
  containerToPreviousStyle?: {
    left?: ViewStyle;
    right?: ViewStyle;
  };
  isCustomViewBottom?: boolean;
  renderMessageImage?(props: any): React.ReactNode;
  renderMessageVideo?(props: any): React.ReactNode;
  renderMessageAudio?(props: any): React.ReactNode;
  renderMessageText?(props: any): React.ReactNode;
  renderCustomView?(props: any): React.ReactNode;
  renderTime?(props: any): React.ReactNode;
  renderTicks?(currentMessage: TMessage): React.ReactNode;
  renderUsername?(): React.ReactNode;
  renderQuickReplySend?(): React.ReactNode;
  onLongPress?(context?: any, message?: TMessage): void;
  onPress?(context?: any, message?: TMessage): void;
  onQuickReply?(replies: Reply[]): void;
  touchableProps?: any;
  renderBubble?(props: BubbleProps<TMessage>): React.ReactNode;
  renderSystemMessage?(props: any): React.ReactNode;
  isSameDay?(currentMessage: TMessage, nextMessage: TMessage): boolean;
  isSameUser?(currentMessage: TMessage, nextMessage: TMessage): boolean;
  inverted?: boolean;
  quickReplyStyle?: ViewStyle;
  quickReplyColor?: string;
  quickReplyTextStyle?: TextStyle;
  quickReplyContainerStyle?: ViewStyle;
}

export class Bubble<TMessage extends IMessage = IMessage> extends React.Component<
  BubbleProps<TMessage>
> {}

// Composer types
export interface ComposerProps {
  composerHeight?: number;
  text?: string;
  placeholder?: string;
  placeholderTextColor?: string;
  textInputProps?: TextInputProps;
  textInputStyle?: TextStyle;
  textInputAutoFocus?: boolean;
  keyboardAppearance?: 'default' | 'light' | 'dark';
  multiline?: boolean;
  disableComposer?: boolean;
  onTextChanged?(text: string): void;
  onInputSizeChanged?(size: { width: number; height: number }): void;
}

export class Composer extends React.Component<ComposerProps> {}

// InputToolbar types
export interface InputToolbarProps<TMessage extends IMessage = IMessage> {
  renderActions?(props: any): React.ReactNode;
  renderComposer?(props: ComposerProps): React.ReactNode;
  renderSend?(props: SendProps<TMessage>): React.ReactNode;
  renderAccessory?(props: any): React.ReactNode;
  onPressActionButton?(): void;
  containerStyle?: ViewStyle;
  primaryStyle?: ViewStyle;
  accessoryStyle?: ViewStyle;
}

export class InputToolbar<TMessage extends IMessage = IMessage> extends React.Component<
  InputToolbarProps<TMessage>
> {}

// Send types
export interface SendProps<TMessage extends IMessage = IMessage> {
  text?: string;
  label?: string;
  containerStyle?: ViewStyle;
  textStyle?: TextStyle;
  children?: React.ReactNode;
  alwaysShowSend?: boolean;
  disabled?: boolean;
  sendButtonProps?: any;
  onSend?(messages: Partial<TMessage>, shouldResetInputToolbar: boolean): void;
}

export class Send<TMessage extends IMessage = IMessage> extends React.Component<
  SendProps<TMessage>
> {}

// Main GiftedChat types
export interface GiftedChatProps<TMessage extends IMessage = IMessage> {
  messages?: TMessage[];
  text?: string;
  placeholder?: string;
  onSend?: (messages: TMessage[]) => void;
  user?: User;
  locale?: string;
  timeFormat?: string;
  dateFormat?: string;
  isKeyboardInternallyHandled?: boolean;
  loadEarlier?: boolean;
  isLoadingEarlier?: boolean;
  isTyping?: boolean;
  renderLoading?: () => React.ReactNode;
  renderLoadEarlier?: (props: any) => React.ReactNode;
  renderAvatar?: (props: any) => React.ReactNode;
  renderBubble?: (props: BubbleProps<TMessage>) => React.ReactNode;
  renderSystemMessage?: (props: any) => React.ReactNode;
  renderUsername?: (props: any) => React.ReactNode;
  renderMessage?: (props: any) => React.ReactNode;
  renderMessageText?: (props: any) => React.ReactNode;
  renderMessageImage?: (props: any) => React.ReactNode;
  renderMessageVideo?: (props: any) => React.ReactNode;
  renderMessageAudio?: (props: any) => React.ReactNode;
  renderCustomView?: (props: any) => React.ReactNode;
  renderDay?: (props: any) => React.ReactNode;
  renderTime?: (props: any) => React.ReactNode;
  renderFooter?: () => React.ReactNode;
  renderInputToolbar?: (props: InputToolbarProps<TMessage>) => React.ReactNode;
  renderComposer?: (props: ComposerProps) => React.ReactNode;
  renderActions?: (props: any) => React.ReactNode;
  renderSend?: (props: SendProps<TMessage>) => React.ReactNode;
  renderAccessory?: (props: any) => React.ReactNode;
  renderChatEmpty?: () => React.ReactNode;
  renderChatFooter?: () => React.ReactNode;
  renderChatHeader?: () => React.ReactNode;
  onPressActionButton?: () => void;
  onQuickReply?: (replies: Reply[]) => void;
  keyboardShouldPersistTaps?: 'always' | 'never' | 'handled';
  onInputTextChanged?: (text: string) => void;
  maxInputLength?: number;
  forceGetKeyboardHeight?: boolean;
  inverted?: boolean;
  extraData?: any;
  minComposerHeight?: number;
  maxComposerHeight?: number;
  wrapInSafeArea?: boolean;
  scrollToBottom?: boolean;
  scrollToBottomComponent?: () => React.ReactNode;
  scrollToBottomOffset?: number;
  scrollToBottomStyle?: ViewStyle;
  alignTop?: boolean;
  scrollToBottomOnContentSizeChange?: boolean;
  onLongPressAvatar?: (user: User) => void;
  onPressAvatar?: (user: User) => void;
  renderAvatarOnTop?: boolean;
  renderUsernameOnMessage?: boolean;
  position?: 'left' | 'right';
  bottomOffset?: number;
  minQuickReplyWidth?: number;
  maxQuickReplyWidth?: number;
  quickReplyStyle?: ViewStyle;
  quickReplyTextStyle?: TextStyle;
  quickReplyContainerStyle?: ViewStyle;
  enableEmptySections?: boolean;
  listViewProps?: any;
  listProps?: any;
  minInputToolbarHeight?: number;
  maxInputToolbarHeight?: number;
  textInputProps?: any;
  actionSheet?: () => any;
  getLocale?: () => string;
  getColorScheme?: () => ColorSchemeName;
}

export default class GiftedChat<TMessage extends IMessage = IMessage> extends React.Component<
  GiftedChatProps<TMessage>
> {
  static append<TMessage extends IMessage>(
    currentMessages: TMessage[],
    messages: TMessage[]
  ): TMessage[];
  static prepend<TMessage extends IMessage>(
    currentMessages: TMessage[],
    messages: TMessage[]
  ): TMessage[];
}

export { GiftedChat };
