package com.descopereactnative

import android.app.Activity
import android.content.Context
import android.net.Uri
import com.descope.android.DescopeFlow
import com.descope.android.DescopeFlowView
import com.descope.types.AuthenticationResponse
import com.descope.types.DescopeException
import com.descope.types.DescopeUser
import com.descope.types.OAuthProvider
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactContext
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableMap
import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.UIManagerHelper
import com.facebook.react.uimanager.annotations.ReactProp
import com.facebook.react.uimanager.events.Event
import org.json.JSONArray
import org.json.JSONObject
import androidx.core.net.toUri

const val REACT_CLASS = "DescopeFlowView"

@ReactModule(name = REACT_CLASS)
class DescopeFlowViewManager() : SimpleViewManager<DescopeFlowView>(), DescopeFlowView.Listener {

  private var descopeFlowView: DescopeFlowView? = null

  override fun getName(): String = REACT_CLASS

  override fun createViewInstance(context: ThemedReactContext): DescopeFlowView = DescopeFlowView(context)

  override fun getExportedCustomBubblingEventTypeConstants(): Map<String, Any> = mapOf(
    "onFlowReady" to mapOf(
      "phasedRegistrationNames" to mapOf(
        "bubbled" to "onFlowReady",
        "captured" to "onFlowReadyCapture"
      )
    ),
    "onFlowSuccess" to mapOf(
      "phasedRegistrationNames" to mapOf(
        "bubbled" to "onFlowSuccess",
        "captured" to "onFlowSuccessCapture"
      )
    ),
    "onFlowError" to mapOf(
      "phasedRegistrationNames" to mapOf(
        "bubbled" to "onFlowError",
        "captured" to "onFlowErrorCapture"
      )
    )
  )

  @ReactProp(name = "flowOptions")
  fun setFlowOptions(descopeFlowView: DescopeFlowView, options: ReadableMap?) {
    if (options == null) return
    val url = options.getString("url") ?: return
    val descopeFlow = DescopeFlow(url)
    options.getString("androidOAuthNativeProvider")?.run { descopeFlow.oauthNativeProvider = OAuthProvider(name = this) }
    descopeFlow.oauthRedirect = options.getString("oauthRedirect")
    descopeFlow.oauthRedirectCustomScheme = options.getString("oauthRedirectCustomScheme")
    descopeFlow.ssoRedirect = options.getString("ssoRedirect")
    descopeFlow.ssoRedirectCustomScheme = options.getString("ssoRedirectCustomScheme")
    descopeFlow.magicLinkRedirect = options.getString("magicLinkRedirect")

    this.descopeFlowView = descopeFlowView
    descopeFlowView.listener = this
    descopeFlowView.startFlow(descopeFlow)
  }

  @ReactProp(name = "deepLink")
  fun setDeepLink(descopeFlowView: DescopeFlowView, deepLink: String?) {
    deepLink?.run { descopeFlowView.resumeFromDeepLink(this.toUri()) }
  }

  // Flow Listener

  override fun onReady() {
    descopeFlowView?.run {
      dispatch(context, id) { surfaceId ->
        ReadyEvent(surfaceId, id)
      }
    }
  }

  override fun onSuccess(response: AuthenticationResponse) {
    descopeFlowView?.run {
      dispatch(context, id) { surfaceId ->
        SuccessEvent(surfaceId, id, response.toJsonString())
      }
    }
  }

  override fun onError(exception: DescopeException) {
    descopeFlowView?.run {
      dispatch(context, id) { surfaceId ->
        ErrorEvent(surfaceId, id, exception)
      }
    }
  }

  private fun dispatch(context: Context, id: Int, createEvent: (Int) -> Event<*>) {
    val reactContext = context as ReactContext
    val surfaceId = UIManagerHelper.getSurfaceId(reactContext)
    val eventDispatcher = UIManagerHelper.getEventDispatcherForReactTag(reactContext, id)
    val event = createEvent(surfaceId)
    eventDispatcher?.dispatchEvent(event)
  }
}

// Events

class ReadyEvent(
  surfaceId: Int,
  viewId: Int,
) : Event<ReadyEvent>(surfaceId, viewId) {
  override fun getEventName() = "onFlowReady"
}

class SuccessEvent(
  surfaceId: Int,
  viewId: Int,
  private val response: String,
) : Event<SuccessEvent>(surfaceId, viewId) {
  override fun getEventName() = "onFlowSuccess"
  override fun getEventData(): WritableMap? {
    return Arguments.createMap().apply {
      putString("response", response)
    }
  }
}

class ErrorEvent(
  surfaceId: Int,
  viewId: Int,
  private val exception: DescopeException,
) : Event<ErrorEvent>(surfaceId, viewId) {
  override fun getEventName() = "onFlowError"
  override fun getEventData(): WritableMap? = Arguments.createMap().apply {
    putString("errorCode", exception.code)
    putString("errorDescription", exception.desc)
    putString("errorMessage", exception.message)
  }
}

// Utilities

internal fun activityFromReactContext(context: Context): Activity? {
  val reactContext = context as ReactContext
  return reactContext.currentActivity
}

private fun AuthenticationResponse.toJsonString(): String {
  val json = JSONObject().apply {
    put("sessionJwt", sessionToken.jwt)
    put("refreshJwt", refreshToken.jwt)
    put("user", user.toJson())
    put("firstSeen", isFirstAuthentication)
  }
  println(json.toString(2))
  return json.toString()
}

private fun DescopeUser.toJson() = JSONObject().apply {
  put("userId", userId)
  put("loginIds", loginIds.toJsonArray())
  name?.run { put("name", this) }
  picture?.run { put("picture", this.toString()) }
  email?.run { put("email", this) }
  put("verifiedEmail", isVerifiedEmail)
  phone?.run { put("phone", this) }
  put("verifiedPhone", isVerifiedPhone)
  put("createdTime", createdAt)
  put("customAttributes", customAttributes.toJsonObject())
  givenName?.run { put("givenName", this) }
  middleName?.run { put("middleName", this) }
  familyName?.run { put("familyName", this) }
}

private fun List<*>.toJsonArray(): JSONArray = JSONArray().apply {
  this@toJsonArray.forEach {
    when {
      it is Map<*, *> -> put(it.toJsonObject())
      it is List<*> -> put(it.toJsonArray())
      it != null -> put(it)
    }
  }
}

private fun Map<*, *>.toJsonObject(): JSONObject = JSONObject().apply {
  forEach {
    val key = it.key as String
    val value = it.value
    when {
      value is Map<*, *> -> put(key, value.toJsonObject())
      value is List<*> -> put(key, value.toJsonArray())
      value != null -> put(key, value)
    }
  }
}
