# Descope SDK for React Native

The Descope SDK for React Native provides convenient access to Descope for an application written on top of React Native. You can read more on the [Descope Website](https://descope.com).

## Requirements

- A Descope `Project ID` is required for using the SDK. Find it on the [project page in the Descope Console](https://app.descope.com/settings/project).

## Installing the SDK

Install the package with:

```bash
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

When the application is relaunched the `useSession` will automatically load any existing
session and you can check straight away if there's an authenticated user.

When the user wants to sign out of the application we revoke the
active session and clear it from the session manager:

```js
import { useDescope, useSession } from '@descope/react-native-sdk'

const descope = useDescope()
const { session, clearSession } = useSession()

await descope.logout(session.refreshJwt)
await clearSession(resp.data)
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

### (Android Only) Setup #2: Enable App Links

Running a flow via the React Native SDK, when targeting Android, requires setting up [App Links](https://developer.android.com/training/app-links#android-app-links).
This is essential for the SDK to be notified when the user has successfully
authenticated using a flow. Once you have a domain set up and
[verified](https://developer.android.com/training/app-links/verify-android-applinks)
for sending App Links, you'll need to handle the incoming deep links in your app:

#### Define a route to handle the App Link sent at the end of a flow

_this code example demonstrates how app links should be handled - you can customize it to fit your app_

```js
import { useFlow } from '@descope/react-native-sdk'

const flow = useFlow()

useEffect(() => {
  Linking.addEventListener('url', async (event) => {
    if (event.url === 'my-deep-link-for-authenticating') {
      // This path needs to correspond to the deep link you configured in your manifest - see below
      try {
        await flow.exchange(event.url) // Call exchange to complete the flow
      } catch (e) {
        // Handle errors here
      }
    }
  })
  return () => {
    Linking.removeAllListeners('url')
  }
}, [flow])
```

#### Add a matching Manifest declaration

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
</activity>
```

### (OPTIONAL) Setup #3: Support Magic Link Redirects

Supporting Magic Link authentication in flows requires some platform specific setup:

- On Android: add another path entry to the [App Links](https://developer.android.com/training/app-links#android-app-links).
  This is essentially another path in the same as the app link from the [previous setup step](#setup-2-enable-app-links),
  with different handling logic. Refer to the previous section for the manifest setup.
- On iOS: You'll need to [support associated domains](https://developer.apple.com/documentation/xcode/supporting-associated-domains?language=swift).

Regardless of the platform, another path is required to handle magic link redirects specifically. For the sake of this README, let's name
it `/magiclink`

#### Add the required Linking logic

_this code example demonstrates how app links or universal links should be handled - you can customize it to fit your app_

```js
import { useFlow } from '@descope/react-native-sdk'

const flow = useFlow()

useEffect(() => {
  Linking.addEventListener('url', async (event) => {
    if (event.url === 'my-deep-link-for-authenticating') {
      try {
        await flow.exchange(event.url) // Call exchange to complete the flow
      } catch (e) {
        // Handle errors here
      }
    } else if (event.url === 'my-deep-link-for-magic-links') {
      // Adding the magic link handling here
      try {
        await flow.resume(event.url) // Resume the flow after returning from a magic link
      } catch (e) {
        // Handle errors here
      }
    }
  })
  return () => {
    Linking.removeAllListeners('url')
  }
}, [flow])
```

### Run a Flow

After completing the prerequisite steps, it is now possible to run a flow.
The flow will run in a [Custom Tab](https://developer.chrome.com/docs/android/custom-tabs/) on Android,
or via [ASWebAuthenticationSession](https://developer.apple.com/documentation/authenticationservices/aswebauthenticationsession) on iOS.
Run the flow by calling the flow start function:

```js
import { useFlow } from '@descope/react-native-sdk'

const flow = useFlow()

try {
  const resp = await flow.start('<URL_FOR_FLOW_IN_SETUP_#1>', '<URL_FOR_APP_LINK_IN_SETUP_#2>')
  await manageSession(resp.data)
} catch (e) {
  // handle errors
}
```

When running on iOS nothing else is required. When running on Android, `flow.exchange()` function must be called.
See the [app link setup](#-android-only--setup-2--enable-app-links) for more details.

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

## Learn More

To learn more please see the [Descope Documentation and API reference page](https://docs.descope.com/).

## Contact Us

If you need help you can email [Descope Support](mailto:support@descope.com)

## License

The Descope SDK for React Native is licensed for use under the terms and conditions of the [MIT license Agreement](./LICENSE).
