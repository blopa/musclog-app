import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { fetch } from 'expo/fetch';
import { useEffect, useState } from 'react';
import { Alert } from 'react-native';

import { getGoogleClientId } from '@/utils/googleAuth';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

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

// PKCE helper functions
const generateCodeVerifier = (): string => {
    const array = new Uint8Array(32);
    if (typeof window !== 'undefined' && window.crypto) {
        window.crypto.getRandomValues(array);
    } else {
        // Fallback for environments without crypto
        for (let i = 0; i < array.length; i++) {
            array[i] = Math.floor(Math.random() * 256);
        }
    }

    // eslint-disable-next-line no-undef
    return btoa(String.fromCharCode(...array))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
};

const generateCodeChallenge = async (verifier: string): Promise<string> => {
    if (typeof window === 'undefined' || !window.crypto?.subtle) {
        throw new Error('Web Crypto API is not available');
    }

    // eslint-disable-next-line no-undef
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const digest = await window.crypto.subtle.digest('SHA-256', data);

    // eslint-disable-next-line no-undef
    return btoa(String.fromCharCode(...new Uint8Array(digest)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
};

const buildAuthUrl = async (redirectUri: string, codeChallenge: string) => {
    const clientId = getGoogleClientId();
    const params = new URLSearchParams({
        client_id: clientId,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: GOOGLE_SCOPES,
    });

    return `${GOOGLE_AUTH_URL}?${params.toString()}`;
};

const exchangeCodeForToken = async (
    code: string,
    redirectUri: string,
    codeVerifier: string
) => {
    try {
        const clientId = getGoogleClientId();
        const body = new URLSearchParams({
            client_id: clientId,
            code,
            code_verifier: codeVerifier,
            grant_type: 'authorization_code',
            redirect_uri: redirectUri,
            // Note: We do NOT include client_secret for PKCE flow
        });

        console.log('[Google Auth Web] Exchanging code for token with PKCE');

        const response = await fetch(GOOGLE_TOKEN_URL, {
            body: body.toString(),
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            method: 'POST',
        });

        const data = await response.json();
        if (data.error) {
            console.error('[Google Auth Web] Token exchange error:', data);
            throw new Error(data.error_description || data.error);
        }

        return data;
    } catch (error) {
        console.error('[Google Auth Web] Token exchange failed:', error);
        Alert.alert('Error', 'Failed to sign in with Google.');
        throw error;
    }
};

export const useGoogleAuth = () => {
    const [isSigningIn, setIsSigningIn] = useState(false);
    const [authData, setAuthData] = useState<GoogleAuthData | null>(null);

    useEffect(() => {
        // Handle OAuth callback on web by checking URL parameters
        const handleWebCallback = async () => {
            if (typeof window === 'undefined') {
                return;
            }

            const urlParams = new URLSearchParams(window.location.search);
            const code = urlParams.get('code');
            const error = urlParams.get('error');

            if (error) {
                console.error('[Google Auth Web] OAuth error:', error);
                console.error('[Google Auth Web] Error description:', urlParams.get('error_description'));
                Alert.alert('Error', `Failed to sign in with Google: ${error}`);
                window.history.replaceState({}, document.title, window.location.pathname);
                return;
            }

            if (code) {
                try {
                    setIsSigningIn(true);
                    const redirectUri = getWebRedirectUri();

                    // eslint-disable-next-line no-undef
                    const codeVerifier = sessionStorage.getItem('google_oauth_code_verifier');
                    if (!codeVerifier) {
                        throw new Error('Code verifier not found. Please try signing in again.');
                    }

                    const tokenData = await exchangeCodeForToken(code, redirectUri, codeVerifier);
                    setAuthData(tokenData);

                    // eslint-disable-next-line no-undef
                    sessionStorage.removeItem('google_oauth_code_verifier');
                    window.history.replaceState({}, document.title, window.location.pathname);
                } catch (error) {
                    console.error('[Google Auth Web] Google sign-in failed:', error);
                    // eslint-disable-next-line no-undef
                    sessionStorage.removeItem('google_oauth_code_verifier');
                } finally {
                    setIsSigningIn(false);
                }
            }
        };

        handleWebCallback();
    }, []);

    const promptAsync = async () => {
        if (typeof window === 'undefined') {
            throw new Error('Web OAuth is only available on web platform');
        }

        try {
            setIsSigningIn(true);
            const redirectUri = getWebRedirectUri();
            const clientId = getGoogleClientId();

            // Generate PKCE parameters
            const codeVerifier = generateCodeVerifier();
            const codeChallenge = await generateCodeChallenge(codeVerifier);

            // eslint-disable-next-line no-undef
            sessionStorage.setItem('google_oauth_code_verifier', codeVerifier);

            console.log('[Google Auth Web] Starting PKCE OAuth flow');
            console.log('[Google Auth Web] Client ID:', clientId);
            console.log('[Google Auth Web] Redirect URI:', redirectUri);

            const authUrl = await buildAuthUrl(redirectUri, codeChallenge);
            console.log('[Google Auth Web] Auth URL:', authUrl);

            const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);

            if (result.type === 'success' && result.url) {
                const queryParams = Linking.parse(result.url);
                const { code } = queryParams.queryParams || {};

                if (code) {
                    const authCode = Array.isArray(code) ? code[0] : code;
                    setIsSigningIn(true);

                    // eslint-disable-next-line no-undef
                    const storedVerifier = sessionStorage.getItem('google_oauth_code_verifier');
                    if (!storedVerifier) {
                        throw new Error('Code verifier not found');
                    }

                    const tokenData = await exchangeCodeForToken(authCode, redirectUri, storedVerifier);
                    setAuthData(tokenData);
                    setIsSigningIn(false);

                    // eslint-disable-next-line no-undef
                    sessionStorage.removeItem('google_oauth_code_verifier');
                }
            } else if (result.type === 'dismiss') {
                console.log('[Google Auth Web] User cancelled Google sign-in');
                // eslint-disable-next-line no-undef
                sessionStorage.removeItem('google_oauth_code_verifier');
            }
        } catch (error) {
            console.error('[Google Auth Web] Failed to open Google auth:', error);
            Alert.alert('Error', 'Failed to initiate Google sign-in.');
            // eslint-disable-next-line no-undef
            sessionStorage.removeItem('google_oauth_code_verifier');
            setIsSigningIn(false);
        }
    };

    return { authData, isSigningIn, promptAsync };
};
