# RestoFlow application infrastructure

This checkout uses real backend password authentication and server restaurant data.
See [API_INTEGRATION.md](API_INTEGRATION.md) for the current implementation,
exact DEV/PROD Worker origins, secure credential storage, and backend deployment
prerequisites. All mock runtime paths and the development mock release bypass
have been removed. The historical setup notes below describe the original
infrastructure; current API and authentication behavior is defined by the
integration guide.

## Project inspection

| Setting                            | Existing value retained                                                                 |
| ---------------------------------- | --------------------------------------------------------------------------------------- |
| React Native / React               | 0.87.1 / 19.2.3                                                                         |
| TypeScript / package manager       | TypeScript 6.0.3 / npm with package-lock.json                                           |
| Architecture / runtime             | New Architecture / Hermes                                                               |
| Android Gradle Plugin / Gradle     | 9.2.1 / 9.4.1                                                                           |
| Kotlin                             | Root setting 2.2.0; RN Gradle plugin resolves 2.2.10                                    |
| Android min / target / compile SDK | 24 / 36 / 37                                                                            |
| Android build tools / NDK          | 37.0.0 / 27.1.12297006                                                                  |
| Gradle daemon toolchain            | Java 25, requested by the existing daemon configuration                                 |
| iOS deployment target              | 15.1                                                                                    |
| Navigation                         | React Navigation 7, native stack and bottom tabs                                        |
| Existing state                     | Restaurant context/reducer and local session context                                    |
| Existing API                       | Hono translation API only, originally using fetch                                       |
| Existing authentication            | Backend phone/password; rotating access/refresh tokens in native secure storage |
| Existing persistence               | AsyncStorage for restaurant data and localization                                       |
| Previous splash / OTA              | Template launch screen / none; no CodePush                                              |

No React Native upgrade was needed. Existing AsyncStorage and restaurant state are retained where they have separate responsibilities. Redux owns account details; RestaurantProvider loads server state.

## Exact installed versions

| Package                       | Version |
| ----------------------------- | ------- |
| axios                         | 1.20.0  |
| @reduxjs/toolkit              | 2.13.0  |
| react-redux                   | 9.3.0   |
| react-native-config           | 1.7.2   |
| react-native-mmkv             | 4.3.2   |
| react-native-nitro-modules    | 0.37.1  |
| react-native-bootsplash       | 7.3.4   |
| react-native-stallion         | 2.4.2   |
| stallion-cli (dev dependency) | 2.5.1   |

All required packages were accepted. Legacy Redux, redux-persist and react-native-splash-screen were not added. The existing `react-native-print` Windows peer conflict still requires `npm ci --legacy-peer-deps`. Stallion's missing Android namespace/buildConfig support is supplied in the root Gradle configuration for AGP 9. A scoped npm override uses figlet 1.11.3 within stallion-cli, fixing the CLI's vulnerable pinned 1.8.1 dependency without changing its APIs.

## Environment selection and identities

|                     | DEVELOPMENT                              | PRODUCTION                                     |
| ------------------- | ---------------------------------------- | ---------------------------------------------- |
| Env file            | .env.development                         | .env.production                                |
| APP_ENV             | development                              | production                                     |
| API origin          | Existing http://10.0.2.2:8787            | Literal `<PRODUCTION_BACKEND_URL>` placeholder |
| Display name        | RestoFlow Dev                            | RestoFlow                                      |
| Android ID          | com.restoflow.dev                        | com.restoflow                                  |
| iOS bundle ID       | org.reactjs.native.example.RestoFlow.dev | org.reactjs.native.example.RestoFlow           |
| iOS scheme          | RestoFlowDev                             | RestoFlowProd                                  |
| Stallion project    | restoflow                                | restoflow                                      |
| Stallion project ID | 6aca880b9f76d8bbbc714eef                 | 6aca880b9f76d8bbbc714eef                       |
| Stallion bucket     | dev                                      | prod                                           |

The original production IDs are preserved. The iOS production build setting retains its original `org.reactjs.native.example.$(PRODUCT_NAME:rfc1034identifier)` expression; its resolved value is shown above. `config/environments.json` holds the environment matrix used by Android and release tooling. The committed iOS configs mirror that matrix and are checked by infrastructure tests.

Android flavors set APP_ENV/API values per variant, even when multiple variants are built together. iOS uses four configurations on one target: `Debug-Development`, `Release-Development`, `Debug-Production`, `Release-Production`. Archive actions use the matching Release configuration. Podfile maps all four configurations and sets the pod's ENVFILE deterministically. No copying/renaming `.env` files or global `/tmp/envfile` is used; an obsolete `/tmp/envfile` causes iOS builds to fail.

`src/config/env.ts` is the sole react-native-config access point. Native startup validates app identity, APP_ENV and Stallion project. `__DEV__` controls development features/Metro, never the environment. DEV and PROD backend origins must differ. Real API origins must use HTTPS, with HTTP allowed only for explicit local DEV hosts. DEV Release has a network security config allowing those local hosts. Production releases do not enable cleartext networking.

## Commands

```sh
npm ci --legacy-peer-deps
npm start
npm run android:dev
npm run android:prod
npm run android:dev:release
npm run android:prod:release

# On macOS, first configure native tokens and install pods:
npm run native:configure
bundle install
cd ios
bundle exec pod install
cd ..
npm run ios:dev
npm run ios:prod
npm run ios:dev:release
npm run ios:prod:release

npm run env:check -- development
npm run env:check -- production
npm run typecheck
npm run lint
npm test -- --runInBand
npm run test:infrastructure
```

CLI 20.2.0 uses `--mode` and iOS `--scheme`; these scripts use the installed CLI's supported flags. Android task discovery confirmed developmentDebug, developmentRelease, productionDebug and productionRelease, plus the RN template's developmentDebugOptimized/productionDebugOptimized variants. All Debug variants use Metro; Release variants load embedded or Stallion-managed bundles.

Development release builds use the DEV Worker origin and require real Stallion
configuration. They embed JavaScript for operation without Metro. The former
mock release bypass is removed.

For iOS archives after configuring the real environment and signing team:

```sh
xcodebuild -workspace ios/RestoFlow.xcworkspace -scheme RestoFlowDev \
  -configuration Release-Development -destination 'generic/platform=iOS' \
  -archivePath build/RestoFlowDev.xcarchive archive
xcodebuild -workspace ios/RestoFlow.xcworkspace -scheme RestoFlowProd \
  -configuration Release-Production -destination 'generic/platform=iOS' \
  -archivePath build/RestoFlowProd.xcarchive archive
```

## Configure the real services later

1. Use the pinned API origins in each env file. Keep PROD logging false. `npm run i18n:configure` remains available to update the same native env files using RESTOFLOW_DEV_API_URL/RESTOFLOW_PROD_API_URL.
2. Copy `.env.stallion.local.example` to ignored `.env.stallion.local`. Set both environment App Tokens to the shared `restoflow` project's App Token. Upload paths are `nexgen/restoflow/dev` and `nexgen/restoflow/prod`. Do not substitute App Tokens for dedicated CLI/CI tokens.
3. Run `npm run native:configure` to generate the ignored iOS native-only settings. Android reads the ignored local file or the corresponding process variables at build time. Tokens never enter mobile env files or package scripts.
4. Configure bundle signing before any production release. Use different RSA keys per environment. Run the installed CLI's `generate-key-pair` command in isolated temporary working directories and move only the public PEM to `stallion/public/development.pem` or `stallion/public/production.pem`. Keep private keys in ignored `stallion/secrets/` or the CI secret store. Set the corresponding PUBLIC_KEY_PATH and PRIVATE_KEY entries in the local template. Production native builds require the public key; production uploads require the matching private key. The build embeds the SPKI base64 public body accepted by SDK 2.4.2's native verifiers, avoiding plist newline escaping.
5. Provide real production Android signing through RESTOFLOW_PROD_KEYSTORE, RESTOFLOW_PROD_STORE_PASSWORD, RESTOFLOW_PROD_KEY_ALIAS, RESTOFLOW_PROD_KEY_PASSWORD. DEV uses the existing debug keystore for internal binaries. Production releases never silently use that key. Configure the iOS development team/provisioning on macOS.
6. Rebuild native binaries and reinstall pods. This integration adds native dependencies and cannot itself be shipped as an OTA update.

Bundled mobile config is extractable. Never put backend secrets, private keys or CI tokens in react-native-config, app JS, Info.plist, or native resources. Runtime App Tokens are native client configuration; private signing and CLI/CI credentials remain separate.

## Application services

`src/api/client.ts` uses the pinned native Worker origin, a 15-second timeout,
secure Bearer credentials, and normalized backend errors. Concurrent 401s share
one real `/auth/refresh` request and retry once; revoked sessions sign out.
Translation generation retains its separate timeout. See the API integration
guide for current account and restaurant flows.

Requests reject absolute URLs and baseURL overrides before transport. Successful and failed HTTP responses require `X-RestoFlow-Environment` to match the binary. Logging is restricted to the HTTP method in DEV debug mode; URLs, bodies, query strings, response payloads, headers and credentials are never logged. AbortController signals are supported directly. The real backend must maintain the environment header and avoid redirects to another origin; real server ownership/isolation requires deployed-backend acceptance tests.

`src/store` exports configureStore, RootState, AppDispatch and typed hooks. The session slice owns sign-in/sign-out; SessionProvider preserves the existing screen API. Redux Provider wraps existing providers. Local input/modals remain local, restaurant logic remains in its existing provider, and the entire Redux store is not persisted. No server cache library existed, so none was added.

`src/services/storage/mmkv.ts` remains available for non-sensitive preferences.
Restaurant data is read from the backend and no longer migrated into device
storage. Localization uses AsyncStorage scoped to native environment and API
origin. Session tokens use native secure Keychain/Keystore.

BootSplash uses the existing cutlery asset and paper background. Startup restores
localization and secure credentials, then reads the current server profile and
restaurant. Network or configuration failures display retry states; restaurant
and identity data is never replaced with fabricated defaults. Localization can
recover to bundled English. Splash transition failures retry without animation.

Stallion uses flavor-specific Android resources and build-setting substitutions in one iOS Info.plist. Android getDefaultReactHost supplies Stallion's JS path for release builds; Swift uses StallionModule.getBundleURL outside DEBUG. The release root uses withStallion. JavaScript never chooses Stallion credentials/projects. Metro development does not initialize the OTA HOC.

## OTA upload and release workflow

Publishing uses `nexgen/restoflow/dev` for development and `nexgen/restoflow/prod` for production. Both buckets belong to the same `restoflow` project, so native builds use the same project ID and App Token. The publishing helper rejects the other environment's bucket.

Buckets organize uploads and can be selected in Stallion's internal testing UI. Automatic releases are selected by project, platform and native app version, rather than bucket. Both flavors currently use version `1.0`; bucket names and different application IDs do not isolate promoted releases. Test development uploads by selecting the `dev` bucket without promoting them. Independent automatic DEV/PROD releases require distinct native app versions or separate Stallion projects. See [Stallion Hierarchy](https://stalliontech.io/learn/docs/stallion-hierarchy).

First build and test an actual DEV Release APK and DEV iOS Release/internal/TestFlight binary. Record each tested binary's native baseline:

```sh
npm run native:record -- --env=development --platform=android \
  --app-version=1.0 --binary=android/app/build/outputs/apk/development/release/app-development-release.apk
npm run native:record -- --env=development --platform=ios \
  --app-version=1.0 --binary=build/RestoFlowDev.xcarchive/Products/Applications/RestoFlow.app
```

The baseline verifies app identity/version/release mode where available and checks the compatibility hash embedded in that binary. Native files, dependency lockfile, env values, runtime token and public key affect the hash. A stale binary cannot be recorded against newer sources. Native/dependency/config changes invalidate subsequent OTA uploads. Baselines are local ignored files; recording one does not claim device OTA acceptance.

Authenticate locally using `npx --no-install stallion login`. CLI login is stored by Stallion outside the project. CI may later use separate STALLION_DEV_CI_TOKEN/STALLION_PROD_CI_TOKEN secrets. No CI workflow is added.

```sh
npm run ota:dev:android -- --notes="Fix editable billing quantity validation" --app-version=1.0
npm run ota:dev:ios -- --notes="Fix editable billing quantity validation" --app-version=1.0

# After equivalent DEV OTA verification on Android AND iOS, and recording
# the actual PROD binaries with native:record for each platform:
npm run ota:prod:android -- --notes="Fix editable billing quantity validation" \
  --app-version=1.0 --confirm-production=restoflow --dev-verified
npm run ota:prod:ios -- --notes="Fix editable billing quantity validation" \
  --app-version=1.0 --confirm-production=restoflow --dev-verified
```

Add `--dry-run` for local validation without upload; it still requires complete configuration and a matching baseline. Scripts lock upload paths to the configured project and environment bucket, require useful notes and an exact app version, and reject changed native baselines. Production also requires deliberate confirmation, reported DEV verification and matching signing keys. App Tokens are rejected as CI credentials, output is redacted, and no credentials are embedded in commands in package.json. This helper uploads only; promotion/distribution is a separate deliberate action in the console, targeted at the exact recorded native app version. Never promote a DEV bundle as a production release.

CLI 2.5.1 enables Hermes by default, matching the binary. `--sourcemap` optionally generates private source maps with kept artifacts for a future error-monitoring upload; no monitoring service currently exists. Artifacts are ignored and must not be publicly hosted. No alpha CLI commands are used.

After DEV upload, select the **dev** bucket in Stallion's internal testing UI, download the bundle, restart as required and verify a tiny JS-only change. Repeat on Android and iOS. Leave development bundles unpromoted while DEV and PROD share the same native app version.

Before PROD upload, confirm API origin, native identities, project ID and signing key in the actual PROD binary. Promote in **restoflow**, target its exact native version and use internal verification followed by an appropriate rollout such as 5% → 20% → 50% → 100%. Monitor adoption/crashes before increasing. Normal releases are non-mandatory.

For independent automatic release acceptance, first configure distinct native app versions or separate projects. Bucket upload validation does not establish runtime release isolation. Device OTA acceptance remains separate; no live upload/promotion was performed.

### Recovery

In the affected project's **Releases** screen, edit the release and **pause** it to stop downloads by new users. **Unpause** resumes it; change rollout percentage there as adoption is reviewed. **Rollback** a faulty release to return affected apps to the previous stable bundle according to SDK lifecycle; rollback also pauses the bad release. Verify recovery on the same native version on both platforms. Keep the last known-good release and the embedded binary available. If the fault requires native code, ship a new store/internal binary.

### Changes requiring a new native binary

React Native/Hermes/native library updates, pods, Gradle dependencies, AndroidManifest or Info.plist changes, permissions, Kotlin/Swift/Objective-C changes, native resources/signing keys, and bundled react-native-config values require new native builds. OTA is for compatible JavaScript/assets. The initial foundation installation is a native change.

## Primary references

Integration was checked against the installed package source and [Stallion SDK installation](https://stalliontech.io/learn/docs/sdk/installation), [stable publishing flags](https://stalliontech.io/learn/docs/cli/usage-api-reference), [production rollout/recovery](https://stalliontech.io/learn/docs/sdk/production-usage), [react-native-config](https://github.com/react-native-config/react-native-config), [MMKV v4](https://github.com/margelo/react-native-mmkv/blob/main/docs/V4_UPGRADE_GUIDE.md), and [BootSplash](https://github.com/zoontek/react-native-bootsplash).
