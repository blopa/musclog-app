import {
    GoogleFormFoodType,
} from '@/utils/types';
import { fetch } from 'expo/fetch';
import { read, utils } from 'xlsx';

export const fetchFoodSpreadsheet = async (): Promise<GoogleFormFoodType[] | null> => {
    try {
        const response = await fetch(
            'https://docs.google.com/spreadsheets/d/e/2PACX-1vTYLaltSaS2LdWXbApHjpnLbD5ImC2_adKAAkn-Djykegi2OdNOAdtxt0mO7gbAJa5VaLRBVXxbmjNK/pub?output=xlsx'
        );

        const blob = await response.blob();

        const workbook = read(await blob.arrayBuffer(), { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const foodSpreadsheetData: GoogleFormFoodType[] = utils.sheet_to_json(workbook.Sheets[sheetName], { raw: false });

        return foodSpreadsheetData;
    } catch (error) {
        console.error('Error fetching food spreadsheet:', error);
    }

    return null;
};
