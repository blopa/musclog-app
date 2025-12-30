import Constants from 'expo-constants';
import * as Linking from 'expo-linking';

export const openPlayStore = async () => {
    const packageName = Constants.expoConfig?.android?.package;

    if (!packageName) {
        return;
    }

    const playStoreUrl = `market://details?id=${packageName}`;
    const webUrl = `https://play.google.com/store/apps/details?id=${packageName}`;

    try {
        await Linking.openURL(playStoreUrl);
    } catch (_) {
        await Linking.openURL(webUrl);
    }
};
