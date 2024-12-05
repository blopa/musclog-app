import { getFoodByProductCode, searchFoodByName } from '@/utils/database';
import { normalizeText } from '@/utils/string';
import {
    GoogleFormFoodType,
    MusclogApiFoodInfoType,
    PaginatedOpenFoodFactsApiFoodInfoType,
    PaginatedOpenFoodFactsApiFoodProductInfoType,
} from '@/utils/types';
// import fetch from 'isomorphic-fetch';
import { fetch } from 'expo/fetch';
import { read, utils } from 'xlsx';

export const mapProductData = (product: PaginatedOpenFoodFactsApiFoodProductInfoType): MusclogApiFoodInfoType => {
    return {
        carbs: product.nutriments.carbohydrates_100g || 0,
        ean: product.code,
        fat: product.nutriments.fat_100g || 0,
        kcal: product.nutriments['energy-kcal_100g'] || 0,
        productTitle: product.product_name || 'Unknown Food',
        protein: product.nutriments.proteins_100g || 0,
    };
};

export const fetchFoodData = async (query: string, page: number): Promise<{ pageCount: number; products: MusclogApiFoodInfoType[], }> => {
    const result = {
        pageCount: 1,
        products: [] as MusclogApiFoodInfoType[],
    };

    try {
        if (page === 1) {
            const savedFood = await searchFoodByName(query);
            if (savedFood) {
                result.products = [
                    ...result.products,
                    ...savedFood.map((food) => ({
                        carbs: food.totalCarbohydrate,
                        ean: food.productCode,
                        fat: food.totalFat,
                        kcal: food.calories,
                        productTitle: food.name,
                        protein: food.protein,
                    })),
                ];
            }

            const foodFromSheet = await fetchFoodSpreadsheet();
            if (foodFromSheet) {
                result.products = [
                    ...result.products,
                    ...foodFromSheet.map((food) => ({
                        carbs: parseInt(food.total_carbohydrate, 10),
                        ean: food.product_code,
                        fat: parseInt(food.total_fat, 10),
                        kcal: parseInt(food.calories, 10),
                        productTitle: (food.name),
                        protein: parseInt(food.protein, 10),
                    })),
                ];
            }
        }

        const response = await fetch(
            `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&page=${page}&search_simple=1&json=1`
        );

        if (response.ok) {
            const data: PaginatedOpenFoodFactsApiFoodInfoType = await response.json();

            if (data.products.length === 0 && page === 1) {
                const normalizedQuery = normalizeText(query.slice(0, 10));

                const apiPath = [...normalizedQuery].reduce((acc, char) => {
                    return `${acc}/${char}`;
                }, '');

                const response = await fetch(
                    `https://raw.githubusercontent.com/blopa/musclog-api/refs/heads/gh-pages/title/${apiPath}/index.json`
                );

                if (response.ok) {
                    const data: MusclogApiFoodInfoType[] = await response.json();

                    result.products = [
                        ...result.products,
                        ...data,
                    ];
                }
            }

            result.pageCount = data.page_count;
            result.products = [
                ...result.products,
                ...data.products.map(mapProductData),
            ];
        } else {
            console.error('Failed to fetch food items:', response.statusText);
        }
    } catch (error) {
        console.error('Error fetching food items:', error);
    }

    return result;
};

export const fetchProductByEAN = async (ean: string): Promise<MusclogApiFoodInfoType | null> => {
    const savedFood = await getFoodByProductCode(ean);

    if (savedFood) {
        return {
            carbs: savedFood.totalCarbohydrate,
            ean: savedFood.productCode,
            fat: savedFood.totalFat,
            kcal: savedFood.calories,
            productTitle: savedFood.name,
            protein: savedFood.protein,
        };
    }

    try {
        const response = await fetch(
            `https://world.openfoodfacts.org/api/v0/product/${ean}.json`
        );

        if (response.ok) {
            const data = await response.json();
            if (data.status === 1) {
                return mapProductData(data.product as PaginatedOpenFoodFactsApiFoodProductInfoType);
            } else {
                const response = await fetch(
                    `https://raw.githubusercontent.com/blopa/musclog-api/ean/${ean}.json`
                );

                if (response.ok) {
                    const data: MusclogApiFoodInfoType = await response.json();
                    return data;
                }

                console.warn('Food not found');
                return null;
            }
        } else {
            console.error('Error fetching food:', response.statusText);
            return null;
        }
    } catch (error) {
        console.error('Error fetching product:', error);
        return null;
    }
};

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
