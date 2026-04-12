# Screenshot Automation Guide

Musclog uses Playwright to automatically generate screenshots for marketing materials (App Store, Play Store) and for testing UI components.

## Prerequisites

1.  **Install dependencies**: Ensure all npm packages are installed.
    ```bash
    npm install
    ```
2.  **Install Playwright browsers**: Playwright requires its own browser binaries.
    ```bash
    npx playwright install
    ```

## Generating Screenshots

To generate the full suite of screenshots (Main Screens + All Modals), use the following command:

```bash
npm run screenshots -- --project=portrait-6.7
```

### How it works:

1.  **Build**: It runs `npm run build-android-web` to export the application to the `dist/` folder using a static web build.
2.  **Server**: It starts a local Node.js server that handles the Musclog base path (`/musclog-app`) and SPA routing.
3.  **Automation**: It runs the Playwright script located in `tests/screenshot-automation.spec.ts`.
4.  **Output**: Screenshots are saved to `screenshots/app-store/portrait-6.7/`.

## Development & Customization

- **Test Runner**: You can run the automation without rebuilding if you already have a `dist/` folder:
  ```bash
  npm run playwright -- --project=portrait-6.7
  ```
- **Configuration**: The Playwright configuration is located in `playwright.config.ts`.
- **Spec File**: The logic for navigation and capturing screenshots is in `tests/screenshot-automation.spec.ts`.

### Seeding Data

The automation uses the `?demoModeEnabled=true` query parameter to seed deterministic data into the app, ensuring consistent screenshots across different environments.

### Modal Coverage

The script navigates to the internal `/test/modals` screen and iterates through every modal trigger available in the development suite to ensure 100% modal coverage.
