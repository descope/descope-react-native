# Descope React Native SDK — Expo Example

An Expo variant of the example app. Used to demonstraight how the SDK works in Expo projects (via a custom development build — **not** Expo Go).

## Why a dev build?

Expo Go is a pre-built sandbox app that can only load pure-JS modules. Since this SDK ships native code (secure storage, native flow view, etc.), it requires a **custom development build** or the bare workflow. This matches what a production Expo app uses (`eas build`), so it's representative of real usage.

## Setup

1. Install dependencies:

   ```bash
   yarn install
   ```

2. Copy the environment template and fill in your Descope project details:
   ```bash
   cp .env.example .env
   ```
   Edit `.env`:
   ```
   EXPO_PUBLIC_DESCOPE_PROJECT_ID=your_project_id
   EXPO_PUBLIC_DESCOPE_BASE_URL=
   EXPO_PUBLIC_DESCOPE_FLOW_ID=sign-up-or-in
   ```

## Running

### Android

From the `example-expo/` directory:

```bash
yarn android
```

This runs `expo prebuild` to generate the native `android/` project, then builds and installs the dev client on your device or emulator.

### iOS

```bash
yarn ios
```

Same flow for iOS — prebuild generates the `ios/` project, builds, and runs. On first build you may need to set your development team in Xcode (open `ios/DescopeExpoExample.xcworkspace`).

### Fast JS iteration

Once the dev build is installed, you can reload JS changes instantly without rebuilding:

```bash
yarn start
```

Scan the QR code in the Expo dev client app (the custom build, not Expo Go).

## Differences from `../example`

- Uses `expo` and `expo-dev-client` instead of raw React Native CLI
- Environment variables use the `EXPO_PUBLIC_` prefix and `process.env` instead of `react-native-dotenv`
- Native `ios/` and `android/` folders are gitignored — they're regenerated from `app.json` on each prebuild (Continuous Native Generation)
