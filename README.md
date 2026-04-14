# Descope SDK for React Native

The Descope SDK for React Native provides convenient access to Descope for an application written on top of React Native. You can read more on the [Descope Website](https://descope.com).

## Compatibility

The SDK is developed and tested against the versions listed below. Older versions may work but are not officially supported.

| Requirement                 | Version                                                                          |
| --------------------------- | -------------------------------------------------------------------------------- |
| React Native                | `0.78` (current release) — works on `>= 0.74` via the React Native interop layer |
| React                       | `19.0` (shipped with React Native 0.78)                                          |
| Node.js                     | `>= 18.18.0`                                                                     |
| iOS deployment target       | `>= 13.0`                                                                        |
| Xcode                       | `>= 15.0` (tested through `26.4`)                                                |
| Android `minSdkVersion`     | `24`                                                                             |
| Android `compileSdkVersion` | `35`                                                                             |
| Java / Kotlin JVM target    | `17`                                                                             |

**Architecture:** The library is written against the legacy bridge architecture. On apps using React Native's New Architecture (default since `0.76`), the library is transparently wrapped by the interop layer — no host configuration required. Migration to the newer architecture is roadmapped.

**Expo:** Expo is supported, however because the library ships native code, it requires a [custom development build](https://docs.expo.dev/develop/development-builds/introduction/) or the bare workflow — Expo Go is a pre-built app and thus will not work.

**XCode 26+:** New versions of XCode may cause an `fmt` compatibility issue with Xcode 26's clang and affects any React Native app — not this SDK specifically. It's fixed upstream in React Native `0.84+` which ships a newer `fmt`. If you're on an earlier version, you'll need to patch your iOS build. See the [troubleshooting section](#fixing-xcode-26-compatibility-issues) for detailed patching steps.

## Requirements

- A Descope `Project ID` is required for using the SDK. Find it on the [project page in the Descope Console](https://app.descope.com/settings/project).

## Installing the SDK

Install the package with:

```bash
yarn add @descope/react-native-sdk
# or
npm i --save @descope/react-native-sdk
```

When targeting iOS, make sure to navigate into the `ios` folder and install the dependencies:

```bash
pod install
```

## Usage

### Wrap your app with Auth Provider

```js
import { AuthProvider } from '@descope/react-native-sdk'

const AppRoot = () => {
  return (
    <AuthProvider
      projectId="my-project-id"
      // If the Descope project manages the token response in cookies, a custom domain
      // must be configured (e.g., https://auth.app.example.com)
      // and should be set as the baseUrl property.
      // baseUrl = "https://auth.app.example.com"
    >
      <App />
    </AuthProvider>
  )
}
```

## Logging

You can configure the SDK to emit log messages by providing a logger to `AuthProvider`:

```js
const logger = {
  log: (message) => MyMonitoringService.info(message),
  debug: (message) => MyMonitoringService.debug(message),
  warn: (message) => MyMonitoringService.warn(message),
  error: (message) => MyMonitoringService.error(message),
}

<AuthProvider projectId="my-project-id" logger={logger}>
  <App />
</AuthProvider>
```

The `logger` prop accepts any object that implements `log`, `debug`, `warn`, and `error` methods, making it easy to hook up to any monitoring or observability service. During development you can pass `console` directly for quick debugging.

The logger receives messages from both the JavaScript layer and the native SDK layer (iOS/Android), so all SDK activity — including flow execution and network calls — will be captured.

## Session Management

The `useSession` hook is used to manage an authenticated user session for an application.

The session manager takes care of loading and saving the session as well
as ensuring that it's refreshed when needed. When the user completes a sign
in flow successfully you should set the `DescopeSession` as the
active session of the session manager.

```js
import { useDescope, useSession } from '@descope/react-native-sdk'

const descope = useDescope()
const { manageSession } = useSession()

const resp = await descope.otp.email.verify('andy@example.com', '123456')
manageSession(resp.data)
```

The session manager can then be used at any time to ensure the session
is valid and to authenticate outgoing requests to your backend with a
bearer token authorization header.

```js
const { session } = useSession()

const res = await fetch('/path/to/server/api', {
  headers: {
    Authorization: `Bearer ${session.sessionJwt}`,
  },
})
```

When the application is relaunched the `AuthProvider` component will automatically load any existing
session. Once the `isSessionLoading` flag is `false`, you can check if there's a session available (i.e. an authenticated user).

When the user wants to sign out of the application we revoke the
active session and clear it from the session manager:

```js
import { useDescope, useSession } from '@descope/react-native-sdk'

const descope = useDescope()
const { session, clearSession } = useSession()

await descope.logout(session.refreshJwt)
await clearSession(resp.data)
```

### Accessing the Session

The session information can be accessed via the `useSession` hook, but also it might be convenient
to use the `getCurrentSessionToken()`, `getCurrentRefreshToken()` and `getCurrentUser()` helper functions.
These functions are available outside of the component render-lifecycle.
This might be useful, for example, to add an authorization header to all authenticated requests.

### Refreshing the Session

The guiding principal of refreshing the session is the same, regardless of any specific
app architecture or network framework.

Before every authenticated request, add your authorization header to the request the way your server
expects to receive it. As an optimization it is also possible to call `refreshSessionIfAboutToExpire()`.
This async function will preemptively refresh the session token if it is about to expire, or already expired.
That code might look something like this:

```js
// ... before every authenticated request
try {
  // refresh if needed
  await refreshSessionIfAboutToExpire()
} catch (e) {
  // fail silently - as this shouldn't affect the request being performed
}

// add authorization header
request.headers.Authorization = `Bearer ${getCurrentSessionToken()}`
```

After every error response - if the server responds that the session token is invalid, i.e.
`401` or your equivalent, try to refresh the session token and repeat the request. Otherwise,
clear the session and prompt the user to re-authenticate.
That code might look something like this

```js
// ... on every error response
// assuming 401 is returned ONLY when the session JWT is invalid
if (error.status === 401) {
  try {
    const resp = await descope.refresh(getCurrentRefreshToken())
    await updateTokens(resp.data.sessionJwt, resp.data.refreshJwt)

    // you can now retry the original request
    // NEED TO MAKE SURE THAT THIS RETRY IS ONLY PERFORMED ONCE
    // otherwise, an endless loop of failed requests might occur
    retryRequest()
  } catch (e) {
    // clear the session as the user must re-authenticate
  }
}
```

**IMPORTANT NOTE**: if you find the need to pass a reference to the `refreshSessionIfAboutToExpire()`
`updateTokens()` and `descope` from the `useSession` hook into some network component, make sure
it is done in a lifecycle aware method.
That code might look something like this:

```js
const descope = useDescope()
const { isSessionLoading, refreshSessionIfAboutToExpire, updateTokens } = useSession()

React.useEffect(() => {
  if (!isSessionLoading) {
    setUpNetworkRefresh(refreshSessionIfAboutToExpire, updateTokens, descope)
  }
}, [isSessionLoading refreshSessionIfAboutToExpire, updateTokens, descope])
```

## Running Flows

We can authenticate users by building and running Flows. Flows are built in the Descope
[flow editor](https://app.descope.com/flows). The editor allows you to easily
define both the behavior and the UI that take the user through their
authentication journey. Read more about it in the Descope
[getting started](https://docs.descope.com/build/guides/gettingstarted/) guide.

### Setup #1: Define and host your flow

Before we can run a flow, it must first be defined and hosted. Every project
comes with predefined flows out of the box. You can customize your flows to suit your needs
and host it. Follow
the [getting started](https://docs.descope.com/build/guides/gettingstarted/) guide for more details.
You can host the flow yourself or leverage Descope's hosted flow page. Read more about it [here](https://docs.descope.com/customize/auth/oidc/#hosted-flow-application).
You can also check out the [auth-hosting repo itself](https://github.com/descope/auth-hosting).

### (OPTIONAL) Setup #2.1: Enable App Links for Magic Link and OAuth (social) on Android

Some authentication methods rely on leaving the application's context to authenticate the
user, such as navigating to an identity provider's website to perform OAuth (social) authentication,
or receiving a Magic Link via email or text message. If you do not intend to use these authentication
methods, you can skip this step. Otherwise, in order for the user to get back
to your application, setting up [App Links](https://developer.android.com/training/app-links#android-app-links) is required.
Once you have a domain set up and [verified](https://developer.android.com/training/app-links/verify-android-applinks) for sending App Links,
you'll need to handle the incoming deep links in your app, and resume the flow.

### (OPTIONAL) Setup #2.2: Support Magic Link Redirects on iOS

Supporting Magic Link authentication in flows requires some platform specific setup:
You'll need to [support associated domains](https://developer.apple.com/documentation/xcode/supporting-associated-domains?language=swift).

Regardless of the platform, another path is required to handle magic link redirects specifically. For the sake of this README, let's name
it `/magiclink`

#### Define deep link handling

_this code example demonstrates how app links should be handled - you can customize it to fit your app_

```js
import { FlowView } from '@descope/react-native-sdk'

const [deepLink, setDeepLink] = useState('')

useEffect(() => {
  Linking.addEventListener('url', async (event) => {
    if (event.url === 'https://my-deep-link-for-authenticating.com') {
      setDeepLink(event.url)
    }
  })
  return () => {
    Linking.removeAllListeners('url')
  }
})
```

#### Add a matching Manifest declaration (Android)

```xml
<activity
        android:name=".MainActivity"
        android:exported="true"
        android:launchMode="singleTask"
        android:theme="@style/LaunchTheme"
        android:configChanges="orientation|keyboardHidden|keyboard|screenSize|smallestScreenSize|locale|layoutDirection|fontScale|screenLayout|density|uiMode"
        android:hardwareAccelerated="true"
        android:windowSoftInputMode="adjustResize">

    <!-- add the following at the end of the activity tag, after anything you have defined currently -->

    <intent-filter android:autoVerify="true"> <!-- autoVerify required for app links -->
        <action android:name="android.intent.action.VIEW" />
        <category android:name="android.intent.category.DEFAULT" />
        <category android:name="android.intent.category.BROWSABLE" />
        <!-- replace with your host, the path can change must must be reflected when running the flow -->
        <!-- the path should correspond with the routing path defined above -->
        <data android:scheme="https" android:host="<YOUR_HOST_HERE>" android:path="/auth" />
        <!-- see magic link setup below for more details -->
        <data android:scheme="https" android:host="<YOUR_HOST_HERE>" android:path="/magiclink" />
    </intent-filter>

    <!-- Optional: App Links are blocked by default on Opera and some other browsers. Add a custom scheme for that use case specifically -->
    <intent-filter android:autoVerify="true">
        <action android:name="android.intent.action.VIEW" />
        <category android:name="android.intent.category.DEFAULT" />
        <category android:name="android.intent.category.BROWSABLE" />

        <!-- replace with something unique. this will only be used as a backup for Opera and some other browsers. -->
        <data android:scheme="myapp" android:host="auth" />
    </intent-filter>
</activity>
```

### Run a Flow

After completing the prerequisite steps, it is now possible to run a flow.
The flow will run in a dedicated `FlowView` component which receives `FlowOptions`.
The `FlowOptions` defines all of the options available when running a flow on both
Android and iOS. Read the component documentation for a detailed explanation.

```js
import { FlowView, useHostedFlowUrl, useSession } from '@descope/react-native-sdk'

const { manageSession } = useSession()

const flowUrl = 'https://myflowUrl.com'
// If using Descope hosted flows, you can provide the flow ID directly
// const flowUrl = useHostedFlowUrl('<FLOW_ID_TO_RUN>')

<FlowView
  style={styles.fill}
  flowOptions={{
      url: flowUrl,
      androidOAuthNativeProvider: 'google',
      iosOAuthNativeProvider: 'apple',
      // any other options go here
  }}
  deepLink={deepLink} // the optional deep link we defined earlier via `useState`
  onReady={() => {
    // logic to display the flow when it's ready
  }}
  onSuccess={async (jwtResponse) => {
    try {
      await manageSession(jwtResponse)
    } catch (e) {
      // handle session management error
    }
  }}
  onError={(error: string) => {
    // handle flow errors here
  }}
/>
```

## Use the `useDescope` and `useSession` hooks in your components in order to get authentication state, user details and utilities

This can be helpful to implement application-specific logic. Examples:

- Render different components if current session is authenticated
- Render user's content
- Logout button

```js
import { useDescope, useSession } from '@descope/react-native-sdk'
import { useCallback } from 'react'

const App = () => {
  // NOTE - `useDescope`, `useSession`, should be used inside `AuthProvider` context,
  // and will throw an exception if this requirement is not met
  const { session } = useSession()
  const { logout } = useDescope()

  const handleLogout = useCallback(() => {
    logout()
  }, [logout])

  if (session) {
    return (
      <>
        <p>Hello {session.user.name}</p>
        <button onClick={handleLogout}>Logout</button>
      </>
    )
  }

  return <p>You are not logged in</p>
}
```

**For more SDK usage examples refer to [docs](https://docs.descope.com/build/guides/client_sdks/)**

## Troubleshooting

### Fixing XCode 26+ Compatibility Issues

**Standard React Native project** — add this to `ios/Podfile` inside `post_install`:

```ruby
post_install do |installer|
  # ...existing post_install code...

  # Workaround for fmt consteval errors with Xcode 26+
  # Remove once React Native ships fmt >= 12.1.0
  fmt_base = File.join(installer.sandbox.pod_dir('fmt'), 'include', 'fmt', 'base.h')
  if File.exist?(fmt_base)
    content = File.read(fmt_base)
    patched = content.gsub(/#  define FMT_USE_CONSTEVAL 1/, '#  define FMT_USE_CONSTEVAL 0')
    File.write(fmt_base, patched)
  end
end
```

**Expo project** — because Expo regenerates the `Podfile` on every `prebuild`, use a config plugin. Create `plugins/fix-fmt-consteval.js`:

```js
const { withDangerousMod } = require('expo/config-plugins')
const fs = require('fs')
const path = require('path')

module.exports = function withFixFmtConsteval(config) {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile')
      let podfile = fs.readFileSync(podfilePath, 'utf8')
      const marker = '# Workaround for fmt consteval errors with Xcode 26+'
      if (podfile.includes(marker)) return config

      const patch = `
    ${marker}
    fmt_base = File.join(installer.sandbox.pod_dir('fmt'), 'include', 'fmt', 'base.h')
    if File.exist?(fmt_base)
      content = File.read(fmt_base)
      patched = content.gsub(/#  define FMT_USE_CONSTEVAL 1/, '#  define FMT_USE_CONSTEVAL 0')
      File.write(fmt_base, patched)
    end
`
      podfile = podfile.replace(/(post_install do \|installer\|)/, `$1\n${patch}`)
      fs.writeFileSync(podfilePath, podfile)
      return config
    },
  ])
}
```

Then register it in `app.json`:

```json
{
  "expo": {
    "plugins": ["./plugins/fix-fmt-consteval.js"]
  }
}
```

Re-run `expo prebuild` (or delete `ios/` and run `expo run:ios`) and the patch will be applied.

## Learn More

To learn more please see the [Descope Documentation and API reference page](https://docs.descope.com/).

## Contact Us

If you need help you can email [Descope Support](mailto:support@descope.com)

## License

The Descope SDK for React Native is licensed for use under the terms and conditions of the [MIT license Agreement](./LICENSE).
