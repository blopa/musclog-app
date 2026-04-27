export type OcrLanguageCode =
  | 'auto'
  | 'chi_sim'
  | 'chi_tra'
  | 'deu'
  | 'eng'
  | 'fra'
  | 'jpn'
  | 'kor'
  | 'nld'
  | 'por'
  | 'rus'
  | 'spa';

export function mapAppLanguageToOcrLanguage(appLanguage?: string): OcrLanguageCode {
  const normalized = appLanguage?.toLowerCase().replace('_', '-') ?? 'en-us';

  if (normalized.startsWith('pt')) {
    return 'por';
  }

  if (normalized.startsWith('es')) {
    return 'spa';
  }

  if (normalized.startsWith('nl')) {
    return 'nld';
  }

  if (normalized.startsWith('de')) {
    return 'deu';
  }

  if (normalized.startsWith('fr')) {
    return 'fra';
  }

  if (normalized.startsWith('ru')) {
    return 'rus';
  }

  if (normalized.startsWith('ja')) {
    return 'jpn';
  }

  if (normalized.startsWith('ko')) {
    return 'kor';
  }

  if (
    normalized === 'zh-tw' ||
    normalized === 'zh-hk' ||
    normalized === 'zh-mo' ||
    normalized.startsWith('zh-hant')
  ) {
    return 'chi_tra';
  }

  if (normalized.startsWith('zh')) {
    return 'chi_sim';
  }

  return 'eng';
}
