# Descope SDK for React Native

The Descope SDK for React Native provides convenient access to Descope for an application written on top of React Native. You can read more on the [Descope Website](https://descope.com).

> Our React Native SDK doesn't currently support [Expo](https://expo.dev/). If you are using Expo, you can still use Descope by following the [Expo OIDC](https://www.descope.com/blog/post/expo-authentication) integration guide.

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

**NOTE:** The Android native code is compiled using Kotlin v2.2.0 and Gradle plugin v8.13

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
import { FlowView } from '@descope/react-native-sdk'

const { manageSession } = useSession()

const flowUrl = 'https://myflowUrl.com'

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

## Learn More

To learn more please see the [Descope Documentation and API reference page](https://docs.descope.com/).

## Contact Us

If you need help you can email [Descope Support](mailto:support@descope.com)

## License

The Descope SDK for React Native is licensed for use under the terms and conditions of the [MIT license Agreement](./LICENSE).
