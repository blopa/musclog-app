<p align="center">
    <a href="https://play.google.com/store/apps/details?id=com.werules.logger">
        <img src="https://raw.githubusercontent.com/blopa/musclog-app/main/assets/images/icon.png" width="20%" alt="Musclog-logo">
    </a>
</p>
<p align="center">
    <h1 align="center">Musclog - Lift, Log, Repeat</h1>
</p>
<p align="center">
    <em>Your all-in-one fitness companion for tracking workouts, nutrition, and health — powered by AI.</em>
</p>
<p align="center">
    <img src="https://img.shields.io/badge/TypeScript-3178C6.svg?style=default&logo=TypeScript&logoColor=white" alt="TypeScript">
    <img src="https://img.shields.io/badge/React_Native-61DAFB.svg?style=default&logo=React&logoColor=black" alt="React Native">
    <img src="https://img.shields.io/badge/Expo-000020.svg?style=default&logo=Expo&logoColor=white" alt="Expo">
    <img src="https://img.shields.io/badge/NativeWind-06B6D4.svg?style=default&logo=Tailwind-CSS&logoColor=white" alt="NativeWind">
</p>

<br>

---

## Overview

Musclog is a cross-platform mobile fitness application built with React Native and Expo. It combines workout logging, nutrition tracking, menstrual cycle awareness, and AI-powered coaching into a single, cohesive experience — all stored locally with WatermelonDB.

> **Note:** Currently only dark theme is available.

## Read the [blog post](https://pablo.gg/en/blog/coding/musclog-leveraging-my-reactjs-experience-to-build-a-react-native-app/) about how this app came to be.

---

## Key Features

### 🏋️ Track Workouts

- Log workouts with sets, reps, and weights
- Create and manage custom workout templates and exercises
- Schedule workouts on a weekly basis with reminders
- View lifting volume stats and progression over time
- Comprehensive exercise library with muscle group categorization

### 📅 Schedule & Plan

- Plan workouts on a weekly basis to ensure consistency
- Receive reminders to stay on track with your goals

### 🍎 Food Tracking & Nutrition

- **Daily Food Logging**: Track meals (breakfast, lunch, dinner, snack) with detailed macro and calorie info
- **Barcode Scanning**: Add foods instantly by scanning product barcodes with your camera
- **Food Search**: Search the Open Food Facts database for nutritional information
- **Custom Foods & Meals**: Create your own food entries and save meal templates for quick access
- **Micronutrient Tracking**: Track 40+ vitamins and minerals beyond basic macros
- **AI Macro Estimation**: Use AI vision to estimate nutrition from food photos or nutrition label images
- **Retrospective Logging**: Log meals for past dates
- **Empirical TDEE**: Calorie needs estimated from actual activity logs

### 🌙 Menstrual Cycle Tracking

- Track cycle phases: menstrual, follicular, ovulation, and luteal
- Predict next period and fertile window
- Adjust workout intensity automatically based on current cycle phase
- Support for hormonal and non-hormonal birth control types
- Toggle cycle tracking on or off at any time

### 📈 Progress & Insights

- Visualize fitness progress with charts and graphs
- Track body metrics: weight, body fat %, and custom measurements
- Daily and weekly AI-generated insights on workouts and nutrition

### 🧠 AI Coach

- **Dual AI Support**: Google Gemini (2.0/2.5, via OAuth or API key) or OpenAI (GPT-4, GPT-4o, O1, O3)
- **In-App Chat**: Conversational AI coach for workout and nutrition advice
- **Photo Analysis**: AI-powered food photo and nutrition label analysis
- **Workout Generation**: AI-generated workout plans tailored to your goals
- **Flexible Config**: Choose model, configure API keys, set insight frequency

### 🔗 Health Integration

- Sync with Google Health Connect (Android) for weight, nutrition, and exercise data
- 7-day lookback on health data import

### 🔄 Import & Export

- Export your full database as an encrypted JSON file
- Import data across devices or as a backup
- Support for JSON and CSV formats

### 🔒 Privacy & Security

- All data stored locally on-device via WatermelonDB
- Sensitive fields (nutrition logs, user metrics) encrypted at rest with AES
- AI features are fully optional — app works offline without them

---

## Tech Stack

| Layer          | Technology                                        |
| -------------- | ------------------------------------------------- |
| Framework      | React Native 0.81 + Expo Router 6                 |
| Language       | TypeScript 5.9                                    |
| Database       | WatermelonDB 0.28 (SQLite-backed, reactive)       |
| Styling        | NativeWind 4.2 (Tailwind CSS for React Native)    |
| Icons          | Lucide React Native                               |
| Charts         | Victory Native                                    |
| AI             | Google Generative AI + OpenAI SDK                 |
| Camera         | expo-camera, Quagga2, ZXing, ML Kit OCR           |
| Health         | expo-health-connect / react-native-health-connect |
| Localization   | i18next + react-i18next                           |
| Animations     | React Native Reanimated 4                         |
| Error Tracking | Sentry                                            |
| Testing        | Jest + React Testing Library                      |
| Build          | EAS (Expo Application Services)                   |

---

## Repository Structure

```
musclog/
├── app/                        # Expo Router screens
│   ├── _layout.tsx             # Root layout
│   ├── index.tsx               # Dashboard / home
│   ├── onboarding/             # Onboarding flow
│   ├── workout/                # Workout screens
│   ├── nutrition/              # Nutrition/food screens
│   ├── cycle.tsx               # Menstrual cycle tracking
│   ├── progress.tsx            # Analytics & charts
│   ├── profile.tsx             # User profile & metrics
│   ├── settings.tsx            # App settings
│   ├── chat.tsx                # AI coach chat
│   └── aiSettings.tsx          # AI configuration
├── components/                 # Reusable UI components
│   ├── NavigationMenu.tsx      # Custom bottom nav bar
│   ├── MasterLayout.tsx        # Root layout wrapper
│   ├── CoachModal.tsx          # AI coach chat modal
│   ├── SmartCameraModal.tsx    # AI photo analysis modal
│   ├── PhaseWheel.tsx          # Cycle phase visualization
│   └── ...
├── database/                   # WatermelonDB models & services
│   ├── models/                 # Database models
│   ├── services/               # Service layer (CRUD + business logic)
│   ├── migrations/             # DB schema migrations
│   └── seeders/                # Initial data seeding
├── hooks/                      # Custom React hooks
├── lang/locales/en-us/         # Localization strings
├── assets/                     # Images, icons, exercise photos
├── constants/                  # App-wide constants
└── utils/                      # Utility functions
```

---

## Getting Started

### Prerequisites

- Node.js (LTS)
- npm or yarn
- [Expo CLI](https://docs.expo.dev/get-started/installation/)
- For Android: Android Studio + emulator or physical device
- For iOS: macOS with Xcode

### Installation

```bash
# 1. Clone the repository
git clone <repo-url>
cd musclog

# 2. Install dependencies
npm install

# 3. Configure environment variables
cp .env.example .env
# Edit .env to add optional API keys (see below)

# 4. Start the development server
npm start
```

### Running on a Platform

```bash
npm run android   # Android emulator or device
npm run ios       # iOS simulator (macOS only)
npm run web       # Web browser
```

### Environment Variables

AI features are optional. To enable them, add your keys to `.env`:

```env
# Google Gemini (optional)
EXPO_PUBLIC_GEMINI_API_KEY=your_gemini_key

# OpenAI (optional)
OPENAI_API_KEY=your_openai_key

# Sentry error tracking (optional)
EXPO_PUBLIC_SENTRY_DSN=your_sentry_dsn
SENTRY_AUTH_TOKEN=your_sentry_token
```

> For production builds, use [EAS Secrets](https://docs.expo.dev/eas/environment-variables/) instead of committing keys to version control.

### Running Tests

```bash
npm test
```

### Other Scripts

```bash
npm run lint              # Lint code
npm run format            # Format with Prettier
npm run typecheck         # TypeScript type checking
npm run check-translations # Validate i18n keys
npm run start-clear       # Start with cleared cache
```

---

## Building for Production

Musclog uses [EAS Build](https://docs.expo.dev/build/introduction/) for production builds.

```bash
# Android
npm run build-android          # Production APK/AAB
npm run build-android-preview  # Preview/internal testing build

# Submit to Google Play
npm run submit-android
```

---

## Contributing

Contributions are welcome! Please open an issue or pull request. For larger changes, open an issue first to discuss the approach.

---

## License

This project is open source. See the [LICENSE](LICENSE) file for details.

---

## Resources

- [Blog post: How Musclog came to be](https://pablo.gg/en/blog/coding/musclog-leveraging-my-reactjs-experience-to-build-a-react-native-app/)
- [Expo Documentation](https://docs.expo.dev/)
- [WatermelonDB Documentation](https://watermelondb.dev/)
- [NativeWind Documentation](https://www.nativewind.dev/)
