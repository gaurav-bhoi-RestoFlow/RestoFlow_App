RestoFlow is a native restaurant ordering and billing app with owner and waiter flows, phone and password authentication, restaurant setup, tables, customer orders, menu search, waiter management, language settings, and native receipt printing.

Receipt preview supports Bluetooth printer discovery/selection, ESC/POS receipts over Android Classic and supported Android/iPhone BLE endpoints, paper/error recovery, and continuing to the dashboard without printing. Server save failures offer an explicit local-draft fallback. See [Bluetooth compatibility, recovery coverage and verification](docs/BLUETOOTH_PRINTING.md). This feature requires a native rebuild; real-printer and iOS device verification remain outstanding.

## Backend environments

| Native build | API origin |
| --- | --- |
| Development | `https://restoflow-backend-dev.gauravbhoiofficial.workers.dev` |
| Production | `https://restoflow-backend.gauravbhoiofficial.workers.dev` |

These exact origins are enforced in build tooling and at runtime. Production has no development fallback, and Preview URLs are rejected. Rebuild the native app after changing environment configuration.

Continue checks `POST /api/v1/auth/phone/check`. Registered numbers reveal a password field and sign in through `POST /api/v1/auth/login`. New numbers open restaurant registration with the phone prefilled. Password and Confirm password appear below the restaurant details; Create account submits the phone, password, confirmation, names, and optional photo to `POST /api/v1/onboarding/owner/complete` and opens the dashboard after the backend saves the account. OTP requests, verification, resend, and local authentication mocks have been removed.

Passwords use the backend’s 8–128 character limit, preserve spaces, and require matching confirmation during registration. Owners assign a password when adding a waiter. Existing accounts without a password need an administrator to set their first password; see the backend’s authentication guide. The backend must have `0004_password_auth.sql` applied before serving this flow.

## Design and code

The ZIP's prototype, screen previews, SVGs and tokens are the implementation reference, as requested. No screenshot is used as a screen asset. All supplied SVGs are preserved byte for byte and imported through the [SVG transformer](https://github.com/kristerkari/react-native-svg-transformer). Icons keep their native 24-unit geometry and are tinted at the call site. Android and iOS supply their own status and navigation bars.

iOS uses its SF Pro system font. Android bundles the supplied SF Pro Display Regular, Medium, and Bold fonts in `android/app/src/main/res/font/`, registered as a single family for text and inputs. The supplied Noto Sans Devanagari font is bundled on both platforms for Devanagari text. Asset and font licenses supplied with the original ZIP are in `licenses/`. Rebuild the Android app after changing bundled fonts; a Metro reload cannot install native font resources.

`src/app` contains typed React Navigation stacks and the floating tab bar. `src/components` contains shared UI controls. Each feature owns its screens, components, types or hooks; API calls, order drafts, and receipt generation are separate from JSX. Tokens are in `src/theme/tokens.ts` and the supplied rules are preserved in `design/implementation-rules.md`.

The menu management UI covers all 33 screenshots supplied on 22 October 2026, including add/edit forms, validation, saving, categories, images, availability, deletion, empty states and feedback. See [the screenshot coverage and verification report](design/menu-ui-implementation.md).

The owner's **Menu → Ledger** workspace implements the expense screenshots supplied on 25 October 2026: searchable/filterable expenses, add/edit/detail/delete, receipts, and native PDF export, sharing and printing. Expenses currently persist locally per restaurant in MMKV because no expense API is defined in this repository. The file/PDF integrations require a new native build. See [Ledger coverage, previews and verification](design/ledger-ui-implementation.md).

## Install and verify

```sh
npm ci --legacy-peer-deps
npx tsc --noEmit
npm run lint
npm test -- --runInBand
```

The legacy peer flag is needed because `react-native-print` declares a Windows peer dependency incompatible with this project's React Native version. Windows is not a target of this app. Its Android SDK is aligned with the app in `android/build.gradle`.

For iOS, install CocoaPods dependencies on macOS before running the app. Android verification can use an emulator or device. The tests cover password login/registration, server-backed tables, role-specific settings, secure credentials, token rotation, API pagination, exact bill snapshots, receipt escaping, and environment isolation.

Verification details are in [design/verification.md](design/verification.md).

## Run the app

Start Metro in one terminal:

```sh
npm start
```

On Linux, this launcher removes inherited Snap GTK and schema paths (for example,
from VS Code's integrated terminal) so React Native DevTools uses the host desktop
runtime. If DevTools reports a missing `font-antialiasing` schema key, stop Metro
and restart it with `npm start`. Additional Metro options can be passed with
`npm start -- --reset-cache`.

With an Android emulator or device connected, run in a second terminal:

```sh
npm run android
```

`npm run android` selects the development flavor. It builds native libraries for the connected device’s architecture to keep development builds smaller and faster. If installation reports `INSTALL_FAILED_INSUFFICIENT_STORAGE`, check free space on the emulator or device; clearing disposable caches can help without deleting app data.

For iOS on macOS, run `npm run native:configure`, `bundle install`, then `bundle exec pod install` from `ios/`, and return to the project root for `npm run ios:dev`. Native iOS compilation has not been verified in this Linux workspace.

See React Native’s [environment setup guide](https://reactnative.dev/docs/set-up-your-environment) for the required Android or iOS toolchain.

## Localization

The application now uses i18next with bundled English and Marathi, runtime language
discovery through our Hono API, and offline resources in the existing AsyncStorage.
See [docs/LOCALIZATION.md](docs/LOCALIZATION.md) for catalog changes, language
configuration and verification. Translation requests use the same pinned Worker origin as business APIs.

## Application infrastructure

Axios, Redux Toolkit, native environment configuration, MMKV, BootSplash and Stallion are integrated. DEV and PROD use separate Android flavors, iOS schemes, application identities and native Stallion project IDs. Authentication uses phone numbers and passwords, backend-issued tokens, and persisted server sessions. Passwords are not persisted on the device.

Use `npm run android:dev` / `npm run android:prod`, or on macOS `npm run ios:dev` / `npm run ios:prod`.

App icons use the supplied white cutlery mark: development builds have a red
background (`#B91C1C`), and production builds keep the original green (`#173F35`).
The source SVG is in `assets/app-icon/brand-mark.svg`. Run `npm run icons:generate`
to regenerate the committed iPhone/iPad icons, Android legacy PNGs, and adaptive
icons using BootSplash's existing Sharp dependency. Android themed icons follow
the user's wallpaper palette. Icon changes require a native rebuild and reinstall.

Release builds bundle JavaScript into the app and require real signing and environment-specific Stallion configuration. Adding secure credential storage requires a native rebuild; an OTA update alone is insufficient. On macOS, reinstall CocoaPods before building iOS.

Before running `yarn android:dev:release`, copy `.env.stallion.local.example` to
`.env.stallion.local` and set `STALLION_DEV_APP_TOKEN` to the App Token from the
`restoflow-dev` Stallion project. This file is ignored by Git. You can check the
configuration with `node scripts/validate-environment.mjs development --release`.

See [docs/INFRASTRUCTURE.md](docs/INFRASTRUCTURE.md) for exact versions, setup, native identities, signing, OTA publishing, rollout and rollback. [docs/INFRASTRUCTURE_VERIFICATION.md](docs/INFRASTRUCTURE_VERIFICATION.md) records completed checks, remaining checks, and the implementation file list.
