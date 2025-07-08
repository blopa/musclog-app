# 📂 File Structure for musclog-app (with descriptions)

The table below gives a quick, one-line description of the purpose of every source file that ships with the project.  
For assets (images, fonts, JSON fixtures, etc.) the description is given for the entire folder rather than repeating the same note hundreds of times.

| Path | Description |
|------|-------------|
| **.github/workflows/deploy-gh-pages.yml** | GitHub Action for deploying documentation / web preview to GitHub Pages |
| **app/_layout.tsx** | Expo Router custom root layout applied to every screen |
| **app/+html.tsx** | HTML template for web builds |
| **app/+not-found.tsx** | Fallback page shown for unknown routes |
| **app/aiSettings.tsx** | Screen that lets the user configure AI assistant settings |
| **app/chat.tsx** | In-app chat interface with the AI coach |
| **app/createExercise.tsx** | Screen form for adding a new exercise definition |
| **app/createFitnessGoals.tsx** | Screen wizard to create fitness/health goals |
| **app/createFood.tsx** | Screen form for adding a custom food item |
| **app/createRecentWorkout.tsx** | Screen for logging a quick workout session |
| **app/createUserMeasurements.tsx** | Screen for entering body measurements (waist, hips, etc.) |
| **app/createUserMetrics.tsx** | Screen for entering miscellaneous user metrics (steps, HRV…) |
| **app/createUserNutrition.tsx** | Screen for logging a meal manually |
| **app/createWorkout.tsx** | Screen for composing a structured workout plan |
| **app/dashboard.tsx** | Main dashboard with high-level stats and shortcuts |
| **app/foodDetails.tsx** | Detailed nutritional information for a single food |
| **app/foodLog.tsx** | Daily food log; lists meals & shows macro summary |
| **app/foodSearch.tsx** | Search page that queries branded food database |
| **app/index.tsx** | Landing screen (today view) |
| **app/listExercises.tsx** | List of all user-created and built-in exercises |
| **app/listFitnessGoals.tsx** | List & edit user fitness goals |
| **app/listUserMeasurements.tsx** | Table of historical body measurements |
| **app/listUserMetrics.tsx** | Table of generic numeric metrics (steps, HRV…) |
| **app/listUserNutrition.tsx** | Table of meals logged in a date range |
| **app/listWorkouts.tsx** | List of saved workout plans |
| **app/oneRepMaxes.tsx** | Calculator & history for one-rep-max estimates |
| **app/profile.tsx** | User profile & account settings |
| **app/recentWorkoutDetails.tsx** | Details of a recently completed workout |
| **app/recentWorkouts.tsx** | Timeline of past workouts |
| **app/scheduleWorkout.tsx** | Calendar interface to schedule future workouts |
| **app/settings.tsx** | Global application settings screen |
| **app/test.tsx** | Miscellaneous playground screen (dev only) |
| **app/upcomingWorkouts.tsx** | List of planned upcoming workouts |
| **app/userMetricsCharts.tsx** | Chart visualisations of user metrics |
| **app/workout.tsx** | Active workout tracking screen |
| **app/workoutDetails.tsx** | Details for a stored workout plan |
| **assets/** | Static assets (exercise images, icons, fonts, splash screens, etc.) |
| **components/** | Re-usable UI components & widgets (charts, modals, pickers, etc.) |
| **constants/** | Centralised constant values (colors, units, API endpoints…) |
| **data/** | Sample JSON datasets & fixtures used in dev/tests |
| **hooks/** | React hooks (stateful utilities such as timers, auth, unit conversion) |
| **lang/** | i18n translation files and language helper |
| **scripts/** | Node scripts for maintenance (generating assets, checking translations, DB utilities) |
| **storage/** | React context providers wrapping AsyncStorage/SQLite/Health Connect |
| **utils/** | Pure helper libraries (date, string, AI wrappers, DB abstraction, etc.) |
| **withAuthAndroidFix.js** | Expo config-plugin that injects the AppAuth redirect scheme into Gradle |
| **withCustomGradleConfig.js** | Config-plugin to append custom Gradle blocks |
| **withCustomManifest.js** | Config-plugin to modify AndroidManifest.xml before build |
| **withNotifeeAndroidFix.js** | Workaround plugin for Notifee manifest placeholders |
| **generate-file-structure.js** | Node script that writes `file-structure.md` by scanning the repo |
| **playwright.config.js** | End-to-end test runner configuration |
| **tsconfig.json** | TypeScript compiler options |
| **eslint.config.js** | Shared ESLint ruleset |
| **eas.json** | EAS Build & Submit configuration |
| **app.json** | Expo project configuration (app name, icons, splash, etc.) |
| **README.md** | Project overview and setup instructions |
| **dev-notes.md** | Misc developer notes and todos |
| **.env** | Environment variables (NOT committed in reality) |
| Other root dot-files (`.gitignore`, `.nvmrc`, etc.) | Standard tooling configuration |

*For any file or directory that is not self-explanatory and lacks a description above, it has been marked implicitly as a standard asset or helper.  
If deeper detail is needed for a particular path just let me know and I can expand it.*
