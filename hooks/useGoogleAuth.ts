import { fetch } from 'expo/fetch';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { Alert } from 'react-native';

import { GOOGLE_REDIRECT_URI_MOBILE, GOOGLE_SCOPES } from '../constants/auth';
import { getGoogleClientId } from '../utils/googleAuth';

// This is required for the OAuth flow to work correctly on mobile
WebBrowser.maybeCompleteAuthSession();

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

export type GoogleAuthData = {
  access_token: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
  token_type: string;
};

const buildAuthUrl = (redirectUri: string) => {
  const clientId = getGoogleClientId();

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: GOOGLE_SCOPES,
  });

  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
};

const exchangeCodeForToken = async (code: string, redirectUri: string) => {
  try {
    const clientId = getGoogleClientId();
    const body = new URLSearchParams({
      client_id: clientId,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    });

    const response = await fetch(GOOGLE_TOKEN_URL, {
      body: body.toString(),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      method: 'POST',
    });

    const data = await response.json();
    if (data.error) {
      throw new Error(data.error_description || data.error);
    }

    return data;
  } catch (error) {
    console.error('Token exchange failed:', error);
    Alert.alert('Error', 'Failed to sign in with Google.'); // TODO: use the snackbar system
    throw error;
  }
};

export const useGoogleAuth = () => {
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [authData, setAuthData] = useState<GoogleAuthData | null>(null);

  useEffect(() => {
    // Handle deep links on mobile
    const handleDeepLink = async (event: Linking.EventType) => {
      const { url } = event;
      const queryParams = Linking.parse(url);

      if (queryParams.queryParams?.code) {
        const { code } = queryParams.queryParams;
        // Handle case where code might be an array (shouldn't happen, but TypeScript requires it)
        const authCode = Array.isArray(code) ? code[0] : code;

        try {
          setIsSigningIn(true);
          const tokenData = await exchangeCodeForToken(authCode, GOOGLE_REDIRECT_URI_MOBILE);
          setAuthData(tokenData);
        } catch (error) {
          console.error('Google sign-in failed:', error);
        } finally {
          setIsSigningIn(false);
        }
      }
    };

    const subscription = Linking.addEventListener('url', handleDeepLink);

    return () => {
      if (subscription) {
        subscription.remove();
      }
    };
  }, []);

  const promptAsync = async () => {
    try {
      const authUrl = buildAuthUrl(GOOGLE_REDIRECT_URI_MOBILE);

      const result = await WebBrowser.openAuthSessionAsync(authUrl, GOOGLE_REDIRECT_URI_MOBILE);

      if (result.type === 'success' && result.url) {
        const queryParams = Linking.parse(result.url);
        const { code } = queryParams.queryParams || {};

        if (code) {
          // Handle case where code might be an array (shouldn't happen, but TypeScript requires it)
          const authCode = Array.isArray(code) ? code[0] : code;
          setIsSigningIn(true);
          const tokenData = await exchangeCodeForToken(authCode, GOOGLE_REDIRECT_URI_MOBILE);
          setAuthData(tokenData);
          setIsSigningIn(false);
        }
      } else if (result.type === 'dismiss') {
        // User canceled the auth flow
      }
    } catch (_error) {
      // TODO: use the snackbar system
      Alert.alert('Error', 'Failed to initiate Google sign-in.');
    }
  };

  return { authData, isSigningIn, promptAsync };
};
