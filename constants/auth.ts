// Google OAuth Configuration
export const GOOGLE_CLIENT_ID_MOBILE =
  '182653769964-letucboq7c5m25ckvgp9kuirrdm33fkc.apps.googleusercontent.com';
export const GOOGLE_CLIENT_ID_WEB =
  '182653769964-19v2egl06jrj6650ci08bj97qeq5ilon.apps.googleusercontent.com';

// Redirect URIs
export const GOOGLE_REDIRECT_URI_MOBILE = 'com.werules.logger://';

// OAuth Scopes
export const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/cloud-vision',
  'https://www.googleapis.com/auth/generative-language.retriever',
  // 'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
].join(' ');

// Setting Types (stored in WatermelonDB)
export const GOOGLE_REFRESH_TOKEN_TYPE = 'google_refresh_token_type';
export const GOOGLE_OAUTH_GEMINI_ENABLED_TYPE = 'google_oauth_gemini_enabled_type';
export const AI_SETTINGS_TYPE = 'ai_settings_type';

// AsyncStorage Keys (for short-lived tokens)
export const GOOGLE_ACCESS_TOKEN = 'googleAccessToken';
export const GOOGLE_ACCESS_TOKEN_EXPIRATION_DATE = 'googleAccessTokenExpirationDate';
export const LAST_TIME_GOOGLE_AUTH_ERROR_WAS_SHOWN = 'lastTimeGoogleAuthErrorWasShown';
export const HAS_COMPLETED_ONBOARDING = 'hasCompletedOnboarding';

// Onboarding Keys
export const ONBOARDING_COMPLETED = 'onboardingCompleted';
export const ONBOARDING_VERSION = 'onboardingVersion';
export const CURRENT_ONBOARDING_VERSION = '1.0.0';
