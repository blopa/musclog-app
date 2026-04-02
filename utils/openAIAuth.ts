import AsyncStorage from '@react-native-async-storage/async-storage';
import CryptoJS from 'crypto-js';
import * as Crypto from 'expo-crypto';
import { fetch } from 'expo/fetch';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

import {
  OPENAI_ACCESS_TOKEN,
  OPENAI_ACCESS_TOKEN_EXPIRATION_DATE,
  OPENAI_CLIENT_ID,
  OPENAI_OAUTH_ENABLED,
  OPENAI_REFRESH_TOKEN,
  OPENAI_TOKEN_URL,
} from '../constants/misc';

export const OPENAI_AUTH_CHANGED_EVENT = 'openai_auth_changed';

const notifyOpenAIAuthChanged = () => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.dispatchEvent(new Event(OPENAI_AUTH_CHANGED_EVENT));
  }
};

export interface OpenAIAuthData {
  access_token: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
  token_type: string;
  id_token?: string;
}

/**
 * Generate PKCE codes
 */
export const generatePKCE = () => {
  const verifier = Crypto.randomUUID().replace(/-/g, '') + Crypto.randomUUID().replace(/-/g, '');

  const challenge = CryptoJS.SHA256(verifier)
    .toString(CryptoJS.enc.Base64)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  return { codeVerifier: verifier, codeChallenge: challenge };
};

/**
 * Get the appropriate redirect URI based on platform
 */
export const getOpenAIRedirectUri = (): string => {
  return Platform.OS === 'web'
    ? Linking.createURL('/openai-callback')
    : 'com.werules.logger://openai-callback';
};

/**
 * Refresh the access token using the stored refresh token
 */
export const refreshOpenAIAccessToken = async (): Promise<string | undefined> => {
  const refreshToken = await AsyncStorage.getItem(OPENAI_REFRESH_TOKEN);
  if (!refreshToken) {
    await deleteOpenAIData();
    return;
  }

  try {
    const response = await fetch(OPENAI_TOKEN_URL, {
      body: new URLSearchParams({
        client_id: OPENAI_CLIENT_ID,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }).toString(),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      method: 'POST',
    });

    if (!response.ok) {
      await deleteOpenAIData();
      return;
    }

    const data = (await response.json()) as OpenAIAuthData;

    await AsyncStorage.setItem(OPENAI_ACCESS_TOKEN, data.access_token);
    const expirationTime = new Date().getTime() + data.expires_in * 1000;
    await AsyncStorage.setItem(OPENAI_ACCESS_TOKEN_EXPIRATION_DATE, expirationTime.toString());

    if (data.refresh_token) {
      await AsyncStorage.setItem(OPENAI_REFRESH_TOKEN, data.refresh_token);
    }

    return data.access_token;
  } catch (error) {
    console.error('Error refreshing OpenAI access token:', error);
    await deleteOpenAIData();
  }
};

/**
 * Check if user is signed in with OpenAI
 */
export const isOpenAISignedIn = async (): Promise<boolean> => {
  const accessToken = await AsyncStorage.getItem(OPENAI_ACCESS_TOKEN);
  const tokenExpirationTime = await AsyncStorage.getItem(OPENAI_ACCESS_TOKEN_EXPIRATION_DATE);

  if (accessToken && tokenExpirationTime) {
    const expirationTime = parseInt(tokenExpirationTime, 10);
    if (!isNaN(expirationTime) && new Date().getTime() < expirationTime - 60 * 1000) {
      return true;
    }
  }

  const refreshToken = await AsyncStorage.getItem(OPENAI_REFRESH_TOKEN);
  if (!refreshToken) {
    return false;
  }

  const refreshed = await refreshOpenAIAccessToken();
  return refreshed !== undefined;
};

/**
 * Retrieve a valid access token
 */
export const getOpenAIAccessToken = async (): Promise<string | undefined> => {
  const accessToken = await AsyncStorage.getItem(OPENAI_ACCESS_TOKEN);
  const tokenExpirationTime = await AsyncStorage.getItem(OPENAI_ACCESS_TOKEN_EXPIRATION_DATE);

  if (accessToken && tokenExpirationTime) {
    const expirationTime = parseInt(tokenExpirationTime, 10);
    if (!isNaN(expirationTime) && new Date().getTime() < expirationTime - 60 * 1000) {
      return accessToken;
    }
  }

  return await refreshOpenAIAccessToken();
};

/**
 * Save tokens after sign-in
 */
export const handleOpenAISignIn = async (
  response: OpenAIAuthData | null
): Promise<{
  isValid: boolean;
  refreshToken: string;
  accessToken: string;
}> => {
  if (response) {
    const {
      access_token: accessToken,
      expires_in: expiresIn,
      refresh_token: refreshToken,
    } = response;

    await AsyncStorage.setItem(OPENAI_ACCESS_TOKEN, accessToken);

    if (refreshToken) {
      await AsyncStorage.setItem(OPENAI_REFRESH_TOKEN, refreshToken);
    }

    if (accessToken) {
      await AsyncStorage.setItem(OPENAI_OAUTH_ENABLED, 'true');
    }

    const expirationTime = new Date().getTime() + (expiresIn ?? 0) * 1000;
    await AsyncStorage.setItem(OPENAI_ACCESS_TOKEN_EXPIRATION_DATE, expirationTime.toString());

    const result = {
      isValid: !!accessToken,
      refreshToken,
      accessToken,
    };

    notifyOpenAIAuthChanged();
    return result;
  }
  throw new Error('OpenAI sign-in failed or cancelled.');
};

/**
 * Delete all stored OpenAI tokens
 */
export const deleteOpenAIData = async (): Promise<void> => {
  await AsyncStorage.multiRemove([
    OPENAI_ACCESS_TOKEN,
    OPENAI_ACCESS_TOKEN_EXPIRATION_DATE,
    OPENAI_REFRESH_TOKEN,
    OPENAI_OAUTH_ENABLED,
  ]);
  notifyOpenAIAuthChanged();
};

/**
 * Get OAuth OpenAI enabled status
 */
export const getOAuthOpenAIEnabled = async (): Promise<boolean> => {
  const enabled = await AsyncStorage.getItem(OPENAI_OAUTH_ENABLED);
  return enabled === 'true';
};
