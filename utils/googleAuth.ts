import { GOOGLE_REFRESH_TOKEN_TYPE } from '@/constants/storage';
import { addOrUpdateSetting, getSetting } from '@/utils/database';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthSessionResult } from 'expo-auth-session';

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
 * Fetch user info using the access token
 */
export const getUserInfo = async (token: string): Promise<GoogleUserInfo | null> => {
    if (!token) {
        return null;
    }

    try {
        const response = await fetch('https://www.googleapis.com/userinfo/v2/me', {
            headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) {
            throw new Error('Failed to fetch user info');
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
            const errorData = await response.json();
            if (errorData.error === 'invalid_grant') {
                throw new Error('Refresh token expired or invalid. Please sign in again.');
            }

            throw new Error(errorData.error || 'Failed to refresh access token');
        }

        const data = (await response.json()) as RefreshTokenResponse;

        // Save the new access token and expiration time
        await AsyncStorage.setItem('accessToken', data.access_token);
        const expirationTime = new Date().getTime() + data.expires_in * 1000;
        await AsyncStorage.setItem('tokenExpirationTime', expirationTime.toString());

        return data.access_token;
    } catch (error) {
        console.error('Error refreshing access token:', error);
        throw error;
    }
};

/**
 * Retrieve a valid access token (refresh if expired)
 */
export const getAccessToken = async (): Promise<string> => {
    const accessToken = await AsyncStorage.getItem('accessToken');
    const tokenExpirationTime = await AsyncStorage.getItem('tokenExpirationTime');

    if (accessToken && tokenExpirationTime && new Date().getTime() < parseInt(tokenExpirationTime, 10)) {
        return accessToken;
    }

    return await refreshAccessToken(); // Refresh token if expired
};

/**
 * Save tokens and user info after sign-in
 */
export const handleGoogleSignIn = async (
    response:  AuthSessionResult | null
): Promise<GoogleUserInfo | null> => {
    if (response?.type === 'success' && response.authentication) {
        const { accessToken, expiresIn, refreshToken } = response.authentication;

        await AsyncStorage.setItem('accessToken', accessToken);
        if (refreshToken) {
            await addOrUpdateSetting({
                type: GOOGLE_REFRESH_TOKEN_TYPE,
                value: refreshToken,
            });
        }

        const expirationTime = new Date().getTime() + (expiresIn ?? 0) * 1000;
        await AsyncStorage.setItem('tokenExpirationTime', expirationTime.toString());

        const userInfo = await getUserInfo(accessToken);
        if (userInfo) {
            await AsyncStorage.setItem('user', JSON.stringify(userInfo));
        }

        return userInfo;
    }
    throw new Error('Google sign-in failed or cancelled.');
};

/**
 * Delete all stored tokens and user info
 */
export const deleteAllData = async (): Promise<void> => {
    await AsyncStorage.multiRemove(['user', 'accessToken', 'tokenExpirationTime']);
};
