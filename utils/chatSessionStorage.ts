import AsyncStorage from '@react-native-async-storage/async-storage';

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
