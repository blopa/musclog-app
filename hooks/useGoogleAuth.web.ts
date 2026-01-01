import { ResponseType, useAuthRequest } from 'expo-auth-session';
import { useEffect, useState } from 'react';
import { Alert } from 'react-native';

import { getGoogleClientId } from '@/utils/googleAuth';

const GOOGLE_SCOPES = [
    'https://www.googleapis.com/auth/cloud-vision',
    'https://www.googleapis.com/auth/generative-language.retriever',
];

export type GoogleAuthData = {
    access_token: string;
    expires_in: number;
    refresh_token: string;
    scope: string;
    token_type: string;
};

// Web redirect URI - will be constructed dynamically based on current origin
const getWebRedirectUri = () => {
    if (typeof window === 'undefined') {
        return '';
    }
    // Normalize the redirect URI: always remove trailing slash
    let { pathname } = window.location;
    if (pathname.endsWith('/') && pathname.length > 1) {
        pathname = pathname.slice(0, -1);
    }
    return window.location.origin + (pathname === '/' ? '' : pathname);
};

export const useGoogleAuth = () => {
    const [authData, setAuthData] = useState<GoogleAuthData | null>(null);
    const redirectUri = getWebRedirectUri();
    const clientId = getGoogleClientId();

    // Use expo-auth-session's useAuthRequest which handles PKCE automatically
    const [request, response, promptAsync] = useAuthRequest(
        {
            clientId,
            redirectUri,
            responseType: ResponseType.Code,
            scopes: GOOGLE_SCOPES,
            // expo-auth-session automatically handles PKCE for web
            usePKCE: true,
        },
        {
            authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
            tokenEndpoint: 'https://oauth2.googleapis.com/token',
        }
    );

    useEffect(() => {
        if (response?.type === 'success') {
            if (response.authentication) {
                // Token exchange was successful
                const { accessToken, expiresIn, refreshToken, scope, tokenType } = response.authentication;

                if (accessToken) {
                    const data: GoogleAuthData = {
                        access_token: accessToken,
                        expires_in: expiresIn || 3600,
                        refresh_token: refreshToken || '',
                        scope: scope || GOOGLE_SCOPES.join(' '),
                        token_type: tokenType || 'Bearer',
                    };
                    setAuthData(data);
                }
            } else if (response.params?.code) {
                // We got an authorization code, but token exchange might have failed
                // This shouldn't happen with expo-auth-session, but handle it just in case
                console.warn('[Google Auth Web] Got authorization code but no authentication object');
            }
        } else if (response?.type === 'error') {
            console.error('[Google Auth Web] OAuth error:', response.error);
            const errorMessage = response.error?.message || response.error?.code || 'Unknown error';
            Alert.alert('Error', `Failed to sign in with Google: ${errorMessage}`);
        }
    }, [response]);

    const handlePromptAsync = async () => {
        try {
            console.log('[Google Auth Web] Starting OAuth flow with expo-auth-session');
            console.log('[Google Auth Web] Client ID:', clientId);
            console.log('[Google Auth Web] Redirect URI:', redirectUri);
            await promptAsync();
        } catch (error) {
            console.error('[Google Auth Web] Failed to initiate Google sign-in:', error);
            Alert.alert('Error', 'Failed to initiate Google sign-in.');
        }
    };

    console.log('THE RESPONSE', response);
    return {
        authData,
        isSigningIn: request === null || response?.type === 'loading',
        promptAsync: handlePromptAsync,
    };
};
