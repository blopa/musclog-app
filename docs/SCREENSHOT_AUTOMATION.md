# Screenshot Automation Pipeline

This project includes a robust, automated pipeline for generating consistent, marketing-ready screenshots across multiple application screens. The pipeline leverages a deterministic data seeding mechanism and Playwright to capture high-fidelity images from the React Native Web build.

## Prerequisites

- **Node.js 18+**
- **Expo CLI** (`npm install -g expo-cli`)
- **Playwright Browsers** (`npx playwright install chromium`)

## Architecture

1.  **Deterministic Seeding:** The app's `seedDevData` (in `database/seeders/dev.ts`) is triggered by passing `demoModeEnabled=true` as a URL parameter. This populates the app with a specific set of workouts, nutrition logs, and user metrics, ensuring every screenshot run results in identical content.
2.  **Web-Based Automation:** The pipeline targets the production Web build of the app. This is significantly faster and more stable for automated capture than running an Android or iOS emulator.
3.  **Orchestration:** A custom runner (`tests/run-tests.js`) handles:
    - Starting a local server that mimics the production environment (including SPA routing fallbacks).
    - Managing the `/musclog-app/` base path.
    - Executing the Playwright test suite.
    - Cleaning up resources after completion.

## How to Run

### 1. Build the Web App
Before running the pipeline, you must export the latest version of the application:
```bash
npm run build-android-web
```
This generates the `dist/` directory.

### 2. Run the Automation
Execute the following command to start the server and capture screenshots:
```bash
npm run playwright
```

The screenshots will be saved to: `screenshots/automated/*.png`.

## Captured Screens

The pipeline automatically navigates to and captures the following:

1.  **Landing:** The initial onboarding entry point.
2.  **Dashboard:** The main home screen showing recent activity and current goals.
3.  **Workouts:** The list of exercise routines.
4.  **Active Session:** The live workout tracker with exercise sets and checkboxes.
5.  **Rest Timer:** The countdown interface between workout sets.
6.  **Workout Summary:** The post-workout results and volume breakdown.
7.  **Progress:** Volume evolution and user metric charts.
8.  **User Metrics History:** Detailed historical data modal for a specific metric.
9.  **Nutrition:** Daily calorie and macro tracking.
10. **Food Details:** Micronutrient and serving size modal for a specific food.
11. **Food Creation:** The custom food entry form.
12. **Coach (Chat):** AI-powered fitness coaching interface.
13. **Menstrual Cycle:** Dedicated tracking and phase analysis.
14. **Profile:** User stats and personal information.
15. **Settings:** Application preferences and advanced configuration.

## Customizing the Capture

The capture logic is defined in `tests/screenshot-automation.spec.ts`. You can modify the `takeScreenshot` helper or the navigation flow to:
- Adjust the wait times (`page.waitForTimeout`).
- Capture specific modal states or interactions.
- Change the output directory or naming convention.

## Marketing Asset Generation (Conceptual Remotion Workflow)

Once the screenshots are generated, they can be used as sources for **Remotion**. Remotion allows you to:
1.  Import these screenshots into React components.
2.  Layer them into high-resolution device frames (iPhone/Android shells).
3.  Add marketing copy and brand backgrounds dynamically.
4.  Export them as high-quality PNGs or animated social media videos.

To integrate with Remotion, you would create a new Remotion composition that iterates over the files in `screenshots/automated/` and renders them inside a framed layout.
