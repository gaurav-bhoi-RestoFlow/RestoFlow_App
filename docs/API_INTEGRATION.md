# Mobile API integration

The mobile app uses the two Production Worker URLs supplied for its native
build environments:

| Build environment | API origin |
| --- | --- |
| Development | `https://restoflow-backend-dev.gauravbhoiofficial.workers.dev` |
| Production | `https://restoflow-backend.gauravbhoiofficial.workers.dev` |

The mappings are pinned in `config/environments.json` and validated against
`.env.development` and `.env.production`. Both build tooling and runtime
validation reject the other environment, local origins, arbitrary hosts, and
Preview URLs. Axios rejects absolute request URLs and origin overrides before
attaching credentials. Media and translation requests also enforce the selected
origin. Production has no development fallback. Native configuration selects
the environment even for release JavaScript bundles.

## Authentication and storage

The login screen starts with a phone field. Continue normalizes it to E.164 and calls public `POST /api/v1/auth/phone/check` with `{phoneNumber}`. A registered number reveals the password field on the same screen; Sign in sends `{phoneNumber, password}` to public `POST /api/v1/auth/login`. Editing the phone clears the password and lookup result, so the next Continue checks the new number. Failed or invalid lookups stay on the phone screen and allow retry.

An unregistered number opens restaurant registration with its phone prefilled. Password and Confirm password follow the restaurant name, owner name, and mobile number fields. Create account validates names, phone, the backend’s 8–128 character password limit, and exact confirmation, then sends multipart `phoneNumber`, `password`, `confirmPassword`, `fullName`, `restaurantName`, and optional `image` to public `POST /api/v1/onboarding/owner/complete`. Passwords preserve whitespace. The backend atomically saves the account and restaurant and returns the session; the app opens the dashboard only after success. Failed saves preserve the form for retry. Owners create waiter accounts with a name, mobile number and optional photo; the server assigns the saved E.164 mobile number (including +91) as the initial password.

OTP challenges, code inputs, resend actions, onboarding proofs, and authentication mocks are removed. None of the public authentication requests attach an existing access token, and invalid credentials never trigger session refresh. No phone is initially prefilled and no phone lookup signs a user in. Roles and restaurant IDs come from the server’s current account profile. Passwords and confirmation remain in form state only; persisted sessions contain tokens and account details.

The backend must serve its password contracts with `0004_password_auth.sql` applied. Existing accounts without a password need administrator provisioning through the backend’s `npm run password:set`; see its README for stdin usage. This mobile change does not migrate, provision, or deploy remote accounts.

Access and refresh tokens are stored together in native Keychain/Keystore using
`react-native-keychain`, scoped to environment and API origin. Redux contains
only account and membership details. Preference stores contain no credentials.
Startup restores credentials and fetches `/auth/me`; a network failure offers
retry instead of creating a local account. Concurrent 401s share one refresh,
then retry once with the rotated token. Rejected refresh clears the session.
Logout calls the server and clears local credentials. Failed network requests
never create fabricated success responses.

The server must set `X-RestoFlow-Environment` on successful and failed API
responses. This has been added to the backend's shared request middleware.
The client rejects absent or mismatched values.

## Account settings

Both endpoints require `Authorization: Bearer <accessToken>` and return the
standard `{ "success": true, "data": ... }` envelope with the matching
`X-RestoFlow-Environment` response header.

| Mobile action | Backend contract | Successful `data` |
| --- | --- | --- |
| Save profile | `PATCH /api/v1/auth/me`; multipart `fullName` and optional `image` | `{ id, fullName, phoneNumber, profileImageUrl }` |
| Update password | `POST /api/v1/auth/password`; JSON `{ currentPassword, newPassword }` | `{ "passwordChanged": true }` |

Profile responses contain the saved public user fields directly in `data`,
without a nested `user` object or new tokens. `GET /api/v1/auth/me` retains its
existing `{ user, restaurants }` response. A null `profileImageUrl` displays the
user's initials; a returned media path resolves against the selected API origin.
The backend also accepts JSON or image-only profile patches; the mobile form
always sends the validated name and omits an unchanged photo.

Settings exposes Edit profile and Change password to owners and waiters. Edit
profile sends multipart `fullName` and an optional native `image` file to
`PATCH /api/v1/auth/me`. Names are trimmed and validated at 2–100 characters;
the shared profile picker prepares every selection on the device as a centered
256 × 256 JPEG, starting at 80% quality and reducing quality only when needed to
stay within 64 KiB. This applies to profile editing, owner registration, and
waiter creation. Native decoding handles picker MIME aliases (including iOS
`image/jpg`), HEIC, orientation/mirroring, and transparent images. Large originals
are reduced before the output size is checked; originals and base64 strings are
never uploaded. Both platforms discard image metadata when encoding the JPEG.

Only a confirmed server response updates the shared session name/photo. A photo
save must return a nonempty saved media URL. Profile edits preserve restaurant
data and navigation and also update the owner's shared restaurant profile.
Startup restores the saved profile from the backend, and returning from the
background refreshes it again. Earlier reads cannot overwrite a newer saved
photo. Failed saves preserve the previous shared avatar and the prepared draft
for retry; canceled selections preserve the draft. Replaced/abandoned prepared
files are removed from the device cache. Avatars fall back to initials on image
load errors and create a fresh image view for each new media URL.

Names and the other returned account details use the same validated mapping on
save, sign-in, startup, and foreground refresh. Saving applies the backend's
confirmed name, phone, and photo together while retaining restaurant membership.
Edit profile currently supports name and photo changes. An untouched name field
follows refreshed server data while the form is open; typed drafts remain intact
for saving or retry. Owner and waiter name changes update settings, avatar names
and initials, and survive reopening. Owner details also update the shared
restaurant profile without resetting restaurant data or navigation.

The existing backend stores replacements under a new UUID, saves that key in
the user's record, and deletes the previous object after commit. Existing
profile/storage tests cover rollback cleanup and owners/waiters independently
of subscription status. No backend or database migration is needed for this
mobile photo-processing change. The backend's general image-upload limit stays
5 MB; these mobile profile uploads are capped at 64 KiB before sending.

The native `ProfilePhoto` module is registered on Android and iOS. Rebuild and
install the native app to use it; a JavaScript-only OTA cannot add the module.
Android compilation is verified in this workspace; iOS compilation requires
macOS/Xcode.

Verification on 2 November 2026: 310 mobile tests, seven infrastructure checks,
and 43 backend profile/query/service/OpenAPI tests passed. TypeScript passed;
ESLint reported no errors and five existing warnings. The Android arm64
development debug APK built successfully. The deployed DEV OpenAPI document
advertises the profile PATCH contract. A standalone device codec harness was
stopped by Android before processing its fixtures; photo selection/upload on a
device and iOS compilation remain unverified. No backend deployment was made.

Change password opens a separate screen with Old password, New password, and
Confirm password. It validates the backend's 8–128 character limits and exact
confirmation, then sends JSON `currentPassword` and `newPassword` to the existing
authenticated `POST /api/v1/auth/password`. Password whitespace is preserved.
Confirmation stays in form state. An incorrect old password remains a form
error and does not refresh or clear the valid session. After the server confirms
`passwordChanged: true`, all backend sessions have been revoked; the app clears
its local credentials and returns to sign-in without calling logout again.

The password API deliberately accepts no `confirmPassword` field. The screen
checks confirmation before sending the request. HTTP 400 `VALIDATION_ERROR`,
401 `INVALID_CREDENTIALS`, and 429 `RATE_LIMITED` leave the draft available for
correction or retry. A 401 for an expired access token still follows the shared
refresh flow; an incorrect old password after refresh remains a form error.

The sibling backend implements the new self-profile route, public response
schema, image replacement/cleanup, and OpenAPI documentation. No database
migration is needed. Backend deployment is required before profile saving can
be used against a hosted API; this settings change does not deploy it.

## Restaurant operations

RestaurantProvider loads the selected restaurant, subscription, paginated menu,
tables, dashboard totals, open customer orders, and (for owners) active waiters.
A new account sees the backend's actual empty floor/menu. Restaurant data lives
on the server; the former device restaurant cache and mutation reducer are
removed. Requests are cancelled when sessions change, and previous users'
data is not displayed to a new session. The floor reloads after mutations and
on foreground/periodic refresh.

Table creation/deletion, waiter creation/photo upload, order creation and edits,
and visit completion call the restaurant-scoped APIs. UUIDs identify resources;
table numbers are separate display values. Menu categories and dish images
come from server data; missing images use the bundled dish illustrations.

Order editing preserves individual server item IDs and historical price
snapshots, including repeated dishes with different snapshots. Quantities use
the backend limits. Existing-order changes use the backend's separate item
endpoints; if part of an edit fails, the app reloads the order before further
editing. Newly created orders are written atomically by the backend. Drafts are
unsaved UI state until the server confirms the mutation.

Bills and receipts use `/orders/{id}/bill` totals and snapshot lines, retaining
exact decimal money. After successful Bluetooth/device printing or **Continue
without printing**, the app closes that customer's visit through
`POST /orders/{id}/bill/settle`. Printing first saves the immutable print-job
snapshot; continuing without printing saves the latest edited bill before closing. The
server retains the customer name, original visit date, saved line prices, total
and `closedAt` completion time. Settlement sends the saved receipt's `revision`
and exact `sourceOrderUpdatedAt`. The server checks both versions under an order
lock, rejects unsaved/stale bills with HTTP 409, and preserves the completion
timestamp on retries. No print job is required. The floor refreshes after closure;
other guests stay active, and a table becomes available after its last customer finishes.
Checkout failures keep the receipt open for retry, retaining a successful save
or print dispatch so neither must be repeated. A lost close response is checked
by reading the current bill. No physical-print confirmation is inferred; the
print-gated `/bill/finish` endpoint is no longer part of mobile checkout.
Release the backend settlement endpoint before this mobile update. No database
migration is needed; the existing saved bills and order completion fields are used.

## Subscription and localization

Subscription status and trial dates come from the backend's owner subscription.
The simulated purchase and local premium activation are removed. Since the
backend exposes no payment/purchase API, the access screen explains operator
activation and checks the server for the updated subscription. It does not
claim that a payment was taken or grant lifetime access locally.

English and Marathi are bundled UI resources, with password, loading, and subscription
messages translated in both catalogs. Translation discovery and additional
language downloads use the same selected API origin. Existing offline language
preferences remain supported; they do not substitute for restaurant data.
The backend catalog and mobile metadata must be synced when UI keys change.

## Build and backend prerequisites

Adding native secure storage requires rebuilding the mobile app. On macOS,
install CocoaPods again before building iOS. A JavaScript OTA update alone cannot
add this native module. Existing release signing and environment-specific
Stallion credentials remain required; the former mock release bypass is removed.

```sh
npm ci --legacy-peer-deps
npm run typecheck
npm run lint
npm test -- --runInBand
npm run test:infrastructure
npm run android:dev
```

The backend completion includes `drizzle/0003_customer_orders.sql`, the new
customer/dashboard contracts, and the global environment response header.
A read-only DEV schema check confirmed the customer-name column and nonempty
constraint are already present. The response-header/catalog changes were deployed to the DEV Worker after
explicit approval; the live contract checks below passed. Do not substitute Preview URLs or another environment
while preparing deployment. Production requires its own backend configuration,
password schema, storage, migration, and release prerequisites.

Read-only checks on 14 October 2026 found the DEV health endpoint healthy, with
`environment=development`. Production `/api/v1/health` returned HTTP 500 with
`CONFIGURATION_ERROR` (application environment not configured). Before deployment, DEV health lacked the global environment header. The
approved deployment now returns the correct development header on health,
OpenAPI, translation, and protected-route error responses. Production still
returns the configuration error. These findings do not change either mobile
API origin.

Local verification covers password flows through mocked HTTP transport, secure
credential failure/revocation, single-flight refresh, exact server bill printing,
pagination past 100 records, restaurant access, and rejection of cross-environment
and Preview origins. These tests do not claim live authentication, payment, production,
or native device acceptance.

## Password authentication verification — 24 October 2026

- TypeScript passed; ESLint passed with three existing `no-void` warnings.
- All 153 tests passed across 11 suites, including phone lookup branching,
  owner/waiter password login, registration validation and retries, changing
  phone numbers, waiter default phone-number passwords, and native multipart registration.
- English/Marathi catalogs were updated and the generated backend English
  catalog/mobile version metadata passed synchronization checks.
- Remote authentication, account provisioning, migrations, deployment, and
  Android/iOS device acceptance were not performed for this change.

## Historical mobile integration verification — 14 October 2026

- TypeScript checks passed.
- 104 mobile tests passed across nine suites; seven infrastructure tests passed.
- ESLint passed with three existing warnings.
- Android Metro release bundling passed.
- Native Android `app:assembleDevelopmentDebug` passed for `arm64-v8a`, including
  the new secure credential module and environment validation.
- Native autolinking detects Keychain for Android and iOS. iOS compilation remains
  unverified in this Linux workspace.
- Backend TypeScript, catalog synchronization, and 226 tests passed.
- DEV database schema was checked read-only; no migration was applied by this
  mobile integration task.

The approved DEV deployment succeeded with version
`5df0905d-212d-485b-b063-044c66f940c0`. Live read-only checks passed for health,
OpenAPI, the matching English catalog version, and 401 account/restaurant
responses carrying the correct environment header. No business data was
written by these acceptance checks. Production configuration/deployment was
not changed; its exact health URL still returned HTTP 500 `CONFIGURATION_ERROR`.

## Shared floor and sequential table numbers

The mobile flow follows the sibling backend's table and billing contracts in
`docs/API_GUIDE.md` and `docs/BILLING_API.md`. Only restaurant owners see table
creation and deletion controls. Owners and all active waiters read the same
restaurant floor and table customers, including orders saved by other waiters.

Table UUIDs identify navigation routes, list keys, customers and orders. Display
numbers come from the server's `tableNumber`; deleting an available table
renumbers the remaining tables to `1..N`, and the next creation receives `N+1`.
The app reloads the server floor after mutations instead of calculating numbers
locally. A deletion conflict or missing table dismisses confirmation and reloads
the floor so another staff member's changes become visible.

Dashboard and customer screens refresh on focus and support pull-to-refresh.
Customer refreshes also update the shared floor, keeping table headings and
subsequent order navigation aligned with renumbering or deletion on another
device. Newer customer reads cancel earlier reads so stale results cannot replace
the latest shared guest list. Owners see effective bill totals; waiters see the
original order totals returned by the customer endpoint.

The backend's sequential numbering requires
`drizzle/0010_sequential_table_numbers.sql` and the matching backend release.
Local mobile verification uses mocked HTTP transport; it does not apply that
migration or deploy the backend.

Verification on 2 November 2026: all 290 mobile tests passed across 18 suites,
including renumbering, stable UUID routes, owner-only controls, shared customers,
deletion conflicts and cancellation of stale customer reads. The backend's 96
business route/query/service, billing route and OpenAPI tests also passed.
Mobile TypeScript passed; ESLint reported no errors and five existing warnings.

## Menu management API

The backend source at `../restoflow_backend/src/modules/menu` mounts these routes under
`/api/v1/restaurants/{restaurantId}/menu`. The mobile client implements them in
`src/api/dishes.ts` using the existing authenticated Axios client, environment checks,
and token refresh.

| Action | Method and suffix | Request |
| --- | --- | --- |
| List | `GET /dishes` | Fetch every page with `limit=100` and `offset`; include unavailable dishes. |
| Read/edit | `GET /dishes/{dishId}` | Fetch fresh detail before populating the edit form. |
| Create | `POST /dishes` | Multipart form containing name, description, foodType, category, price, available, and optional image. |
| Edit | `PATCH /dishes/{dishId}` | Multipart fields; unchanged images are omitted. |
| Availability | `PATCH /dishes/{dishId}` | Multipart `available=true` or `available=false` only. |
| Delete | `DELETE /dishes/{dishId}` | Confirm the returned ID and `deleted: true`. |

Create and update always use multipart, including requests without an image. Prices
remain decimal strings on writes. The client matches the backend's non-negative price
range up to `21474836.47`, 120-character names, 2000-character descriptions, and JPEG,
PNG or WebP images up to 5 MB. Local illustration URIs and existing image URLs are
never sent as image files. Picker results retain the native file URI, MIME type and
filename for multipart upload. Returned relative media URLs resolve to the configured
Worker origin.

`MenuProvider` coordinates confirmed API mutations and `RestaurantProvider` holds the
shared menu used by ordering. Cached dishes remain visible if a refresh fails. The
Menu tab refreshes on focus and supports pull-to-refresh. Mutation errors stay on the
form, action sheet or deletion dialog; they do not produce success feedback. Pending
submissions are guarded against duplicate taps. Stale list/floor requests cannot
restore a dish after a newer confirmed deletion.

There is no runtime mock seed or simulated saving delay. Empty restaurants display
the actual empty-menu state; backend changes survive app restarts. The existing UI
continues to expose dish management to owners and browsing to waiters.

Verification: 151 mobile tests, including 17 menu interaction tests and 14 dish API/
validation tests; the backend's 83 existing business route, service, image and OpenAPI
tests also passed. TypeScript, ESLint (three existing warnings), and Android production
JavaScript bundling passed.

Live DEV acceptance on 22 October 2026 also passed on Android using the actual mobile
`dishApi`, Axios interceptors, native network transport and React Native FormData.
A temporary restaurant and isolated in-memory test credentials kept the test separate
from saved device sessions. Verified against the configured DEV Worker:

- List an empty menu and read fresh dish details.
- Create with an app-private PNG file URI; read the returned public media URL.
- Edit decimal price, category, food type and description; retain the uploaded image
  when no new file is selected.
- Toggle availability and confirm unavailable dishes remain in the list.
- Create without an image, with zero price and unavailable status.
- Propagate the server's invalid-price validation error.
- Delete, confirm removal from the list, and receive `DISH_NOT_FOUND` on detail.

The visible native UI also completed add, edit/category/price, mark unavailable, and
confirmed deletion against DEV. The resulting database fields were checked before
removing this run's synthetic account, restaurant, sessions, dishes and uploaded images.
No OTP endpoint was called. Production was unchanged. See the
[native acceptance capture](../design/menu-api-native-acceptance.png).

## Waiter creation and team list

Add waiter asks for the waiter’s name, mobile number, and optional photo. It sends
`POST /api/v1/restaurants/{restaurantId}/waiters` with `fullName` and E.164
`phoneNumber`, using JSON without a photo or multipart with `image`. The app
omits `password`; the backend hashes the saved phone number as the initial
password, including `+` and country code (for example, `+919876543210`). The waiter
can change it through Settings after signing in.

After a successful save, the app immediately caches the returned waiter and
returns to Your waiter team. Each time this screen gains focus, including after
creation, it calls `GET /api/v1/restaurants/{restaurantId}/waiters` with
`status=ACTIVE`, `limit=100`, and successive `offset` values until every active
waiter is loaded. The list shows each waiter’s name, mobile number, and photo or
initials. Pull to refresh and Retry use the same GET API without reloading tables,
menu, or orders. Failed list reads preserve cached waiters, display a retryable
error, and never resubmit a successfully created account. Requests are cancelled
on blur and older dashboard refreshes cannot overwrite newer waiter changes.
