
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { fetch } from 'expo/fetch';
import { useEffect, useState } from 'react';
import { Alert, Platform } from 'react-native';

import { getGoogleClientId } from '@/utils/googleAuth';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

// Mobile redirect URI (custom scheme)
const GOOGLE_REDIRECT_URI_MOBILE = 'com.werules.logger://';
// Web redirect URI - will be constructed dynamically based on current origin
const getWebRedirectUri = () => {
    if (Platform.OS === 'web') {
        // Use the current page URL as redirect URI for web
        // This allows Google to redirect back to the same page with query parameters
        if (typeof window !== 'undefined') {
            return window.location.origin + window.location.pathname;
        }

        return '';
    }

    return GOOGLE_REDIRECT_URI_MOBILE;
};

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
        // Handle OAuth callback on web by checking URL parameters
        if (Platform.OS === 'web') {
            const handleWebCallback = async () => {
                const urlParams = new URLSearchParams(window.location.search);
                const code = urlParams.get('code');
                const error = urlParams.get('error');

                if (error) {
                    console.error('OAuth error:', error);
                    Alert.alert('Error', 'Failed to sign in with Google.');
                    // Clean up URL
                    window.history.replaceState({}, document.title, window.location.pathname);
                    return;
                }

                if (code) {
                    try {
                        setIsSigningIn(true);
                        const redirectUri = getWebRedirectUri();
                        const tokenData = await exchangeCodeForToken(code, redirectUri);
                        setAuthData(tokenData);
                        // Clean up URL after successful auth
                        window.history.replaceState({}, document.title, window.location.pathname);
                    } catch (error) {
                        console.error('Google sign-in failed:', error);
                    } finally {
                        setIsSigningIn(false);
                    }
                }
            };

            handleWebCallback();
        }

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
                    const redirectUri = GOOGLE_REDIRECT_URI_MOBILE;
                    const tokenData = await exchangeCodeForToken(authCode, redirectUri);
                    setAuthData(tokenData);
                } catch (error) {
                    console.error('Google sign-in failed:', error);
                } finally {
                    setIsSigningIn(false);
                }
            }
        };

        let subscription: null | { remove: () => void } = null;
        if (Platform.OS !== 'web') {
            subscription = Linking.addEventListener('url', handleDeepLink);
        }

        return () => {
            if (subscription) {
                subscription.remove();
            }
        };
    }, []);

    const promptAsync = async () => {
        try {
            const redirectUri = getWebRedirectUri();
            const authUrl = buildAuthUrl(redirectUri);
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
                // User cancelled the auth flow
                console.log('User cancelled Google sign-in');
            }
        } catch (error) {
            console.error('Failed to open Google auth WebView:', error);
            Alert.alert('Error', 'Failed to initiate Google sign-in.');
        }
    };

    return { authData, isSigningIn, promptAsync };
};
