import UIKit
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider
import RNBootSplash
import react_native_stallion
import react_native_config

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ReactNativeDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    guard let environment = Bundle.main.object(forInfoDictionaryKey: "AppEnvironment") as? String,
          ["development", "production"].contains(environment) else {
      preconditionFailure("Native application environment is missing or invalid")
    }
    precondition(environment == RNCConfig.env(for: "APP_ENV"), "Native application environment mismatch")
    let development = environment == "development"
    let expectedId = development ? "org.reactjs.native.example.RestoFlow.dev" : "org.reactjs.native.example.RestoFlow"
    let expectedProject = "6aca880b9f76d8bbbc714eef"
    precondition(Bundle.main.bundleIdentifier == expectedId, "Native application identity mismatch")
    precondition(Bundle.main.object(forInfoDictionaryKey: "StallionProjectId") as? String == expectedProject, "Stallion project mismatch")
    let delegate = ReactNativeDelegate()
    let factory = RCTReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory

    window = UIWindow(frame: UIScreen.main.bounds)

    factory.startReactNative(
      withModuleName: "RestoFlow",
      in: window,
      launchOptions: launchOptions
    )

    return true
  }
}

class ReactNativeDelegate: RCTDefaultReactNativeFactoryDelegate {
  override func customize(_ rootView: RCTRootView) {
    super.customize(rootView)
    RNBootSplash.initWithStoryboard("BootSplash", rootView: rootView)
  }

  override func sourceURL(for bridge: RCTBridge) -> URL? {
    self.bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
#else
    StallionModule.getBundleURL()
#endif
  }
}
