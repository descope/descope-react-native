# Descope React Native SDK — RN Latest Example

A validation app running the latest stable React Native (0.84) to verify the SDK works on the newest RN version via the interop layer.

This app is identical to `../example` except it targets RN 0.84 instead of 0.78. The source files in `src/` are kept in sync between the two.

## Setup

1. Install dependencies:
   ```bash
   yarn install
   ```

2. Copy the environment template and fill in your Descope project details:
   ```bash
   cp .env.example .env
   ```

3. For iOS, install CocoaPods:
   ```bash
   cd ios && pod install
   ```

## Running

### Android

```bash
yarn android
```

### iOS

Open the workspace in Xcode, set your development team, then build:
```bash
open ios/DescopeReactNativeLatestExample.xcworkspace
```

Start Metro separately:
```bash
yarn start
```
