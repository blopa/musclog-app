
import { GOOGLE_CLIENT_ID } from '@/utils/googleAuth';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { fetch } from 'expo/fetch';
import { useEffect, useState } from 'react';
import { Alert } from 'react-native';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

const GOOGLE_REDIRECT_URI = 'com.werules.logger://';
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

const buildAuthUrl = () => {
    const params = new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        redirect_uri: GOOGLE_REDIRECT_URI,
        response_type: 'code',
        scope: GOOGLE_SCOPES,
    });

    return `${GOOGLE_AUTH_URL}?${params.toString()}`;
};

const exchangeCodeForToken = async (code: string) => {
    try {
        const body = new URLSearchParams({
            client_id: GOOGLE_CLIENT_ID,
            code,
            grant_type: 'authorization_code',
            redirect_uri: GOOGLE_REDIRECT_URI,
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
        const handleDeepLink = async (event: Linking.EventType) => {
            const { url } = event;
            const queryParams = Linking.parse(url);

            if (queryParams.queryParams?.code) {
                const { code } = queryParams.queryParams;

                try {
                    setIsSigningIn(true);
                    const tokenData = await exchangeCodeForToken(code as string);
                    setAuthData(tokenData);
                } catch (error) {
                    console.error('Google sign-in failed:', error);
                } finally {
                    setIsSigningIn(false);
                }
            }
        };

        Linking.addEventListener('url', handleDeepLink);
    }, []);

    const promptAsync = async () => {
        try {
            const authUrl = buildAuthUrl();
            const result = await WebBrowser.openAuthSessionAsync(authUrl, GOOGLE_REDIRECT_URI);

            if (result.type === 'success' && result.url) {
                const queryParams = Linking.parse(result.url);
                const { code } = queryParams.queryParams || {};

                if (code) {
                    setIsSigningIn(true);
                    const tokenData = await exchangeCodeForToken(code as string);
                    setAuthData(tokenData);
                    setIsSigningIn(false);
                }
            }
        } catch (error) {
            console.error('Failed to open Google auth WebView:', error);
            Alert.alert('Error', 'Failed to initiate Google sign-in.');
        }
    };

    return { authData, isSigningIn, promptAsync };
};
