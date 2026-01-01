/**
 * Web-specific Google OAuth implementation using Implicit Grant Flow
 * Based on: https://developers.google.com/identity/protocols/oauth2/javascript-implicit-flow
 *
 * Note: Implicit flow doesn't provide refresh_token, so users will need to re-authenticate
 * when the access token expires. This is the only way to do pure client-side OAuth without a backend.
 */

import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { Alert } from 'react-native';

import { getGoogleClientId } from '@/utils/googleAuth';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_SCOPES = [
    'https://www.googleapis.com/auth/cloud-vision',
    'https://www.googleapis.com/auth/generative-language.retriever',
].join(' ');

export type GoogleAuthData = {
    access_token: string;
    expires_in: number;
    refresh_token: string; // Will be empty string for implicit flow
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

// Parse access token from URL fragment (hash)
const parseTokenFromUrl = (url: string): GoogleAuthData | null => {
    try {
        const hash = url.split('#')[1];
        if (!hash) {
            return null;
        }

        const params = new URLSearchParams(hash);
        const accessToken = params.get('access_token');
        const expiresIn = params.get('expires_in');
        const scope = params.get('scope');
        const tokenType = params.get('token_type');
        const error = params.get('error');

        if (error) {
            throw new Error(params.get('error_description') || error);
        }

        if (!accessToken) {
            return null;
        }

        return {
            access_token: accessToken,
            expires_in: parseInt(expiresIn || '3600', 10),
            refresh_token: '', // Implicit flow doesn't provide refresh_token
            scope: scope || GOOGLE_SCOPES,
            token_type: tokenType || 'Bearer',
        };
    } catch (error) {
        console.error('[Google Auth Web] Error parsing token from URL:', error);
        return null;
    }
};

export const useGoogleAuth = () => {
    const [authData, setAuthData] = useState<GoogleAuthData | null>(null);
    const [isSigningIn, setIsSigningIn] = useState(false);

    useEffect(() => {
        // Check if we're returning from OAuth redirect with token in URL fragment
        if (typeof window !== 'undefined') {
            const { hash } = window.location;
            if (hash && hash.includes('access_token')) {
                const tokenData = parseTokenFromUrl(window.location.href);
                if (tokenData) {
                    setAuthData(tokenData);
                    // Clean up URL - remove hash fragment
                    window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
                }
            }
        }
    }, []);

    const promptAsync = async () => {
        if (typeof window === 'undefined') {
            throw new Error('Web OAuth is only available on web platform');
        }

        try {
            setIsSigningIn(true);
            const redirectUri = getWebRedirectUri();
            const clientId = getGoogleClientId();

            // Build OAuth URL for implicit grant flow
            // Using response_type=token (implicit flow) instead of response_type=code
            const params = new URLSearchParams({
                client_id: clientId,
                include_granted_scopes: 'true',
                redirect_uri: redirectUri,
                response_type: 'token', // Implicit flow - returns token directly
                scope: GOOGLE_SCOPES,
            });

            const authUrl = `${GOOGLE_AUTH_URL}?${params.toString()}`;

            console.log('[Google Auth Web] Starting implicit grant OAuth flow');
            console.log('[Google Auth Web] Client ID:', clientId);
            console.log('[Google Auth Web] Redirect URI:', redirectUri);
            console.log('[Google Auth Web] Auth URL:', authUrl);

            // Open auth session - token will be in the redirect URL fragment
            const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);

            if (result.type === 'success' && result.url) {
                // Parse token from URL fragment
                const tokenData = parseTokenFromUrl(result.url);
                if (tokenData) {
                    setAuthData(tokenData);
                } else {
                    // Check for error in URL
                    const urlObj = new URL(result.url);
                    const error = urlObj.hash ? new URLSearchParams(urlObj.hash.substring(1)).get('error') : null;
                    if (error) {
                        const errorDesc = new URLSearchParams(urlObj.hash.substring(1)).get('error_description');
                        throw new Error(errorDesc || error);
                    }
                    throw new Error('Failed to parse access token from response');
                }
            } else if (result.type === 'dismiss') {
                console.log('[Google Auth Web] User cancelled Google sign-in');
            }
        } catch (error) {
            console.error('[Google Auth Web] Failed to initiate Google sign-in:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            Alert.alert('Error', `Failed to sign in with Google: ${errorMessage}`);
        } finally {
            setIsSigningIn(false);
        }
    };

    return {
        authData,
        isSigningIn,
        promptAsync,
    };
};
