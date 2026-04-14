# Descope React Native SDK — Example App

A minimal React Native app demonstrating integration with the Descope SDK. Used both as a reference and as the primary validation tool during SDK development.

## Setup

1. Install dependencies from the repo root:
   ```bash
   yarn bootstrap
   ```

2. Copy the environment template and fill in your Descope project details:
   ```bash
   cp .env.example .env
   ```
   Edit `.env`:
   ```
   DESCOPE_PROJECT_ID=your_project_id
   DESCOPE_BASE_URL=
   DESCOPE_FLOW_ID=sign-up-or-in
   ```

## Running

### Android

From the `example/` directory:
```bash
yarn android
```

This bundles the JS into the APK and installs on a connected device or emulator.

### iOS

iOS builds require code signing with your Apple Developer team. **Do not edit the `DEVELOPMENT_TEAM` in `project.pbxproj` from the command line** — that setting is repo-tracked and must remain empty for the public repository.

Instead, open the workspace in Xcode and work from there:
```bash
open ios/DescopeReactNativeExample.xcworkspace
```

In Xcode:
1. Select the **DescopeReactNativeExample** target
2. Go to **Signing & Capabilities**
3. Select your development team (this change stays local in Xcode's user data and is not committed)
4. Build and run with **Cmd+R**

Start Metro separately in a terminal first:
```bash
yarn start
```

## Screens

- **Login** — Two buttons: "Sign in with Flow" and "Sign in with OTP"
- **Flow** — Renders `FlowView` against the configured flow
- **OTP** — Two-step email OTP: send code, then verify
- **Home** — Shows user info and a logout button (only visible when a session exists)
