import exercisesEnUSData from '@/data/exercisesEnUS.json';
import exercisesEsData from '@/data/exercisesEs.json';
import exercisesNlData from '@/data/exercisesNl.json';
import exercisesPtBRData from '@/data/exercisesPtBR.json';
import {
    enUS as localeEnUS,
    es as localeEs,
    nl as localeNl,
    ptBR as localePtBR,
} from 'date-fns/locale';
import * as Localization from 'expo-localization';
import i18n from 'i18next';
import 'intl-pluralrules';
import { initReactI18next } from 'react-i18next';

import enUs from './locales/en-us.json';
import es from './locales/es-es.json';
import nl from './locales/nl-nl.json';
import ptBR from './locales/pt-br.json';

export const EN_US = 'en-US';
export const ES_ES = 'es-ES';
export const NL_NL = 'nl-NL';
export const PT_BR = 'pt-BR';

const resources = {
    [EN_US]: { translation: enUs },
    [ES_ES]: { translation: es },
    [NL_NL]: { translation: nl },
    [PT_BR]: { translation: ptBR },
};

export const EXERCISES_DATA = {
    [EN_US]: exercisesEnUSData,
    [ES_ES]: exercisesEsData,
    [NL_NL]: exercisesNlData,
    [PT_BR]: exercisesPtBRData,
} as const;

export const getExerciseData = (lang: LanguageKeys) => EXERCISES_DATA[lang] || EXERCISES_DATA[EN_US];

export type LanguageKeys = keyof typeof resources;

export const LOCALE_MAP = {
    [EN_US]: localeEnUS,
    [ES_ES]: localeEs,
    [NL_NL]: localeNl,
    [PT_BR]: localePtBR,
};

export const AVAILABLE_LANGUAGES = Object.keys(resources) as LanguageKeys[];

const systemLocales = Localization.getLocales();

i18n
    .use(initReactI18next)
    .init({
        // compatibilityJSON: 'v3',
        // debug: true,
        fallbackLng: EN_US,
        interpolation: {
            escapeValue: false,
        },
        lng: systemLocales.find(
            (locale) => AVAILABLE_LANGUAGES.includes(locale.languageTag as LanguageKeys)
        )?.languageTag || EN_US,
        resources,
    });

export default i18n;
