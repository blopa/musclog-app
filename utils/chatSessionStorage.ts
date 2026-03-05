import AsyncStorage from '@react-native-async-storage/async-storage';

import { UNREAD_CHAT_MESSAGES_COUNT } from '../constants/misc';

const CURRENT_CHAT_SESSION_KEY = 'current_coach_chat_session_id';

export async function getCurrentChatSessionId(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(CURRENT_CHAT_SESSION_KEY);
  } catch (error) {
    console.error('Error getting chat session from storage:', error);
    return null;
  }
}

export async function setCurrentChatSessionId(sessionId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(CURRENT_CHAT_SESSION_KEY, sessionId);
  } catch (error) {
    console.error('Error setting chat session in storage:', error);
    throw error;
  }
}

// TODO migrate this to a more robust way with a react hook or a react context instead of
// using the singleton local esmodule variable

let _unreadCount = 0;
const _listeners = new Set<() => void>();

/** Hydrate the in-memory counter from AsyncStorage. Call once at app startup. */
export async function initUnreadCount(): Promise<void> {
  try {
    const stored = await AsyncStorage.getItem(UNREAD_CHAT_MESSAGES_COUNT);
    if (stored) {
      _unreadCount = Math.max(0, parseInt(stored, 10) || 0);
    }
  } catch {
    // ignore
  }
}

/** Returns the current in-memory unread count. */
export function getUnreadCount(): number {
  return _unreadCount;
}

/** Set an arbitrary unread count. Persists to AsyncStorage and notifies listeners. */
export async function setUnreadCount(count: number): Promise<void> {
  _unreadCount = Math.max(0, count);
  _listeners.forEach((l) => l());
  try {
    await AsyncStorage.setItem(UNREAD_CHAT_MESSAGES_COUNT, _unreadCount.toString());
  } catch (error) {
    console.error('Error persisting unread count:', error);
  }
}

/** Clear the unread count (set to 0). Call when the user opens the chat. */
export async function clearUnreadCount(): Promise<void> {
  return setUnreadCount(0);
}

/** Subscribe to unread count changes. Returns an unsubscribe function. */
export function subscribeToUnreadCount(listener: () => void): () => void {
  _listeners.add(listener);
  return () => _listeners.delete(listener);
}
