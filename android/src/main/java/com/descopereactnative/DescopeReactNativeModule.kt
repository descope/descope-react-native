package com.descopereactnative

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.util.Base64
import androidx.browser.customtabs.CustomTabsIntent
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKeys
import com.descope.Descope
import com.descope.sdk.DescopeLogger
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.security.MessageDigest
import kotlin.random.Random
import androidx.core.net.toUri
import androidx.core.content.edit

private const val prefName = "com.descope.reactnative"

class DescopeReactNativeModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  private val storage: EncryptedStorage? by lazy { createEncryptedStore(reactContext) }

  override fun getName(): String {
    return NAME
  }

  // Logging

  @ReactMethod
  fun configureLogging(level: String, unsafe: Boolean, promise: Promise) {
    val logLevel = when (level) {
      "error" -> DescopeLogger.Level.Error
      "info" -> DescopeLogger.Level.Info
      else -> DescopeLogger.Level.Debug
    }
    val logger = ReactNativeDescopeLogger(reactContext, logLevel, unsafe)
    Descope.setup(reactContext, projectId = "") {
      this.logger = logger
    }
    promise.resolve(null)
  }

  // Flow

  @ReactMethod
  fun prepFlow(promise: Promise) {
    // create some random bytes
    val randomBytes = ByteArray(32)
    Random.nextBytes(randomBytes)

    // codeVerifier == base64(randomBytes)
    val codeVerifier = String(Base64.encode(randomBytes, Base64.URL_SAFE or Base64.NO_PADDING or Base64.NO_WRAP))

    // hash bytes using sha256
    val md = MessageDigest.getInstance("SHA-256")
    val hashed = md.digest(randomBytes)

    // codeChallenge == base64(sha256(randomBytes))
    val codeChallenge = String(Base64.encode(hashed, Base64.URL_SAFE or Base64.NO_PADDING or Base64.NO_WRAP))

    // resolve the promise with the code verifier and challenge
    promise.resolve(Arguments.makeNativeMap(mapOf("codeVerifier" to codeVerifier, "codeChallenge" to codeChallenge)))
  }

  @ReactMethod
  fun startFlow(flowUrl: String, deepLinkUrl: String, backupCustomScheme: String, codeChallenge: String, promise: Promise) {
    if (flowUrl.isEmpty()) return promise.reject("empty_url", "'flowUrl' is required when calling startFlow")

    // embed into url parameters
    val uriBuilder = flowUrl.toUri().buildUpon()
      .appendQueryParameter("ra-callback", deepLinkUrl)
      .appendQueryParameter("ra-challenge", codeChallenge)
      .appendQueryParameter("ra-initiator", "android")
    if (backupCustomScheme.isNotEmpty()) {
      uriBuilder.appendQueryParameter("ra-backup-callback", backupCustomScheme)
    }
    val uri = uriBuilder.build()

    // launch via chrome custom tabs
    launchUri(reactContext, uri)

    // resolve the promise
    promise.resolve("")
  }

  @ReactMethod
  fun resumeFlow(flowUrl: String, incomingUrl: String, promise: Promise) {
    // create the redirect flow URL by copying all url parameters received from the incoming URI
    val incomingUri = incomingUrl.toUri()
    val uriBuilder = flowUrl.toUri().buildUpon()
    incomingUri.queryParameterNames.forEach { uriBuilder.appendQueryParameter(it, incomingUri.getQueryParameter(it)) }
    val uri = uriBuilder.build()

    // launch via chrome custom tabs
    launchUri(reactContext, uri)
    promise.resolve(flowUrl)
  }

  // Storage

  @ReactMethod
  fun loadItem(key: String, promise: Promise) {
    val value = storage?.loadItem(key)
    promise.resolve(value)
  }

  @ReactMethod
  fun saveItem(key: String, value: String, promise: Promise) {
    storage?.saveItem(key, value)
    promise.resolve(key)
  }

  @ReactMethod
  fun removeItem(key: String, promise: Promise) {
    storage?.removeItem(key)
    promise.resolve(key)
  }

  companion object {
    const val NAME = "DescopeReactNative"
  }
}

private class ReactNativeDescopeLogger(
  private val reactContext: ReactApplicationContext,
  level: Level,
  unsafe: Boolean
) : DescopeLogger(level, unsafe) {
  private val handler = Handler(Looper.getMainLooper())

  override fun output(level: Level, message: String, values: List<Any>) {
    val levelString = when (level) {
      Level.Error -> "error"
      Level.Info -> "info"
      Level.Debug -> "debug"
    }

    val valuesArray = Arguments.createArray().apply {
      values.forEach { pushString(it.toString()) }
    }

    val body = Arguments.createMap().apply {
      putString("level", levelString)
      putString("message", message)
      putArray("values", valuesArray)
    }

    handler.post {
      reactContext
        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        .emit("descopeLog", body)
    }
  }
}

private fun launchUri(context: Context, uri: Uri) {
  val customTabsIntent = CustomTabsIntent.Builder()
    .setUrlBarHidingEnabled(true)
    .setShowTitle(true)
    .setShareState(CustomTabsIntent.SHARE_STATE_OFF)
    .build()
  customTabsIntent.intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
  customTabsIntent.launchUrl(context, uri)
}

private class EncryptedStorage(context: Context) {
  private val masterKey = MasterKeys.getOrCreate(MasterKeys.AES256_GCM_SPEC)
  private val sharedPreferences = EncryptedSharedPreferences.create(
    prefName,
    masterKey,
    context,
    EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
    EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
  )

  fun loadItem(key: String): String? = sharedPreferences.getString(key, null)

  fun saveItem(key: String, data: String) = sharedPreferences.edit { putString(key, data) }

  fun removeItem(key: String) = sharedPreferences.edit { remove(key) }
}

private fun createEncryptedStore(context: Context): EncryptedStorage? {
  return try {
    EncryptedStorage(context)
  } catch (e: Exception) {
    try {
      // encrypted storage key unusable - deleting and recreating
      // see google issue https://issuetracker.google.com/issues/164901843
      context.deleteSharedPreferences(prefName)
      EncryptedStorage(context)
    } catch (e: Exception) {
      // unable to initialize encrypted storage
      null
    }
  }
}
