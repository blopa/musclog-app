import {
    AI_SETTINGS_TYPE,
    GEMINI_API_KEY_TYPE,
    GOOGLE_ACCESS_TOKEN,
    GOOGLE_ACCESS_TOKEN_EXPIRATION_DATE,
    GOOGLE_OAUTH_GEMINI_ENABLED_TYPE,
    GOOGLE_REFRESH_TOKEN_TYPE,
    LAST_TIME_GOOGLE_AUTH_ERROR_WAS_SHOWN,
} from '@/constants/storage';
import { GoogleAuthData } from '@/hooks/useGoogleAuth';
import i18n from '@/lang/lang';
import { isValidAccessToken } from '@/utils/ai';
import { showAlert } from '@/utils/alert';
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

const handleGoogleAuthError = async () => {
    const lastTimeRun = await AsyncStorage.getItem(LAST_TIME_GOOGLE_AUTH_ERROR_WAS_SHOWN);
    const today = (new Date()).toISOString().split('T')[0];

    if (lastTimeRun === today) {
        console.log('Error already shown today.');
        return;
    }

    showAlert(i18n.t('your_google_auth_expired_reauth'), i18n.t('ok'), () => {});
    await AsyncStorage.setItem(LAST_TIME_GOOGLE_AUTH_ERROR_WAS_SHOWN, today);
};

/**
 * Fetch user info using the access token.
 * Automatically refreshes the access token if the current one is invalid.
 */
// export const getUserInfo = async (token: string): Promise<GoogleUserInfo | null> => {
//     if (!token) {
//         throw new Error('Access token is missing.');
//     }
//
//     const makeRequest = async (accessToken: string) => {
//         return fetch('https://www.googleapis.com/userinfo/v2/me', {
//             headers: { Authorization: `Bearer ${accessToken}` },
//         });
//     };
//
//     try {
//         // First attempt
//         let response = await makeRequest(token);
//
//         if (response.status === 401) {
//             // Token is invalid, try refreshing it
//             console.warn('Access token is invalid. Attempting to refresh...');
//             const newAccessToken = await refreshAccessToken();
//
//             // Retry with the new access token
//             response = await makeRequest(newAccessToken);
//         }
//
//         if (!response.ok) {
//             throw new Error('Failed to fetch user info.');
//         }
//
//         return (await response.json()) as GoogleUserInfo;
//     } catch (error) {
//         console.error('Error fetching user info:', error);
//         throw error;
//     }
// };

/**
 * Refresh the access token using the stored refresh token
 */
export const refreshAccessToken = async (): Promise<string | undefined> => {
    const refreshToken = await getSetting(GOOGLE_REFRESH_TOKEN_TYPE);
    if (!refreshToken?.value) {
        await deleteAllData();
        // alert(i18n.t('please_reauthenticate_google'));
        // throw new Error('Refresh token is missing. Please sign in again.');
        handleGoogleAuthError();
        return;
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
                // throw new Error('Refresh token expired or invalid. Please sign in again.');
            }

            // throw new Error(errorData.error || 'Failed to refresh access token');
            handleGoogleAuthError();
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

        // console.error('Error refreshing access token:', error);
        // throw error;
    }
};

/**
 * Reauthenticate the user to get a new refresh token.
 */
export const reauthenticate = async (
    promptAsync: () => Promise<AuthSessionResult>
): Promise<string | undefined> => {
    try {
        const result = await promptAsync();
        if (result.type === 'success' && result.authentication) {
            const { refreshToken } = result.authentication;

            if (!refreshToken) {
                handleGoogleAuthError();
                return;
                // throw new Error('Failed to obtain a new refresh token. Please try again.');
            }

            await addOrUpdateSetting({
                type: GOOGLE_REFRESH_TOKEN_TYPE,
                value: refreshToken,
            });

            return refreshToken;
        }

        handleGoogleAuthError();
        // throw new Error('User reauthentication failed or was cancelled.');
    } catch (error) {
        // console.error('Error reauthenticating user:', error);
        // throw error;
        handleGoogleAuthError();
    }
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
    }

    return await refreshAccessToken();
};

/**
 * Save tokens and user info after sign-in
 */
export const handleGoogleSignIn = async (
    response: GoogleAuthData | null
): Promise<boolean> => {
    if (response) {
        const { access_token: accessToken, expires_in: expiresIn, refresh_token: refreshToken } = response;

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

        console.log('THE ACCESS TOKEN IS', accessToken);
        return isValidAccessToken(accessToken, GEMINI_API_KEY_TYPE);
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

    await AsyncStorage.multiRemove([GOOGLE_ACCESS_TOKEN, GOOGLE_ACCESS_TOKEN_EXPIRATION_DATE]);
};
