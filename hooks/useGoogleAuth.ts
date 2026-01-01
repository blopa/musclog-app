import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { fetch } from 'expo/fetch';
import { useEffect, useState } from 'react';
import { Alert } from 'react-native';

import { getGoogleClientId } from '@/utils/googleAuth';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

// Mobile redirect URI (custom scheme)
const GOOGLE_REDIRECT_URI_MOBILE = 'com.werules.logger://';

const GOOGLE_SCOPES = [
    'https://www.googleapis.com/auth/cloud-vision',
    'https://www.googleapis.com/auth/generative-language.retriever',
].join(' ');

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
            throw new Error(data.error_description);
        }

        return data;
    } catch (error) {
        console.error('Token exchange failed:', error);
        Alert.alert('Error', 'Failed to sign in with Google.');
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
            const redirectUri = GOOGLE_REDIRECT_URI_MOBILE;
            const clientId = getGoogleClientId();

            // Debug logging
            console.log('[Google Auth Mobile] Starting OAuth flow');
            console.log('[Google Auth Mobile] Client ID:', clientId);
            console.log('[Google Auth Mobile] Redirect URI:', redirectUri);

            const authUrl = buildAuthUrl(redirectUri);
            console.log('[Google Auth Mobile] Auth URL:', authUrl);

            const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);

            if (result.type === 'success' && result.url) {
                const queryParams = Linking.parse(result.url);
                const { code } = queryParams.queryParams || {};

                if (code) {
                    // Handle case where code might be an array (shouldn't happen, but TypeScript requires it)
                    const authCode = Array.isArray(code) ? code[0] : code;
                    setIsSigningIn(true);
                    const tokenData = await exchangeCodeForToken(authCode, redirectUri);
                    setAuthData(tokenData);
                    setIsSigningIn(false);
                }
            } else if (result.type === 'dismiss') {
                // User canceled the auth flow
                console.log('[Google Auth Mobile] User cancelled Google sign-in');
            }
        } catch (error) {
            console.error('[Google Auth Mobile] Failed to open Google auth WebView:', error);
            Alert.alert('Error', 'Failed to initiate Google sign-in.');
        }
    };

    return { authData, isSigningIn, promptAsync };
};
