import type { JWTResponse } from '@descope/core-js-sdk'
import React, { useCallback, useMemo, type SyntheticEvent } from 'react'
import { requireNativeComponent, type HostComponent, type ViewStyle } from 'react-native'
import { version } from '../../package.json'
import useDescopeContext from '../internal/hooks/useContext'
import type { DescopeError, FlowOptions } from '../types'

type FlowSession = {
  sessionJwt: string
  refreshJwt: string
}

type DescopeFlowView = {
  onFlowReady?: () => void
  onFlowSuccess?: (event: SyntheticEvent<never, { response: string }>) => void
  onFlowError?: (event: SyntheticEvent<never, { errorCode: string; errorDescription: string; errorMessage?: string }>) => void
  flowOptions?: FlowOptions & { sdkVersion?: string }
  session?: FlowSession
}

const DescopeFlowView = requireNativeComponent('DescopeFlowView') as HostComponent<DescopeFlowView>

/**
 * Authenticate a user using Descope Flows.
 *
 * Embed this view into your UI to be able to run flows built with the
 * [Descope Flow builder](https://app.descope.com/flows)
 *
 * **General Setup**
 *
 * - As a prerequisite, the flow itself must be defined and hosted.
 * It's possible to use Descope's auth hosting solution, or host it
 * yourself. Read more [here.](https://docs.descope.com/auth-hosting-app)
 *
 * - To use the Descope authentication methods, it is required
 * to configure the desired authentication methods in the [Descope console.](https://app.descope.com/settings/authentication)
 * Some of the default configurations might be OK to start out with,
 * but it is likely that modifications will be required before release.
 *
 * - Authenticated Flows: When a user is logged in and an active session exists, the flow
 * automatically runs as the authenticated user. This is required for flows that
 * update user details, perform step-up authentication, or otherwise expect a
 * signed-in user.
 *
 * **iOS Setup**
 *
 * - It is possible for users to authenticate using their Apple account.
 * The authentication presents a native dialog that lets
 * the user sign in with the Apple ID they're already using on their device.
 * The Sign in with Apple APIs require some setup in your Xcode project, including
 * at the very least adding the `Sign in with Apple` capability. You will also need
 * to configure the Apple provider in the [Descope console](https://app.descope.com/settings/authentication/social).
 * In particular, when using your own account make sure that the `Client ID` value
 * matches the Bundle Identifier of your app.
 *
 * - In order to use navigation / redirection based authentication,
 * namely `Magic Link`, the app must make sure the link redirects back
 * to the app. Read more on [universal links](https://developer.apple.com/ios/universal-links/)
 * to learn more. Once redirected back to the app, provide the deep link via the `deepLink` prop.
 *
 * **Android Setup**
 *
 * - **IMPORTANT NOTE**: even though Application links are the recommended way to configure
 * deep links, some browsers, such as Opera, do not honor them and open the URLs inline.
 * It is possible to circumvent this issue by using a custom scheme, albeit less secure.
 *
 * - Beyond that, in order to use navigation / redirection based authentication,
 * namely `Magic Link`, `OAuth (social)` and SSO, it's required to set up app links.
 * App Links allow the application to receive navigation to specific URLs,
 * instead of opening the browser. Follow the [Android official documentation](https://developer.android.com/training/app-links)
 * to set up App link in your application. Once redirected back to the app, provide the deep link via the `deepLink` prop.
 *
 * - Finally, it is possible for users to authenticate using the Google account or accounts they are logged into
 * on their Android devices. If you haven't already configured your app to support `Sign in with Google` you'll
 * probably need to set up your [Google APIs console project](https://developer.android.com/identity/sign-in/credential-manager-siwg#set-google)
 * for this. You should also configure an OAuth provider for Google in the in the [Descope console](https://app.descope.com/settings/authentication/social),
 * with its `Grant Type` set to `Implicit`. Also note that the `Client ID` and
 * `Client Secret` should be set to the values of your `Web application` OAuth client,
 * rather than those from the `Android` OAuth client.
 * For more details about configuring your app see the [Credential Manager documentation](https://developer.android.com/identity/sign-in/credential-manager).
 * @param props Flow options to set up the flow, a `deepLink` to continue redirect based authentication
 * a set of callbacks when the Flow is `ready` to be presented, and finished in a `success` or `error` state.
 * @returns The Descope FlowView component
 */
export default function FlowView(props: { flowOptions: FlowOptions; deepLink?: string; style?: ViewStyle; onReady?: () => unknown; onSuccess?: (jwtResponse: JWTResponse) => unknown; onError?: (error: DescopeError) => unknown }) {
  const { onReady, onSuccess, onError } = props
  const { session, isSessionLoading } = useDescopeContext()

  const sessionPayload = useMemo<FlowSession | undefined>(() => (session ? { sessionJwt: session.sessionJwt, refreshJwt: session.refreshJwt } : undefined), [session])

  const onSuccessHook = useCallback(
    (event: SyntheticEvent<never, { response: string }>) => {
      const rawResponse = JSON.parse(event.nativeEvent.response)
      const jwtResponse = rawResponse as JWTResponse
      // For authenticated flows - the session tokens from the current active session are used to authenticate
      // the user inside the flow, while the user object itself is unaffected. However, since the user is an integral
      // part of the session construct, a placeholder user is used by the native layer. When a flow finishes without
      // issuing a new auth response (e.g. profile update), the placeholder user is replaced here with the
      // actual user from the current active session.
      if (jwtResponse.user && jwtResponse.user.userId === '' && session?.user) {
        jwtResponse.user = session.user
      }
      onSuccess?.(jwtResponse)
    },
    [onSuccess, session?.user],
  )

  const onErrorHook = useCallback(
    (event: SyntheticEvent<never, { errorCode: string; errorDescription: string; errorMessage?: string }>) => {
      const error = {
        errorCode: event.nativeEvent.errorCode,
        errorDescription: event.nativeEvent.errorDescription,
        errorMessage: event.nativeEvent.errorMessage,
      }
      onError?.(error)
    },
    [onError],
  )

  // Defer mounting the native view until the persisted session has been loaded, so authenticated flows
  // don't initialize with an empty refresh JWT on cold start.
  if (isSessionLoading) {
    return null
  }

  return <DescopeFlowView {...props} session={sessionPayload} onFlowReady={onReady} onFlowSuccess={onSuccessHook} onFlowError={onErrorHook} flowOptions={{ ...props.flowOptions, sdkVersion: version }} />
}
