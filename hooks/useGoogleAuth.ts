import { GOOGLE_CLIENT_ID, handleGoogleSignIn } from '@/utils/googleAuth';
import { AuthRequestPromptOptions, AuthSessionResult } from 'expo-auth-session';
import { useAuthRequest } from 'expo-auth-session/providers/google';
import { AuthRequest } from 'expo-auth-session/src/AuthRequest';
import { useEffect, useState } from 'react';

interface UseGoogleAuthReturn {
    isSigningIn: boolean;
    promptAsync: (options?: AuthRequestPromptOptions) => Promise<AuthSessionResult>;
    request: AuthRequest | null; // should be GoogleAuthRequest, but it's not exported
    response: AuthSessionResult | null;
}

/**
 * Custom hook to handle Google OAuth sign-in flow.
 */
export const useGoogleAuth = (): UseGoogleAuthReturn => {
    const [isSigningIn, setIsSigningIn] = useState(false);

    const [request, response, promptAsync] = useAuthRequest({
        androidClientId: GOOGLE_CLIENT_ID,
        scopes: [
            'openid',
            'profile',
            'https://www.googleapis.com/auth/cloud-vision',
            'https://www.googleapis.com/auth/cloud-platform',
            'https://www.googleapis.com/auth/generative-language.retriever',
        ],
        webClientId: GOOGLE_CLIENT_ID,
    });

    useEffect(() => {
        const handleResponse = async () => {
            if (response?.type === 'success') {
                try {
                    setIsSigningIn(true);
                    await handleGoogleSignIn(response);
                } catch (error) {
                    console.error('Google sign-in failed:', error);
                } finally {
                    setIsSigningIn(false);
                }
            }
        };

        handleResponse();
    }, [response]);

    return { isSigningIn, promptAsync, request: request as unknown as AuthRequest, response };
};
