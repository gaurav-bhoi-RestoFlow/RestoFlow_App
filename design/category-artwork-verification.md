# Category artwork integration — 2 November 2026

The seven approved transparent SVGs are bundled under `assets/illustrations/categories/`. Each file was compared byte for byte with `svg-transparent/` in `RestoFlow_Category_Artwork.zip`. The existing SVG transformer and renderer are reused; no dependencies or Metro changes were needed.

| Category value | Supplied SVG                          |
| -------------- | ------------------------------------- |
| Starters       | `starters.svg` — paneer tikka skewers |
| Main Course    | `main-course.svg` — curry bowl        |
| Breads         | `breads.svg` — naan and roti          |
| Rice           | `rice.svg` — jeera rice               |
| Desserts       | `desserts.svg` — gulab jamun          |
| Beverages      | `beverages.svg` — citrus drink        |
| Other          | `other.svg` — covered serving dish    |

`categoryArtwork.ts` owns the typed mapping and presentation-only normalization. Existing legacy values `Mains`, `Drinks`, and `Drink` resolve to their corresponding artwork. Unknown, empty, or absent categories resolve to Other. Category values in form state and API payloads remain unchanged. Dish names never select artwork.

`DishImage` displays valid custom photos first and uses the current category for missing, blank, unsupported, or failed sources. Changing the source remounts the image loader, clearing its error state and isolating late errors from the previous source. Illustrations use `xMidYMid meet` inside existing image surfaces, preserving their 4:3 proportions without adding another cream tile. Existing image frames remain reserved before loading. Artwork is hidden from accessibility because the surrounding labels describe it.

Add Dish retains Main Course and all existing initial form values. Photo-less Add/Edit previews follow category changes immediately; custom photos survive category changes and picker cancellation. Removing a newly selected photo restores the current category illustration when there was no saved photo, or restores the previously saved upload. Optional photos stay absent on writes; illustrations are never uploaded or serialized as photo URLs.

**Existing-upload removal is limited by the current API.** The strict update schema supports an optional replacement image but has no deletion field or endpoint. Removing an already saved photo permanently requires an API change, which is outside the requested frontend scope. The UI therefore offers removal of a newly selected photo only and preserves saved uploads.

Changed implementation files:

- `src/features/menu/categoryArtwork.ts` and `assets/illustrations/categories/*.svg`: centralized mapping and approved assets.
- `src/features/menu/DishImage.tsx`: reusable photo/artwork fallback and source error reset.
- `src/features/menu/DishCategorySheet.tsx` and `src/components/SheetOption.tsx`: decorative 48×36 thumbnails, single-line category labels, existing selection/trailing controls.
- `src/features/menu/useDishForm.ts`, `DishFormScreen.tsx`, `DishPhotoField.tsx`, and `DishImageSheet.tsx`: category previews, pending-photo removal, and single-line form actions that stack at the existing narrow-screen/large-text breakpoint.
- `src/features/menu/menuConfig.ts`: removed dish-name illustration heuristics; filters and categories are unchanged.
- `src/features/menu/DishCard.tsx`, `src/features/orders/OrderDishRow.tsx`, `src/features/orders/useOrderDraft.ts`, and `src/features/billing/BillAddItemSheet.tsx`: category propagation through existing image views, with single-line labels/prices.
- `src/localization/locales/en.json` and `mr.json`: added the pending-photo removal label.
- `__tests__/dishArtwork.test.tsx`, `menuUi.test.tsx`, and `billing.test.tsx`: fallback, form/picker, API-contract, reopening, and order category coverage.

Validation:

| Check                                                            | Result                                                                                                   |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `npm run typecheck`                                              | Passed                                                                                                   |
| `npm run lint`                                                   | Passed with five existing warnings outside the changed implementation                                    |
| `npm test -- --runInBand`                                        | 21 suites, 367 tests passed                                                                              |
| Focused form checks after the final responsive action adjustment | Passed                                                                                                   |
| Prettier on changed TS/TSX; `git diff --check`                   | Passed                                                                                                   |
| iOS DEV JavaScript bundle                                        | Passed with existing CLI setup/package-export warnings; this is not an iOS native build or simulator run |
| Approved SVG integrity                                           | All seven copies match the archive exactly                                                               |

Actual runtime inspection used the connected Samsung SM-A176B running the DEV app. The menu displayed curry, rice, and bread artwork in existing cards, with the original proportions and theme. Opening Add Dish showed the Main Course curry preview, the optional-image action, existing form values, category selector, and Add Dish/Cancel controls. No dish changes were saved during device inspection.

The phone screen changed outside this check before the automated category-sheet sequence could proceed, so further device input stopped. All seven categories, source failures/recovery, custom-photo selection and removal, picker cancellation, category selection, save/cancel flows, and reopening are covered by component/integration tests; they were **not all exercised on the device**. Native category-sheet scrolling, order/billing selector interaction, photo-picker flows, keyboard behavior, small-screen/tablet layouts, iPhone/iPad behavior, and screen-reader output still need runtime verification. No backend services, production configuration, or Figma files were changed.
