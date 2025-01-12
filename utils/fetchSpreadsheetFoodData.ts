import {
    GoogleFormFoodType,
} from '@/utils/types';
import { Buffer } from 'buffer';
import * as FileSystem from 'expo-file-system';
import { read, utils } from 'xlsx';

export const fetchFoodSpreadsheet = async (): Promise<GoogleFormFoodType[] | null> => {
    try {
        // Define the file path
        const fileUri = `${FileSystem.cacheDirectory}food_spreadsheet.xlsx`;

        // Download the file
        const { uri } = await FileSystem.downloadAsync(
            'https://docs.google.com/spreadsheets/d/e/2PACX-1vTYLaltSaS2LdWXbApHjpnLbD5ImC2_adKAAkn-Djykegi2OdNOAdtxt0mO7gbAJa5VaLRBVXxbmjNK/pub?output=xlsx',
            fileUri
        );

        // Read the file into a buffer
        const fileData = await FileSystem.readAsStringAsync(uri, {
            encoding: FileSystem.EncodingType.Base64,
        });

        // Decode Base64 to binary
        const binary = Buffer.from(fileData, 'base64');

        // Parse the Excel file
        const workbook = read(binary, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const foodSpreadsheetData: GoogleFormFoodType[] = utils.sheet_to_json(workbook.Sheets[sheetName], { raw: false });

        return foodSpreadsheetData;
    } catch (error) {
        console.error('Error fetching food spreadsheet:', error);
        return null;
    }
};
