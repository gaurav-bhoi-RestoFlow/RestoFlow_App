# Shared Stallion project — 3 November 2026

DEV and PROD now use the existing `restoflow` project (`6aca880b9f76d8bbbc714eef`)
and its shared App Token, with `dev` and `prod` upload buckets. This supersedes
the separate-project mappings in the historical records below. Release environment
validation and nine infrastructure tests pass. `yarn android:dev:release` built,
installed and launched on the SM-A176B phone and Pixel 7 Pro emulator. The release
APK's shared project ID, App Token and compatibility hash were checked.
Buckets do not isolate automatic
releases by environment; see [INFRASTRUCTURE.md](INFRASTRUCTURE.md) for the current
upload and testing workflow. No live OTA upload or promotion was performed.

# Current API integration — 24 October 2026

Runtime mock implementations have been replaced with backend password authentication,
secure credentials, and server restaurant operations. The exact DEV/PROD Worker
origins are enforced without fallback. See [API_INTEGRATION.md](API_INTEGRATION.md)
for current verification and backend/native release prerequisites. The older
checks below are historical records and do not describe current mock behavior.

# Infrastructure implementation and verification

Verified on 11 October 2026. User-directed mock setup remains active; this is not a claim of verified production OTA operation.

## Android standalone demo release — 12 October 2026

`yarn android:dev:release` now succeeds with `MOCK_API=true`: the APK builds for all four configured architectures, passes release lint, installs on the Android 16 emulator, and opens the welcome screen. The APK contains `assets/index.android.bundle` and is not debuggable. Mock builds skip both the Stallion JavaScript import and native package initialization; the final app process logs show React Native startup with no Stallion requests or fatal errors.

Fixed validation running on a shared CMake/preBuild dependency from the production flavor by moving it to flavor-specific BuildConfig and bundle tasks. Development mock releases explicitly allow demo configuration; service releases, production releases and OTA publishing retain their existing requirements. The development network security domains now specify `includeSubdomains="false"`, resolving three fatal release lint errors.

Verification passed: seven infrastructure tests, seven targeted app tests (including release/mock OTA initialization), TypeScript, changed-source ESLint checks and `git diff --check`. The APK is `android/app/build/outputs/apk/development/release/app-development-release.apk`. Real service/OTA acceptance and iOS release compilation remain pending as described below.

## Results

| Check                                     | Result | Evidence / remaining work                                                                  |
| ----------------------------------------- | ------ | ------------------------------------------------------------------------------------------ |
| Axios installed and centralized           | YES    | One primary client; translations use it; transport/interceptor/error tests pass            |
| Redux Toolkit installed                   | YES    | Session slice, configureStore and Provider integrated                                      |
| Typed Redux hooks implemented             | YES    | TypeScript check passes                                                                    |
| MMKV installed                            | YES    | Android native compile and emulator initialization                                         |
| MMKV wrapper implemented                  | YES    | Typed helpers and migration tests pass                                                     |
| react-native-config installed             | YES    | Autolinking, compiled flavor values, emulator startup                                      |
| .env.development works                    | YES    | Android Debug mock values validated; real API not tested                                   |
| .env.production works                     | YES    | Android Debug mock values validated; real API not tested                                   |
| Android development flavor works          | YES    | developmentDebug APK built, installed, launched and signed in                              |
| Android production flavor works           | YES    | productionDebug APK built, installed, launched and signed in                               |
| iOS development configuration works       | NO     | Config/scheme structure checked; macOS compile/archive pending                             |
| iOS production configuration works        | NO     | Config/scheme structure checked; macOS compile/archive pending                             |
| BootSplash works Android                  | YES    | Both mock apps dismiss native splash and show navigation                                   |
| BootSplash works iOS                      | NO     | Storyboard/root customization wired; native execution pending                              |
| Stallion SDK installed                    | YES    | Exact SDK 2.4.2 and stable CLI 2.5.1                                                       |
| Stallion Android native integration works | NO     | Compiles and resources inspected; Release bundle loading/service initialization not tested |
| Stallion iOS native integration works     | NO     | Swift/Info.plist/Podfile wired; compile and device execution pending                       |
| DEV points to restoflow-dev               | YES    | Compiled Android resource mapping; iOS config static check                                 |
| PROD points to restoflow                  | YES    | Compiled Android resource mapping; iOS config static check                                 |
| DEV Stallion ID correct                   | YES    | 6aca897a03fc44c9897cf2b5 inspected in APK                                                  |
| PROD Stallion ID correct                  | YES    | 6aca880b9f76d8bbbc714eef inspected in APK                                                  |
| DEV cannot receive PROD OTA               | NO     | Wrong-project publishing negative tests pass; live device isolation test deferred          |
| PROD cannot receive DEV OTA               | NO     | Native project separation configured; live device isolation test deferred                  |
| Release-mode DEV OTA tested               | NO     | Tokens/API/bucket paths deferred by user; no live uploads                                  |
| Native-change OTA restrictions documented | YES    | Guide plus embedded native compatibility fingerprints/baseline guard                       |
| Production release process documented     | YES    | Exact version targeting, DEV acceptance and controlled rollout                             |
| Rollback process documented               | YES    | Console pause/unpause/rollback and device recovery checks                                  |
| Tokens not printed/logged                 | YES    | No supplied tokens; scripts avoid/redact runtime/CI values                                 |
| Signing private keys not committed        | YES    | No keys generated; ignore rules and public-only native injection                           |

YES for environment/project mapping means inspected configuration, not live backend ownership or OTA delivery. Production and development app tokens are **unconfigured** pending the user's later values.

## Commands executed and outcomes

Read-only inspection included package.json/package-lock, TypeScript and entrypoints, Android Gradle/native/resource files, iOS Podfile/project/scheme/plist/delegate, navigation/auth/persistence/localization and git status. Existing uncommitted work was preserved. Package versions/compatibility were checked with npm metadata, installed source and primary vendor documentation.

| Command / check                                                                                                        | Outcome                                                                                                              |
| ---------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| npm view for requested packages and stable CLI                                                                         | Verified exact versions and peer ranges                                                                              |
| npm install --save-exact --legacy-peer-deps (eight required packages)                                                  | Success                                                                                                              |
| npm install --save-dev --save-exact --legacy-peer-deps stallion-cli@2.5.1                                              | Success                                                                                                              |
| npm view figlet@1.11.3; scoped override; npm install --legacy-peer-deps                                                | Success; patched new CLI transitive dependency                                                                       |
| npm audit --json                                                                                                       | Reviewed; final installation still reports 56 advisories: 8 moderate, 48 high; no broad dependency upgrade attempted |
| node node_modules/stallion-cli/index.js --version                                                                      | 2.5.1                                                                                                                |
| Stallion publish-bundle/release-bundle --help                                                                          | Stable flags verified; upload and promotion kept separate                                                            |
| Installed RN CLI run-android/run-ios --help                                                                            | --mode, --scheme and appId flags verified                                                                            |
| BootSplash generate assets/icons/cutlery.svg --platforms android,ios --background F6F5EF --logo-width 88               | Generated native branding assets/resources/storyboard                                                                |
| npm run native:configure                                                                                               | Success; ignored local iOS settings generated with blank tokens                                                      |
| validate-environment.mjs development / production                                                                      | Both Debug mock configurations pass                                                                                  |
| npm run typecheck                                                                                                      | Pass                                                                                                                 |
| npm run lint                                                                                                           | Pass, zero errors; three existing no-void warnings in localization/settings files                                    |
| npm test -- --runInBand                                                                                                | Pass: 89 tests, six suites                                                                                           |
| npm run test:infrastructure                                                                                            | Pass: seven publishing/build-guard/configuration tests                                                               |
| Prettier write/check on changed JS/TS/JSON/Markdown files                                                              | Pass; native/shell formats outside Prettier are excluded                                                             |
| git diff --check                                                                                                       | Pass                                                                                                                 |
| ./gradlew :app:tasks --all --console=plain                                                                             | Success; four requested variants and two DebugOptimized variants confirmed                                           |
| ./gradlew :app:assembleDevelopmentDebug :app:assembleProductionDebug -PreactNativeArchitectures=x86_64 --console=plain | Success; both native APKs compile                                                                                    |
| Gradle validateDevelopmentReleaseEnvironment / validateProductionReleaseEnvironment --continue                         | Expected failures: mocks rejected; production signing required                                                       |
| aapt2 dump badging/resources for both APKs                                                                             | Correct app IDs, display names, project IDs and native compatibility hashes                                          |
| adb devices / install -r both APKs / reverse tcp:8081 tcp:8081                                                         | Emulator available; both apps installed side by side                                                                 |
| adb am start, screenshot inspection, demo Continue action and current-process ReactNativeJS logs                       | Both start normally; native splash hides; demo Redux sign-in reaches dashboard                                       |
| adb run-as com.restoflow.dev / com.restoflow ls files/mmkv                                                             | Separate restoflow.development and restoflow.production storage files                                                |
| DEV/PROD OTA helper --dry-run with meaningful notes/native version                                                     | Expected refusal: real upload paths unconfigured; nothing uploaded                                                   |
| Xcode project parser and scheme/configuration checks                                                                   | Four configurations and two schemes parse correctly; PROD bundle expression preserved                                |
| pod install                                                                                                            | Cannot run: Ruby/CocoaPods absent on Linux; npx pod-install attempt also stopped                                     |
| xcodebuild -list -project ios/RestoFlow.xcodeproj                                                                      | Cannot run: Xcode absent on Linux                                                                                    |

During implementation, initial Jest execution exposed an ESM transform issue in Immer; Jest now transforms the Redux dependencies and all tests pass. Initial TypeScript/header typing and native fingerprint inspection buffer issues were corrected before final checks. The default Node test runner's isolated subprocess execution was unsuitable in the managed environment; infrastructure tests run with --test-isolation=none and report all seven tests. Those implementation checks do not stand in for native OTA testing.

The existing Gradle toolchain emits AGP deprecation and AsyncStorage KSP/Kotlin alignment warnings. Compilation succeeds. Native iOS compile, release binary execution, signing verification, real backend acceptance and end-to-end OTA isolation remain unverified. Source-map upload and production monitoring remain unconfigured because no monitoring service exists.

## Files created

Configuration: `.env.development`, `.env.production`, `.env.stallion.local.example`, `config/environments.json`, `src/config/env.ts`, `src/config/validateEnv.ts`, `src/types/react-native-config.d.ts`.

Application: `src/api/client.ts`, `src/api/errors.ts`, `src/api/types.ts`, `src/services/auth/credentials.ts`, `src/services/storage/mmkv.ts`, `src/services/storage/storage.ts`, `src/services/storage/storageKeys.ts`, `src/store/index.ts`, `src/store/hooks.ts`, `src/store/slices/sessionSlice.ts`, `src/app/bootstrap.ts`.

Tooling/tests: `scripts/environment-utils.mjs`, `scripts/validate-environment.mjs`, `scripts/configure-native.mjs`, `scripts/validate-ios.sh`, `scripts/native-baseline.mjs`, `scripts/native-fingerprint.mjs`, `scripts/stallion-publish.mjs`, `scripts/__tests__/publishing.test.mjs`, `__tests__/apiClient.test.ts`, `__tests__/infrastructure.test.ts`.

Android: `android/app/src/development/res/values/strings.xml`, `android/app/src/production/res/values/strings.xml`, `android/app/src/developmentRelease/AndroidManifest.xml`, `android/app/src/developmentRelease/res/xml/development_network_security_config.xml`, `android/app/src/main/res/values/colors.xml`, and `bootsplash_logo.png` in each `drawable-mdpi`, `drawable-hdpi`, `drawable-xhdpi`, `drawable-xxhdpi`, `drawable-xxxhdpi` resource directory.

iOS: `ios/Config/Debug-Development.xcconfig`, `ios/Config/Release-Development.xcconfig`, `ios/Config/Debug-Production.xcconfig`, `ios/Config/Release-Production.xcconfig`, shared `RestoFlowDev.xcscheme` / `RestoFlowProd.xcscheme`, `ios/RestoFlow/BootSplash.storyboard`, `ios/RestoFlow/Colors.xcassets/BootSplashBackground-b8c973.colorset/Contents.json`, and `ios/RestoFlow/Images.xcassets/BootSplashLogo-b8c973.imageset/Contents.json` plus `logo-b8c973.png`, `logo-b8c973@2x.png`, `logo-b8c973@3x.png`.

Generated shared assets: `assets/bootsplash/manifest.json`, `logo.png`, `logo@1,5x.png`, `logo@2x.png`, `logo@3x.png`, `logo@4x.png`.

Documentation: `docs/INFRASTRUCTURE.md`, `docs/INFRASTRUCTURE_VERIFICATION.md`. Generated local native settings `ios/Config/Stallion.local.xcconfig` are ignored and contain no configured tokens in this mock checkout.

## Files modified / replaced

`.gitignore`, `package.json`, `package-lock.json`, `App.tsx`, `jest.config.js`, `jest.setup.js`, `README.md`, `src/app/AppNavigator.tsx`, `src/features/auth/SessionProvider.tsx`, `src/services/storage/restaurantStorage.ts`, `src/localization/LocalizationProvider.tsx`, `src/localization/services/translationApi.ts`, `src/localization/config/apiConfig.ts`, `scripts/configure-i18n.mjs`, `docs/LOCALIZATION.md`.

Native files: `android/app/build.gradle`, `android/build.gradle`, `android/app/src/main/AndroidManifest.xml`, `android/app/src/main/res/values/styles.xml`, `MainActivity.kt`, `MainApplication.kt`, `ios/Podfile`, `ios/RestoFlow.xcodeproj/project.pbxproj`, `ios/RestoFlow/AppDelegate.swift`, `ios/RestoFlow/Info.plist`. The old shared `RestoFlow.xcscheme` was replaced by the two explicit environment schemes; no additional Xcode targets were created.

Other changes shown by git status existed before this work and were retained.
