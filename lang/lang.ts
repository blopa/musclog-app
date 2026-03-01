import 'intl-pluralrules';

import {
  enUS as localeEnUS,
  // es as localeEs,
  // nl as localeNl,
  // ptBR as localePtBR,
} from 'date-fns/locale';
import * as Localization from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// en-us
import enUsAccessToken from './locales/en-us/access_token.json';
import enUsAddMeal from './locales/en-us/addMeal.json';
import enUsBodyFat from './locales/en-us/body_fat.json';
import enUsBodyMetrics from './locales/en-us/bodyMetrics.json';
import enUsCamera from './locales/en-us/camera.json';
import enUsCoach from './locales/en-us/coach.json';
import enUsCommon from './locales/en-us/common.json';
import enUsConnectGoogleAccount from './locales/en-us/connectGoogleAccount.json';
import enUsCreateWorkout from './locales/en-us/createWorkout.json';
import enUsCurrentGoalsCard from './locales/en-us/currentGoalsCard.json';
import enUsDailySummaryCard from './locales/en-us/dailySummaryCard.json';
import enUsDatePicker from './locales/en-us/datePicker.json';
import enUsEatingPhaseBadge from './locales/en-us/eatingPhaseBadge.json';
import enUsEditFitnessDetails from './locales/en-us/editFitnessDetails.json';
import enUsEditPersonalInfo from './locales/en-us/editPersonalInfo.json';
import enUsEditScreenInfo from './locales/en-us/editScreenInfo.json';
import enUsEditSetDetails from './locales/en-us/editSetDetails.json';
import enUsEmptyStates from './locales/en-us/emptyStates.json';
import enUsEndWorkout from './locales/en-us/endWorkout.json';
import enUsErrorDescription from './locales/en-us/error_description.json';
import enUsErrors from './locales/en-us/errors.json';
import enUsExercises from './locales/en-us/exercises.json';
import enUsExerciseTransition from './locales/en-us/exerciseTransition.json';
import enUsExpiresIn from './locales/en-us/expires_in.json';
import enUsFood from './locales/en-us/food.json';
import enUsFoodFoodPortions from './locales/en-us/food_food_portions.json';
import enUsFoodSearch from './locales/en-us/foodSearch.json';
import enUsGoalHistoryCard from './locales/en-us/goalHistoryCard.json';
import enUsGoalsManagement from './locales/en-us/goalsManagement.json';
import enUsHealthConnect from './locales/en-us/healthConnect.json';
import enUsHome from './locales/en-us/home.json';
import enUsLogSetPerformance from './locales/en-us/logSetPerformance.json';
import enUsMealFoods from './locales/en-us/meal_foods.json';
import enUsMeals from './locales/en-us/meals.json';
import enUsNotifications from './locales/en-us/notifications.json';
import enUsNutrition from './locales/en-us/nutrition.json';
import enUsNutritionLogs from './locales/en-us/nutrition_logs.json';
import enUsNutritionGoals from './locales/en-us/nutritionGoals.json';
import enUsOnboarding from './locales/en-us/onboarding.json';
import enUsOptionsSelector from './locales/en-us/optionsSelector.json';
import enUsPastWorkoutHistory from './locales/en-us/pastWorkoutHistory.json';
import enUsPortionSizes from './locales/en-us/portionSizes.json';
import enUsProfile from './locales/en-us/profile.json';
import enUsReplaceExercise from './locales/en-us/replaceExercise.json';
import enUsRestOver from './locales/en-us/restOver.json';
import enUsRestTimer from './locales/en-us/restTimer.json';
import enUsSessionFeedback from './locales/en-us/sessionFeedback.json';
import enUsSettings from './locales/en-us/settings.json';
import enUsSnackbar from './locales/en-us/snackbar.json';
import enUsStartWorkout from './locales/en-us/startWorkout.json';
import timePicker from './locales/en-us/timePicker.json';
import enUsTokenType from './locales/en-us/token_type.json';
import enUsUserMenu from './locales/en-us/userMenu.json';
import enUsWorkout from './locales/en-us/workout.json';
import enUsWorkoutLogSets from './locales/en-us/workout_log_sets.json';
import enUsWorkoutLogs from './locales/en-us/workout_logs.json';
import enUsWorkoutTemplateSets from './locales/en-us/workout_template_sets.json';
import enUsWorkoutDetail from './locales/en-us/workoutDetail.json';
import enUsWorkoutDetails from './locales/en-us/workoutDetails.json';
import enUsWorkoutHistory from './locales/en-us/workoutHistory.json';
import enUsWorkoutLog from './locales/en-us/workoutLog.json';
import enUsWorkoutOptions from './locales/en-us/workoutOptions.json';
import enUsWorkouts from './locales/en-us/workouts.json';
import enUsWorkoutSession from './locales/en-us/workoutSession.json';
import enUsWorkoutSummary from './locales/en-us/workoutSummary.json';
import enUsYourGoogleAuthExpiredReauth from './locales/en-us/your_google_auth_expired_reauth.json';

export const EN_US = 'en-US';
// export const ES_ES = 'es-ES';
// export const NL_NL = 'nl-NL';
// export const PT_BR = 'pt-BR';

const resources = {
  [EN_US]: {
    translation: {
      ...enUsCommon,
      ...enUsAccessToken,
      ...enUsAddMeal,
      ...enUsBodyFat,
      ...enUsBodyMetrics,
      ...enUsCamera,
      ...enUsCoach,
      ...enUsCreateWorkout,
      ...enUsCurrentGoalsCard,
      ...enUsDailySummaryCard,
      ...enUsEatingPhaseBadge,
      ...enUsEditFitnessDetails,
      ...enUsEditPersonalInfo,
      ...enUsEditScreenInfo,
      ...enUsEditSetDetails,
      ...enUsEmptyStates,
      ...enUsEndWorkout,
      ...enUsErrorDescription,
      ...enUsErrors,
      ...enUsExercises,
      ...enUsExerciseTransition,
      ...enUsExpiresIn,
      ...enUsFoodFoodPortions,
      ...enUsFood,
      ...enUsFoodSearch,
      ...enUsGoalHistoryCard,
      ...enUsGoalsManagement,
      ...enUsHealthConnect,
      ...enUsHome,
      ...enUsLogSetPerformance,
      ...enUsMealFoods,
      ...enUsMeals,
      ...enUsNotifications,
      ...enUsNutritionGoals,
      ...enUsNutrition,
      ...enUsNutritionLogs,
      ...enUsOnboarding,
      ...enUsOptionsSelector,
      ...enUsPastWorkoutHistory,
      ...enUsPortionSizes,
      ...enUsProfile,
      ...enUsReplaceExercise,
      ...enUsRestOver,
      ...enUsRestTimer,
      ...enUsSessionFeedback,
      ...enUsSettings,
      ...enUsSnackbar,
      ...enUsStartWorkout,
      ...enUsTokenType,
      ...enUsUserMenu,
      ...enUsWorkout,
      ...enUsWorkoutDetail,
      ...enUsWorkoutDetails,
      ...enUsWorkoutHistory,
      ...enUsWorkoutLog,
      ...enUsWorkoutLogSets,
      ...enUsWorkoutLogs,
      ...enUsWorkoutOptions,
      ...enUsWorkoutSession,
      ...enUsWorkoutSummary,
      ...enUsWorkouts,
      ...enUsWorkoutTemplateSets,
      ...enUsYourGoogleAuthExpiredReauth,
      ...enUsConnectGoogleAccount,
      ...enUsDatePicker,
      ...timePicker,
    },
  },
  // [ES_ES]: { translation: es },
  // [NL_NL]: { translation: nl },
  // [PT_BR]: { translation: ptBR },
};

export type LanguageKeys = keyof typeof resources;

export const LOCALE_MAP = {
  [EN_US]: localeEnUS,
  // [ES_ES]: localeEs,
  // [NL_NL]: localeNl,
  // [PT_BR]: localePtBR,
};

export const AVAILABLE_LANGUAGES = Object.keys(resources) as LanguageKeys[];

const systemLocales = Localization.getLocales();

i18n.use(initReactI18next).init({
  // compatibilityJSON: 'v3',
  // debug: true,
  fallbackLng: EN_US,
  interpolation: {
    escapeValue: false,
  },
  lng:
    systemLocales.find((locale) => AVAILABLE_LANGUAGES.includes(locale.languageTag as LanguageKeys))
      ?.languageTag || EN_US,
  resources,
});

export default i18n;
