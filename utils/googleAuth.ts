import {
    AI_SETTINGS_TYPE,
    GOOGLE_ACCESS_TOKEN,
    GOOGLE_ACCESS_TOKEN_EXPIRATION_DATE,
    GOOGLE_OAUTH_GEMINI_ENABLED_TYPE,
    GOOGLE_REFRESH_TOKEN_TYPE,
    GOOGLE_USER_INFO,
} from '@/constants/storage';
import { addOrUpdateSetting, getSetting } from '@/utils/database';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthSessionResult } from 'expo-auth-session';
// import fetch from 'isomorphic-fetch';
import { fetch } from 'expo/fetch';

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

export const GOOGLE_CLIENT_ID = '182653769964-letucboq7c5m25ckvgp9kuirrdm33fkc.apps.googleusercontent.com';

/**
 * Fetch user info using the access token.
 * Automatically refreshes the access token if the current one is invalid.
 */
export const getUserInfo = async (token: string): Promise<GoogleUserInfo | null> => {
    if (!token) {
        throw new Error('Access token is missing.');
    }

    const makeRequest = async (accessToken: string) => {
        return fetch('https://www.googleapis.com/userinfo/v2/me', {
            headers: { Authorization: `Bearer ${accessToken}` },
        });
    };

    try {
        // First attempt
        let response = await makeRequest(token);

        if (response.status === 401) {
            // Token is invalid, try refreshing it
            console.warn('Access token is invalid. Attempting to refresh...');
            const newAccessToken = await refreshAccessToken();

            // Retry with the new access token
            response = await makeRequest(newAccessToken);
        }

        if (!response.ok) {
            throw new Error('Failed to fetch user info.');
        }

        return (await response.json()) as GoogleUserInfo;
    } catch (error) {
        console.error('Error fetching user info:', error);
        throw error;
    }
};

/**
 * Refresh the access token using the stored refresh token
 */
export const refreshAccessToken = async (): Promise<string> => {
    const refreshToken = await getSetting(GOOGLE_REFRESH_TOKEN_TYPE);
    if (!refreshToken?.value) {
        throw new Error('Refresh token is missing. Please sign in again.');
    }

    try {
        const response = await fetch('https://oauth2.googleapis.com/token', {
            body: new URLSearchParams({
                client_id: GOOGLE_CLIENT_ID,
                grant_type: 'refresh_token',
                refresh_token: refreshToken.value,
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
                throw new Error('Refresh token expired or invalid. Please sign in again.');
            }

            throw new Error(errorData.error || 'Failed to refresh access token');
        }

        const data = (await response.json()) as RefreshTokenResponse;

        // Save the new access token and expiration time
        await AsyncStorage.setItem(GOOGLE_ACCESS_TOKEN, data.access_token);
        const expirationTime = new Date().getTime() + data.expires_in * 1000;
        await AsyncStorage.setItem(GOOGLE_ACCESS_TOKEN_EXPIRATION_DATE, expirationTime.toString());

        return data.access_token;
    } catch (error) {
        await deleteAllData();

        console.error('Error refreshing access token:', error);
        throw error;
    }
};

/**
 * Reauthenticate the user to get a new refresh token.
 */
export const reauthenticate = async (
    promptAsync: () => Promise<AuthSessionResult>
): Promise<string> => {
    try {
        const result = await promptAsync();
        if (result.type === 'success' && result.authentication) {
            const { refreshToken } = result.authentication;

            if (!refreshToken) {
                throw new Error('Failed to obtain a new refresh token. Please try again.');
            }

            await addOrUpdateSetting({
                type: GOOGLE_REFRESH_TOKEN_TYPE,
                value: refreshToken,
            });

            return refreshToken;
        }
        throw new Error('User reauthentication failed or was cancelled.');
    } catch (error) {
        console.error('Error reauthenticating user:', error);
        throw error;
    }
};

/**
 * Retrieve a valid access token (refresh if expired)
 */
export const getAccessToken = async (): Promise<string> => {
    const accessToken = await AsyncStorage.getItem(GOOGLE_ACCESS_TOKEN);
    const tokenExpirationTime = await AsyncStorage.getItem(GOOGLE_ACCESS_TOKEN_EXPIRATION_DATE);

    if (accessToken && tokenExpirationTime && new Date().getTime() < parseInt(tokenExpirationTime, 10)) {
        return accessToken;
    }

    return await refreshAccessToken();
};

/**
 * Save tokens and user info after sign-in
 */
export const handleGoogleSignIn = async (
    response: AuthSessionResult | null
): Promise<GoogleUserInfo | null> => {
    if (response?.type === 'success' && response.authentication) {
        const { accessToken, expiresIn, refreshToken } = response.authentication;

        await AsyncStorage.setItem(GOOGLE_ACCESS_TOKEN, accessToken);
        if (refreshToken) {
            await addOrUpdateSetting({
                type: GOOGLE_REFRESH_TOKEN_TYPE,
                value: refreshToken,
            });

            await addOrUpdateSetting({
                type: GOOGLE_OAUTH_GEMINI_ENABLED_TYPE,
                value: 'true',
            });

            await addOrUpdateSetting({
                type: AI_SETTINGS_TYPE,
                value: 'true',
            });
        }

        const expirationTime = new Date().getTime() + (expiresIn ?? 0) * 1000;
        await AsyncStorage.setItem(GOOGLE_ACCESS_TOKEN_EXPIRATION_DATE, expirationTime.toString());

        const userInfo = await getUserInfo(accessToken);
        if (userInfo) {
            await AsyncStorage.setItem(GOOGLE_USER_INFO, JSON.stringify(userInfo));
        }

        return userInfo;
    }
    throw new Error('Google sign-in failed or cancelled.');
};

/**
 * Delete all stored tokens and user info
 */
export const deleteAllData = async (): Promise<void> => {
    await addOrUpdateSetting({
        type: GOOGLE_REFRESH_TOKEN_TYPE,
        value: '',
    });

    await addOrUpdateSetting({
        type: GOOGLE_OAUTH_GEMINI_ENABLED_TYPE,
        value: 'false',
    });

    await AsyncStorage.multiRemove([GOOGLE_USER_INFO, GOOGLE_ACCESS_TOKEN, GOOGLE_ACCESS_TOKEN_EXPIRATION_DATE]);
};
