package com.descopereactnative

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import androidx.browser.customtabs.CustomTabsIntent

const val CUSTOM_TAB_URL = "customTabUrl"

class DescopeHelperActivity : Activity() {
    private var listenForClose = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        @Suppress("DEPRECATION")
        val url: Uri? = intent?.getParcelableExtra(CUSTOM_TAB_URL)
        listenForClose = false
        if (url == null) {
            finish()
            return
        }

        activityHelper.customTabsIntent?.launchUrl(this, url)
    }

    override fun onResume() {
        super.onResume()
        // this activity will resume again if the user cancels the operation
        // in that case we want to close the activity, otherwise it will
        // interfere with user input, etc.
        if (listenForClose) {
            listenForClose = false
            finish()
        } else {
            listenForClose = true
        }
    }
}

// Activity Helper

internal interface ActivityHelper {
  val customTabsIntent: CustomTabsIntent?
  fun openCustomTab(context: Context, customTabsIntent: CustomTabsIntent, url: Uri)
  fun closeCustomTab(context: Context)
}

internal val activityHelper = object : ActivityHelper {
  override var customTabsIntent: CustomTabsIntent? = null

  override fun openCustomTab(context: Context, customTabsIntent: CustomTabsIntent, url: Uri) {
    this.customTabsIntent = customTabsIntent
    val activity = activityFromReactContext(context)
    (activityFromReactContext(context))?.let { activity ->
      println("Here $url")
      try {
        activity.startActivity(Intent(activity, DescopeHelperActivity::class.java).apply { putExtra(CUSTOM_TAB_URL, url); flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP })
      } catch (e: Exception) {
        println("Failed! $e")
      }
      return
    }
    throw Exception("Custom tabs require the given context to be an Activity")
  }

  override fun closeCustomTab(context: Context) {
    if (this.customTabsIntent == null) return
    this.customTabsIntent = null
    (activityFromReactContext(context))?.let { activity ->
      activity.startActivity(Intent(activity, DescopeHelperActivity::class.java).apply { flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP })
      return
    }
    throw Exception("Custom tabs require the given context to be an Activity")
  }
}

// Custom Tab

fun launchCustomTab(context: Context, url: String, customTabsIntent: CustomTabsIntent? = null) {
  launchCustomTab(context, Uri.parse(url), customTabsIntent)
}

fun launchCustomTab(context: Context, uri: Uri, customTabsIntent: CustomTabsIntent? = null) {
  activityHelper.openCustomTab(context, customTabsIntent ?: defaultCustomTabIntent(), uri)
}

internal fun defaultCustomTabIntent(): CustomTabsIntent {
  return CustomTabsIntent.Builder()
    .setUrlBarHidingEnabled(true)
    .setShowTitle(true)
    .setShareState(CustomTabsIntent.SHARE_STATE_OFF)
    .setBookmarksButtonEnabled(false)
    .setDownloadButtonEnabled(false)
    .setInstantAppsEnabled(false)
    .build()
}
