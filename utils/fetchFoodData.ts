import { getFoodByProductCode, searchFoodByName } from '@/utils/database';
import { fetchFoodSpreadsheet } from '@/utils/fetchSpreadsheetFoodData';
import { normalizeText } from '@/utils/string';
import {
    MusclogApiFoodInfoType,
    PaginatedOpenFoodFactsApiFoodInfoType,
    PaginatedOpenFoodFactsApiFoodProductInfoType,
} from '@/utils/types';
import { fetch } from 'expo/fetch';
import i18n from 'i18next';

export const mapProductData = (product: PaginatedOpenFoodFactsApiFoodProductInfoType): MusclogApiFoodInfoType => {
    return {
        carbs: product.nutriments.carbohydrates_100g || 0,
        ean: product.code,
        fat: product.nutriments.fat_100g || 0,
        kcal: product.nutriments['energy-kcal_100g'] || 0,
        productTitle:
            product.product_name
            || product.product_name_en
            || product.product_name_de
            || product.product_name_fr
            || product.product_name_es
            || product.product_name_it
            || product.product_name_sr
            || product.product_name_pt
            || product.product_name_nl
            || product.product_name_pl
            || product.product_name_sv
            || product.product_name_cs
            || product.product_name_hu
            || product.product_name_hr
            || product.product_name_sk
            || product.product_name_sl
            || product.product_name_lt
            || product.product_name_lv
            || product.product_name_et
            || product.product_name_el
            || product.product_name_bg
            || product.product_name_ro
            || product.product_name_da
            || product.product_name_fi
            || product.product_name_mt
            || product.product_name_tr
            || product.product_name_ar
            || product.product_name_zh
            || product.product_name_ja
            || product.product_name_ko
            || product.product_name_he
            || product.product_name_id
            || product.product_name_th
            || product.product_name_vi
            || product.product_name_cz
            || product.product_name_br
            || product.product_name_ca
            || product.product_name_gl
            || product.product_name_eu
            || product.product_name_ru
            || product.product_name_sr
            || product.product_name_uk
            || product.product_name_be
            || product.product_name_mk
            || product.product_name_bs
            || product.product_name_is
            || product.product_name_ga
            || product.product_name_sq
            || product.product_name_hy
            || product.product_name_ka
            || product.product_name_az
            || product.product_name_uz
            || product.product_name_kk
            || product.product_name_tg
            || product.product_name_tk
            || product.product_name_mn
            || product.product_name_hy
            || product.product_name_si
            || product.product_name_am
            || product.product_name_ti
            || product.product_name_or
            || product.product_name_my
            || product.product_name_kh
            || product.product_name_lo
            || product.product_name_vi
            || product.product_name_tl
            || product.product_name_jw
            || product.product_name_su
            || product.product_name_ms
            || product.product_name_ha
            || product.product_name_sw
            || product.product_name_so
            || product.product_name_st
            || product.product_name_zu
            || product.product_name_xh
            || product.product_name_nso
            || product.product_name_tn
            || product.product_name_ss
            || product.product_name_ve
            || product.product_name_af
            || product.product_name_nr
            || product.product_name_dv
            || product.product_name_sq
            || product.product_name_bs
            || product.product_name_hr
            || product.product_name_sl
            || product.product_name_sk
            || product.product_name_cs
            || product.product_name_hu
            || product.product_name_ro
            || product.product_name_bg
            || product.product_name_el
            || product.product_name_et
            || product.product_name_lv
            || product.product_name_lt
            || product.product_name_mt
            || product.product_name_fi
            || product.product_name_da
            || product.product_name_nl
            || product.product_name_pt
            || product.product_name_pl
            || i18n.t('unknown_food'),
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
