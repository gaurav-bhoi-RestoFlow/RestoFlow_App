package com.restoflow

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.common.assets.ReactFontManager
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.stallion.Stallion
import com.restoflow.ledger.LedgerFilesPackage
import com.restoflow.printing.BluetoothReceiptPrinterPackage
import com.restoflow.profile.ProfilePhotoPackage

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          add(LedgerFilesPackage())
          add(BluetoothReceiptPrinterPackage())
          add(ProfilePhotoPackage())
        },
      jsBundleFilePath = if (BuildConfig.DEBUG) null else Stallion.getJSBundleFile(applicationContext),
      useDevSupport = BuildConfig.DEBUG,
    )
  }

  override fun onCreate() {
    super.onCreate()
    check(BuildConfig.APP_ENV == BuildConfig.NATIVE_APP_ENV) { "Native application environment mismatch" }
    val expectedId = if (BuildConfig.NATIVE_APP_ENV == "development") "com.restoflow.dev" else "com.restoflow"
    check(packageName == expectedId) { "Native application identity mismatch" }
    val expectedProject = if (BuildConfig.NATIVE_APP_ENV == "development") "6aca897a03fc44c9897cf2b5" else "6aca880b9f76d8bbbc714eef"
    check(getString(R.string.StallionProjectId) == expectedProject) { "Stallion project mismatch" }
    ReactFontManager.getInstance().addCustomFont(this, "SF Pro Display", R.font.sf_pro_display)
    loadReactNative(this)
  }
}
