import i18n from '@/lang/lang';
import { captureException } from '@/utils/sentry';
import * as Updates from 'expo-updates';
import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { Button, Text } from 'react-native-paper';

interface Props {
    children: React.ReactNode;
}

interface State {
    error: Error | null;
    hasError: boolean;
}

class CustomErrorBoundary extends React.Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { error: null, hasError: false };
    }

    static getDerivedStateFromError(error: Error) {
        return { error, hasError: true };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error('Uncaught error:', error, errorInfo);
        captureException(error);
    }

    handleReset = async () => {
        this.setState({ error: null, hasError: false });
        try {
            await Updates.reloadAsync();
        } catch (e) {
            console.error('Failed to reload the app:', e);
        }
    };

    render() {
        if (this.state.hasError) {
            return (
                <View style={styles.container}>
                    <Image source={require('../assets/images/gym-closed.png')} style={styles.image} />
                    <Text>{i18n.t('something_went_wrong')}</Text>
                    {__DEV__ && this.state.error && (
                        <Text style={styles.error}>{this.state.error.toString()}</Text>
                    )}
                    <Button mode="contained" onPress={this.handleReset}>
                        {i18n.t('try_again')}
                    </Button>
                </View>
            );
        }

        return this.props.children;
    }
}

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        flex: 1,
        justifyContent: 'center',
        padding: 20,
    },
    error: {
        color: 'red',
        fontSize: 14,
        marginBottom: 20,
    },
    image: {
        marginBottom: 20,
        maxHeight: '40%',
        width: '80%',
    },
});

export default CustomErrorBoundary;
