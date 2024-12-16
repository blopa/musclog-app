import i18n from 'i18next';

const getNumericSeparator = () => {
    // Get the current locale from i18n
    const locale = i18n.language;

    // Create an instance of Intl.NumberFormat for the current locale
    const formatter = new Intl.NumberFormat(locale);

    // Extract the decimal and grouping separators
    const parts = formatter.formatToParts(1234567.89);

    let decimalSeparator = '';
    let groupingSeparator = '';

    parts.forEach((part) => {
        if (part.type === 'decimal') {
            decimalSeparator = part.value;
        } else if (part.type === 'group') {
            groupingSeparator = part.value;
        }
    });

    return { decimalSeparator, groupingSeparator };
};

export const generateHash = (length: number = 32) => {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
    const charactersLength = characters.length;
    let result = '';

    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }

    return result;
};

export const normalizeName = (name: string): string => {
    return name.replace(/[\s\-.]/g, '').replace(/[^a-z0-9]/gi, '').toLowerCase();
};

export const safeToFixed = (num: number | string, digits: number = 2): string => {
    try {
        return (Number(num) || 0).toFixed(digits);
    } catch (error) {
        return num.toString();
    }
};

const formatFloatNumber = (number: string) => {
    const { decimalSeparator, groupingSeparator } = getNumericSeparator();
    const cleanedNumber = number.replace(new RegExp(`\\${groupingSeparator}`, 'g'), '');

    const parts = cleanedNumber.split(decimalSeparator);
    return parts.length > 1
        ? parts[0] + decimalSeparator + parts.slice(1).join('')
        : cleanedNumber;
};

export const formatFloatNumericInputText = (text: string) => {
    const { decimalSeparator } = getNumericSeparator();
    const regex = new RegExp(`^\\d*(?:\\${decimalSeparator}\\d*)?$`);
    if (regex.test(text) && text !== decimalSeparator) {
        return formatFloatNumber(text);
    }

    return null;
};

const formatIntegerNumber = (number: string) => {
    const { groupingSeparator } = getNumericSeparator();
    const cleanedNumber = number.replace(new RegExp(`\\${groupingSeparator}`, 'g'), '');

    return cleanedNumber.replace(/\D/g, '');
};

export const formatIntegerNumericInputText = (text: string) => {
    if (/^\d*$/.test(text)) {
        return formatIntegerNumber(text);
    }

    return null;
};

export const isString = (value: any): value is string => {
    return typeof value === 'string';
};

export const normalizeText = (text: string): string => {
    return text
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');
};

export const exerptlizeString = (text: string, length: number = 100): string => {
    return text.length > length ? `${text.substring(0, length)}...` : text;
};
