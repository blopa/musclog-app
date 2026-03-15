import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetch } from 'expo/fetch';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

import {
  GOOGLE_ACCESS_TOKEN,
  GOOGLE_ACCESS_TOKEN_EXPIRATION_DATE,
  GOOGLE_CLIENT_ID_MOBILE,
  GOOGLE_CLIENT_ID_WEB,
  GOOGLE_REDIRECT_URI_MOBILE,
  LAST_TIME_GOOGLE_AUTH_ERROR_WAS_SHOWN,
  ONBOARDING_COMPLETED,
} from '../constants/misc';
import { GoogleAuthService } from '../database/services';
import i18n from '../lang/lang';
import { captureException, setSentryUser } from './sentry';
import { showSnackbar } from './snackbarService';

export interface GoogleUserInfo {
  email: string;
  family_name?: string;
  given_name?: string;
  id: string;
  name: string;
  picture: string;
  verified_email: boolean;
}

export interface RefreshTokenResponse {
  access_token: string;
  expires_in: number;
  id_token?: string;
  refresh_token: string;
}

/**
 * Validate if an access token is valid by making a test API call
 */
export async function isValidAccessToken(accessToken: string): Promise<boolean> {
  const userInfo = await getGoogleUserInfo(accessToken);
  return userInfo !== null;
}

// Get the appropriate client ID based on platform
export const getGoogleClientId = (): string => {
  return Platform.OS === 'web' ? GOOGLE_CLIENT_ID_WEB : GOOGLE_CLIENT_ID_MOBILE;
};

// Get the appropriate redirect URI based on platform
export const getGoogleRedirectUri = (): string => {
  return Platform.OS === 'web' ? Linking.createURL('/') : GOOGLE_REDIRECT_URI_MOBILE;
};

const handleGoogleAuthError = async () => {
  // Don't show auth errors before onboarding is complete
  const hasCompletedOnboarding = await AsyncStorage.getItem(ONBOARDING_COMPLETED);
  if (hasCompletedOnboarding !== 'true') {
    return;
  }

  const lastTimeRun = await AsyncStorage.getItem(LAST_TIME_GOOGLE_AUTH_ERROR_WAS_SHOWN);
  const today = new Date().toISOString().split('T')[0];

  if (lastTimeRun === today) {
    console.log('Error already shown today.');
    return;
  }

  const message = i18n.t('your_google_auth_expired_reauth');
  showSnackbar('error', message, {
    duration: 6000,
  });
  await AsyncStorage.setItem(LAST_TIME_GOOGLE_AUTH_ERROR_WAS_SHOWN, today);
};

/**
 * Refresh the access token using the stored refresh token
 */
export const refreshAccessToken = async (): Promise<string | undefined> => {
  const refreshToken = await GoogleAuthService.getRefreshToken();
  if (!refreshToken) {
    await deleteAllData();
    handleGoogleAuthError();
    return;
  }

  try {
    // Use platform-specific client ID for refresh
    // Note: Refresh tokens are tied to the client that issued them,
    // so web and mobile tokens are not interchangeable
    const clientId = getGoogleClientId();
    const response = await fetch('https://oauth2.googleapis.com/token', {
      body: new URLSearchParams({
        client_id: clientId,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }).toString(),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      method: 'POST',
    });

    if (!response.ok) {
      await deleteAllData();

      const errorData = await response.json();
      if (errorData.error === 'invalid_grant') {
        // Refresh token expired or invalid
      }

      handleGoogleAuthError();
      return;
    }

    const data = (await response.json()) as RefreshTokenResponse;

    // Save the new access token and expiration time
    await AsyncStorage.setItem(GOOGLE_ACCESS_TOKEN, data.access_token);
    const expirationTime = new Date().getTime() + data.expires_in * 1000;
    await AsyncStorage.setItem(GOOGLE_ACCESS_TOKEN_EXPIRATION_DATE, expirationTime.toString());

    return data.access_token;
  } catch (error) {
    await deleteAllData();
    handleGoogleAuthError();
  }
};

/**
 * Check if user is signed in with Google (has valid access token)
 */
export const isGoogleSignedIn = async (): Promise<boolean> => {
  const accessToken = await AsyncStorage.getItem(GOOGLE_ACCESS_TOKEN);
  const tokenExpirationTime = await AsyncStorage.getItem(GOOGLE_ACCESS_TOKEN_EXPIRATION_DATE);

  if (!accessToken || !tokenExpirationTime) {
    return false;
  }

  const expirationTime = parseInt(tokenExpirationTime, 10);
  if (isNaN(expirationTime)) {
    return false;
  }

  // Check if token is still valid (with 60 second buffer)
  return new Date().getTime() < expirationTime - 60 * 1000;
};

/**
 * Retrieve a valid access token (refresh if expired)
 */
export const getAccessToken = async (): Promise<string | undefined> => {
  const accessToken = await AsyncStorage.getItem(GOOGLE_ACCESS_TOKEN);
  const tokenExpirationTime = await AsyncStorage.getItem(GOOGLE_ACCESS_TOKEN_EXPIRATION_DATE);

  if (accessToken && tokenExpirationTime) {
    const expirationTime = parseInt(tokenExpirationTime, 10);
    if (!isNaN(expirationTime) && new Date().getTime() < expirationTime - 60 * 1000) {
      return accessToken;
    }
  } else {
    return;
  }

  return await refreshAccessToken();
};

/**
 * Fetch the user's profile information from Google using an access token
 */
export const getGoogleUserInfo = async (accessToken: string): Promise<GoogleUserInfo | null> => {
  if (!accessToken) {
    return null;
  }

  try {
    const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as GoogleUserInfo;
    return data;
  } catch (error) {
    console.error('Error fetching Google user info:', error);
    captureException(error);
    return null;
  }
};

// Export type for use in hooks
export type GoogleAuthData = {
  access_token: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
  token_type: string;
};

/**
 * Save tokens and user info after sign-in
 */
export const handleGoogleSignIn = async (
  response: GoogleAuthData | null
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

    await AsyncStorage.setItem(GOOGLE_ACCESS_TOKEN, accessToken);

    // Only save refresh token if it exists (mobile has it, web implicit flow doesn't)
    if (refreshToken) {
      await GoogleAuthService.saveRefreshToken(refreshToken);
    }

    if (accessToken) {
      // Enable OAuth Gemini and AI settings if we have an access token
      await GoogleAuthService.setOAuthGeminiEnabled(true);
    }

    const expirationTime = new Date().getTime() + (expiresIn ?? 0) * 1000;
    await AsyncStorage.setItem(GOOGLE_ACCESS_TOKEN_EXPIRATION_DATE, expirationTime.toString());

    // Validate access token by checking if it works with Gemini
    return {
      isValid: await isValidAccessToken(accessToken),
      refreshToken,
      accessToken,
    };
  }
  throw new Error('Google sign-in failed or cancelled.');
};

/**
 * Delete all stored tokens and user info
 */
export const deleteAllData = async (): Promise<void> => {
  setSentryUser(null);
  await GoogleAuthService.clearRefreshToken();
  await GoogleAuthService.setOAuthGeminiEnabled(false);
  await AsyncStorage.multiRemove([GOOGLE_ACCESS_TOKEN, GOOGLE_ACCESS_TOKEN_EXPIRATION_DATE]);
};
