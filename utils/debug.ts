import { getAllDataFromTables, getTableNames } from '@/utils/database';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Alert } from 'react-native';

export const dumpDatabase = async (): Promise<string> => {
    try {
        const tableNames = await getTableNames();
        return await getAllDataFromTables(tableNames);
    } catch (error) {
        throw error;
    }
};

const handleDumpDatabase = async () => {
    try {
        const dump = await dumpDatabase();
        const fileUri = `${FileSystem.documentDirectory}database-dump.json`;
        await FileSystem.writeAsStringAsync(fileUri, dump, { encoding: FileSystem.EncodingType.UTF8 });

        Alert.alert(
            'Database Dumped',
            'The database has been successfully dumped. You can now share the file.',
            [
                {
                    onPress: async () => {
                        if (!(await Sharing.isAvailableAsync())) {
                            Alert.alert('Error', 'Sharing is not available on this device');
                            return;
                        }
                        await Sharing.shareAsync(fileUri);
                    },
                    text: 'Share',
                },
                { style: 'cancel', text: 'OK' },
            ]
        );
    } catch (error) {
        console.error('Failed to dump the database:', error);
        Alert.alert('Error', 'Failed to dump the database');
    }
};