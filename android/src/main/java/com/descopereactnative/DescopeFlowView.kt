package com.descopereactnative

import android.content.Context
import android.net.Uri
import android.view.ViewGroup
import android.view.ViewGroup.LayoutParams.MATCH_PARENT
import android.webkit.WebView


class DescopeFlow(val uri: Uri) {
  /**
   * The ID of the oauth provider that is configured to correctly "Sign In with Google".
   * Will likely be "google" if the Descope "Google" provider was customized,
   * or alternatively a custom provider ID.
   */
  var oauthProvider: String? = null

  /**
   * An optional deep link link URL to use when performing OAuth authentication, overriding
   * whatever is configured in the flow or project.
   * - **IMPORTANT NOTE**: even though App Links are the recommended way to configure
   * deep links, some browsers, such as Opera, do not respect them and open the URLs inline.
   * It is possible to circumvent this issue by providing a custom scheme based URL via [oauthRedirectCustomScheme].
   */
  var oauthRedirect: String? = null

  /**
   * An optional custom scheme based URL, e.g. `mycustomscheme://myhost`,
   * to use when performing OAuth authentication overriding whatever is configured in the flow or project.
   * Functionally, this URL is exactly the same as [oauthRedirect], and will be used in its stead, only
   * when the user has a default browser that does not honor App Links by default.
   * That means the `https` based App Links are opened inline in the browser, instead
   * of being handled by the application.
   */
  var oauthRedirectCustomScheme: String? = null

  /**
   * An optional deep link link URL to use performing SSO authentication, overriding
   * whatever is configured in the flow or project
   * - **IMPORTANT NOTE**: even though App Links are the recommended way to configure
   * deep links, some browsers, such as Opera, do not respect them and open the URLs inline.
   * It is possible to circumvent this issue by providing a custom scheme via [ssoRedirectCustomScheme]
   */
  var ssoRedirect: String? = null

  /**
   * An optional custom scheme based URL, e.g. `mycustomscheme://myhost`,
   * to use when performing SSO authentication overriding whatever is configured in the flow or project.
   * Functionally, this URL is exactly the same as [ssoRedirect], and will be used in its stead, only
   * when the user has a default browser that does not honor App Links by default.
   * That means the `https` based App Links are opened inline in the browser, instead
   * of being handled by the application.
   */
  var ssoRedirectCustomScheme: String? = null

  /**
   * An optional deep link link URL to use when sending magic link emails, overriding
   * whatever is configured in the flow or project
   */
  var magicLinkRedirect: String? = null

//  /**
//   * Customize the [DescopeFlowView] presentation by providing a [Presentation] implementation
//   */
//  var presentation: Presentation? = null
//
//  /**
//   * Customize the flow's presentation by implementing the [Presentation] interface.
//   */
//  interface Presentation {
//    /**
//     * Provide your own [CustomTabsIntent] that will be used when a custom tab
//     * is required, e.g. when performing web-based OAuth authentication,
//     * or when [DescopeFlowView.NavigationStrategy.OpenBrowser] is returned for navigation events,
//     * which is also the default behavior.
//     * @param context The context the [DescopeFlowView] resides inside.
//     * @return A [CustomTabsIntent]. Returning `null` will use the default custom tab intent.
//     */
//    fun createCustomTabsIntent(context: Context): CustomTabsIntent?
//  }
}

class DescopeFlowView(context: Context) : ViewGroup(context), DescopeFlowCoordinator.Listener {

  internal lateinit var listener: Listener

  private lateinit var flowCoordinator: DescopeFlowCoordinator
  private var deepLink: String? = null

  init {
    initView()
  }

  private fun initView() {
    val webView = WebView(context)
    addView(webView, LayoutParams(MATCH_PARENT, MATCH_PARENT))
    this.flowCoordinator = DescopeFlowCoordinator(webView, this)
    fitsSystemWindows = true
  }

  override fun onLayout(changed: Boolean, left: Int, top: Int, right: Int, bottom: Int) {
    for (i in 0 until childCount) {
      val child = getChildAt(i)
      child.layout(0, 0, width, height);
    }
  }


  // API

  fun run(flow: DescopeFlow) {
    flowCoordinator.run(flow)
  }

  fun resumeFromDeepLink(deepLink: String?) {
    if (deepLink?.isNotEmpty() == true && this.deepLink != deepLink) {
      this.deepLink = deepLink
      flowCoordinator.resumeFromDeepLink(Uri.parse(deepLink))
    }
  }

  // Listener

  override fun onReady() {
    listener.onReady(context, id)
  }

  override fun onSuccess(response: String, cookieSessionJwts: List<String>, cookieRefreshJwts: List<String>) {
    listener.onSuccess(context, id, response, cookieSessionJwts, cookieRefreshJwts)
  }

  override fun onError(error: String) {
    listener.onError(context, id, error)
  }

  interface Listener {
    fun onReady(context: Context, id: Int)
    fun onSuccess(context: Context, id: Int, response: String, cookieSessionJwts: List<String>, cookieRefreshJwts: List<String>)
    fun onError(context: Context, id: Int, error: String)
    // TODO:
//    fun onNavigation(uri: Uri): NavigationStrategy = NavigationStrategy.OpenBrowser
  }

  enum class State {
    Initial,
    Started,
    Ready,
    Failed,
    Finished,
  }

}
