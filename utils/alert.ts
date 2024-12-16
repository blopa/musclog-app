import { UNREAD_MESSAGES_COUNT } from '@/constants/storage';
import i18n from '@/lang/lang';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';

export const showAlert = (
    message: string,
    buttonText: string = i18n.t('ok'),
    onPress: () => void = () => {}
) => {
    // @ts-ignore it's fine
    if (global?.showSnackbar) {
        // @ts-ignore it's fine
        global.showSnackbar(message, buttonText, onPress);
    } else {
        Alert.alert(message);
    }
};

export const increaseUnreadMessages = async (count: number) => {
    // @ts-ignore it's fine
    if (global?.increaseUnreadMessages) {
        // @ts-ignore it's fine
        global.increaseUnreadMessages(count);
    } else {
        const currentCount = (await AsyncStorage.getItem(UNREAD_MESSAGES_COUNT)) || '0';
        await AsyncStorage.setItem(UNREAD_MESSAGES_COUNT, (parseInt(currentCount, 10) + count).toString());
    }
};
