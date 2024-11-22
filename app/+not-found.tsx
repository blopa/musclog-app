import { Screen } from '@/components/Screen';
import { Link, Stack } from 'expo-router';
import React from 'react';
import { StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';

export default function NotFoundScreen() {
    return (
        <>
            <Stack.Screen options={{ title: 'Oops!' }} />
            <Screen style={styles.container}>
                <Text>{"This screen doesn't exist."}</Text>
                <Link href="/" style={styles.link}>
                    <Text>Go to home screen!</Text>
                </Link>
            </Screen>
        </>
    );
}

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        flexGrow: 1,
        justifyContent: 'center',
        padding: 20,
    },
    link: {
        marginTop: 15,
        paddingVertical: 15,
    },
});
