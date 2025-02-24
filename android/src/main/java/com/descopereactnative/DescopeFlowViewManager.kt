package com.descopereactnative

import android.app.Activity
import android.content.Context
import android.net.Uri
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContext
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableMap
import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.UIManagerHelper
import com.facebook.react.uimanager.annotations.ReactProp
import com.facebook.react.uimanager.events.Event

const val REACT_CLASS = "DescopeFlowView"

@ReactModule(name = REACT_CLASS)
class DescopeFlowViewManager(context: ReactApplicationContext) : SimpleViewManager<DescopeFlowView>(), DescopeFlowView.Listener {

  override fun getName(): String = REACT_CLASS

  override fun createViewInstance(context: ThemedReactContext): DescopeFlowView = DescopeFlowView(context)

  override fun getExportedCustomBubblingEventTypeConstants(): Map<String, Any> = mapOf(
    "onReady" to mapOf(
      "phasedRegistrationNames" to mapOf(
        "bubbled" to "onReady",
        "captured" to "onReadyCapture"
      )
    ),
    "onSuccess" to mapOf(
      "phasedRegistrationNames" to mapOf(
        "bubbled" to "onSuccess",
        "captured" to "onSuccessCapture"
      )
    ),
    "onError" to mapOf(
      "phasedRegistrationNames" to mapOf(
        "bubbled" to "onError",
        "captured" to "onErrorCapture"
      )
    )
  )

  @ReactProp(name = "flowOptions")
  fun setFlowOptions(descopeFlowView: DescopeFlowView, flowOptions: ReadableMap?) {
    if (flowOptions == null) throw Exception("flow options are required")
    val url = flowOptions.getString("url")
    if (url.isNullOrEmpty()) throw Exception("flow options must contain a non-empty URL")
    val descopeFlow = DescopeFlow(Uri.parse(url))
    descopeFlow.oauthProvider = flowOptions.getString("oauthProvider")
    descopeFlow.oauthRedirect = flowOptions.getString("oauthRedirect")
    descopeFlow.oauthRedirectCustomScheme = flowOptions.getString("oauthRedirectCustomScheme")
    descopeFlow.ssoRedirect = flowOptions.getString("ssoRedirect")
    descopeFlow.ssoRedirectCustomScheme = flowOptions.getString("ssoRedirectCustomScheme")
    descopeFlow.magicLinkRedirect = flowOptions.getString("magicLinkRedirect")
    descopeFlowView.listener = this
    descopeFlowView.run(descopeFlow)
  }

  // Flow Listener

  override fun onReady(context: Context, id: Int) {
    dispatch(context, id) { surfaceId ->
      ReadyEvent(surfaceId, id)
    }
  }

  override fun onSuccess(context: Context, id: Int, response: String, cookieSessionJwts: List<String>, cookieRefreshJwts: List<String>) {
    dispatch(context, id) { surfaceId ->
      SuccessEvent(surfaceId, id, response, cookieSessionJwts, cookieRefreshJwts)
    }
  }

  override fun onError(context: Context, id: Int, error: String) {
    dispatch(context, id) { surfaceId ->
      ErrorEvent(surfaceId, id, error)
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
  override fun getEventName() = "onReady"
}

class SuccessEvent(
  surfaceId: Int,
  viewId: Int,
  private val response: String,
  private val cookieSessionJwts: List<String>,
  private val cookieRefreshJwts: List<String>,
) : Event<SuccessEvent>(surfaceId, viewId) {
  override fun getEventName() = "onSuccess"
  override fun getEventData(): WritableMap? {
    val cookieSessionArray = Arguments.createArray().apply {
      cookieSessionJwts.forEach {
        pushString(it)
      }
    }
    val cookieRefreshArray = Arguments.createArray().apply {
      cookieRefreshJwts.forEach {
        pushString(it)
      }
    }
    return Arguments.createMap().apply {
      putString("response", response)
      putArray("cookieSessionJwts", cookieSessionArray)
      putArray("cookieRefreshJwts", cookieRefreshArray)
    }
  }
}

class ErrorEvent(
  surfaceId: Int,
  viewId: Int,
  private val error: String,
) : Event<ErrorEvent>(surfaceId, viewId) {
  override fun getEventName() = "onError"
  override fun getEventData() = Arguments.createMap().apply {
    putString("error", error)
  }
}

// Utilities

internal fun activityFromReactContext(context: Context): Activity? {
  val reactContext = context as ReactContext
  return reactContext.getCurrentActivity()
}
