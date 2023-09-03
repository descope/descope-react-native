package com.descopereactnative

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.util.Base64
import androidx.browser.customtabs.CustomTabsIntent
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKeys
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.security.MessageDigest
import kotlin.random.Random

class DescopeReactNativeModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  private val storage: EncryptedStorage by lazy { EncryptedStorage(reactContext) }

  override fun getName(): String {
    return NAME
  }

  // Flow

  @ReactMethod
  fun startFlow(flowUrl: String, deepLinkUrl: String, promise: Promise) {
    if (flowUrl.isEmpty()) return promise.reject("empty_url", "'flowUrl' is required when calling startFlow")

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

    // embed into url parameters
    val uri = Uri.parse(flowUrl).buildUpon()
      .appendQueryParameter("ra-callback", deepLinkUrl)
      .appendQueryParameter("ra-challenge", codeChallenge)
      .appendQueryParameter("ra-initiator", "android")
      .build()

    // launch via chrome custom tabs
    launchUri(reactContext, uri)

    // resolve the promise with the code verifier
    promise.resolve(Arguments.makeNativeMap(mapOf("codeVerifier" to codeVerifier)))
  }

  @ReactMethod
  fun resumeFlow(flowUrl: String, incomingUrl: String, promise: Promise) {
    // create the redirect flow URL by copying all url parameters received from the incoming URI
    val incomingUri = Uri.parse(incomingUrl)
    val uriBuilder = Uri.parse(flowUrl).buildUpon()
    incomingUri.queryParameterNames.forEach { uriBuilder.appendQueryParameter(it, incomingUri.getQueryParameter(it)) }
    val uri = uriBuilder.build()

    // launch via chrome custom tabs
    launchUri(reactContext, uri)
  }

  // Storage

  @ReactMethod
  fun loadItem(key: String, promise: Promise) {
    val value = storage.loadItem(key)
    promise.resolve(value)
  }

  @ReactMethod
  fun saveItem(key: String, value: String, promise: Promise) {
    storage.saveItem(key, value)
    promise.resolve(key)
  }

  @ReactMethod
  fun removeItem(key: String, promise: Promise) {
    storage.removeItem(key)
    promise.resolve(key)
  }

  companion object {
    const val NAME = "DescopeReactNative"
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
    "com.descope.reactnative",
    masterKey,
    context,
    EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
    EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
  )

  fun loadItem(key: String): String? = sharedPreferences.getString(key, null)

  fun saveItem(key: String, data: String) = sharedPreferences.edit()
    .putString(key, data)
    .apply()

  fun removeItem(key: String) = sharedPreferences.edit()
    .remove(key)
    .apply()
}
