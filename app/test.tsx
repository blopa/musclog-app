import { useGoogleAuth } from '@/hooks/useGoogleAuth';
import {
    deleteAllData,
    getAccessToken,
    GoogleUserInfo,
    handleGoogleSignIn,
    refreshAccessToken,
} from '@/utils/googleAuth';
import * as WebBrowser from 'expo-web-browser';
import React, { useEffect, useState } from 'react';
import { Button, ScrollView, StyleSheet, Text, View } from 'react-native';

WebBrowser.maybeCompleteAuthSession();

export default function App() {
    const [userInfo, setUserInfo] = useState<GoogleUserInfo | null>(null);
    const [responseData, setResponseData] = useState<null | string>(null);
    const [error, setError] = useState<null | string>(null);

    const { promptAsync, request, response } = useGoogleAuth();

    const callGeminiApi = async (): Promise<void> => {
        try {
            const accessToken = await getAccessToken();

            const result = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent', {
                body: JSON.stringify({
                    'contents': [{ 'parts': [{ 'text': 'Generate a motivational sentence :)' }], 'role': 'user' }],
                    'generationConfig': { 'temperature': 0.9, topK: 1, topP: 1 },
                }),
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
                method: 'POST',
            });

            if (!result.ok) {
                const errorData = await result.json();
                throw new Error(errorData.error?.message || 'Unknown error occurred');
            }

            const data = await result.json();
            setResponseData(data.candidates?.[0]?.content?.parts[0]?.text || 'No response from Gemini API');
        } catch (err) {
            console.error('Gemini API call failed:', err);
            // @ts-ignore
            setError(err?.message || '');
        }
    };

    const signIn = async (): Promise<void> => {
        try {
            const user = await handleGoogleSignIn(response!);
            setUserInfo(user);
        } catch (err) {
            console.error('Sign-in failed:', err);
            alert('Sign-in failed. Please try again.');
        }
    };

    const getNewAccessToken = async (): Promise<void> => {
        try {
            const newAccessToken = await refreshAccessToken();
            alert(`New Access Token: ${newAccessToken}`);
        } catch (error) {
            console.error('Error refreshing access token manually:', error);
        }
    };

    useEffect(() => {
        if (response) {
            signIn();
        }
    }, [response, signIn]);

    return (
        <ScrollView contentContainerStyle={styles.container}>
            <Button onPress={getNewAccessToken} title="Get New Access Token" />
            <Button onPress={deleteAllData} title="Delete All Data" />
            {userInfo ? (
                <View style={styles.info}>
                    <Text style={styles.title}>Welcome, {userInfo.name}</Text>
                    <Text>Email: {userInfo.email}</Text>
                    <Button onPress={callGeminiApi} title="Call Gemini API" />
                </View>
            ) : (
                <Button disabled={!request} onPress={() => promptAsync()} title="Sign in with Google" />
            )}
            {responseData && (
                <View style={styles.result}>
                    <Text style={styles.title}>Gemini API Response:</Text>
                    <Text>{responseData}</Text>
                </View>
            )}
            {error && (
                <View style={styles.error}>
                    <Text style={styles.errorText}>Error: {error}</Text>
                </View>
            )}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
    },
    error: {
        backgroundColor: '#ffcccc',
        borderRadius: 8,
        marginTop: 20,
        padding: 15,
    },
    errorText: {
        color: '#cc0000',
    },
    info: {
        alignItems: 'center',
        marginBottom: 20,
    },
    result: {
        backgroundColor: '#f0f0f0',
        borderRadius: 8,
        marginTop: 20,
        padding: 15,
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
    },
});
