import { normalizeText } from '@/utils/string';
import {
    MusclogApiFoodInfoType,
    PaginatedOpenFoodFactsApiFoodInfoType,
    PaginatedOpenFoodFactsApiFoodProductInfoType,
} from '@/utils/types';

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
    try {
        const response = await fetch(
            `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&page=${page}&search_simple=1&json=1`
        );

        if (response.ok) {
            const data: PaginatedOpenFoodFactsApiFoodInfoType = await response.json();

            if (data.products.length === 0) {
                const normalizedQuery = normalizeText(query.slice(0, 10));

                const apiPath = [...normalizedQuery].reduce((acc, char) => {
                    return `${acc}/${char}`;
                }, '');

                const response = await fetch(
                    `https://raw.githubusercontent.com/blopa/musclog-api/refs/heads/gh-pages/title/${apiPath}/index.json`
                );

                if (response.ok) {
                    const data: MusclogApiFoodInfoType[] = await response.json();

                    return {
                        pageCount: 1,
                        products: data,
                    };
                }

                return {
                    pageCount: 1,
                    products: [],
                };
            }

            return {
                pageCount: data.page_count,
                products: data.products.map(mapProductData),
            };
        } else {
            console.error('Failed to fetch food items:', response.statusText);
            return {
                pageCount: 1,
                products: [],
            };
        }
    } catch (error) {
        console.error('Error fetching food items:', error);
        return {
            pageCount: 1,
            products: [],
        };
    }
};

export const fetchProductByEAN = async (ean: string): Promise<MusclogApiFoodInfoType | null> => {
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
