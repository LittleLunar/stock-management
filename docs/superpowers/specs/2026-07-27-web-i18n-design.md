# Web App Internationalization (EN/TH) — Design

**Date:** 2026-07-27  
**Status:** Approved (brainstorming)  
**Approach:** i18next + react-i18next (Approach A)

## Goals

1. Ship bilingual **English + Thai** UI for the entire web app (~30 screens)
2. Persist language preference in **localStorage** with a shell language switcher
3. Map known API error **`code`s** to localized messages on the client
4. Use **flat dotted translation keys** (e.g. `"nav.products"`) for easy editor search

## Non-goals

- Server-side `Accept-Language` / localized API `message` strings
- User or org preference persistence in the database
- Translating user-entered content (product names, notes, etc.)
- Browser auto-detect as default locale (v1 defaults to `en`)

## Decisions

| Topic | Choice |
|-------|--------|
| Library | `i18next` + `react-i18next` |
| Locales | `en`, `th` |
| Default | `en` |
| Preference | `localStorage` key `locale` |
| Catalog shape | Flat JSON keys with dots; `keySeparator: false` |
| Namespaces | `common`, `nav`, `errors`, `masters`, `inventory`, `purchasing`, `costing`, `accounting`, `docs`, `settings` |
| API errors | Client maps `code` → `errors:<code>`; fallback to server `message` |
| Formatting | Shared `Intl` helpers; `en`→`en-US`, `th`→`th-TH` |

## Architecture

```
LanguageSwitcher → localStorage + i18n.changeLanguage
Pages/Shell → useTranslation(namespace)
formatApiError → i18n.t('errors:errors.CODE') || error.message
```

### Init

- Bootstrap in `apps/web/src/main.tsx` before render
- Sync `document.documentElement.lang` on locale change
- Missing keys fall back to English; warn in DEV

### Catalogs

```
apps/web/src/i18n/locales/{en,th}/
  common.json
  nav.json
  errors.json
  masters.json
  inventory.json
  purchasing.json
  costing.json
  accounting.json
  docs.json
  settings.json
```

Example flat keys:

```json
{
  "nav.masters": "Masters",
  "nav.products": "Products",
  "actions.save": "Save",
  "errors.NOT_FOUND": "Not found",
  "inventory.stock.title": "Stock"
}
```

### Language switcher

- Component in shell footer (near branch switcher)
- Labels: `EN | ไทย`

## Error codes

Domain/HTTP codes localized in `errors` namespace, including:

`NOT_FOUND`, `UNAUTHORIZED`, `FORBIDDEN`, `CONFLICT`, `INVALID_STATE`, `INSUFFICIENT_STOCK`, `TRACKING_REQUIRED`, `OVER_RECEIVE`, `INSUFFICIENT_AVAILABILITY`, `MISSING_UNIT_COST`, `UNSUPPORTED_COSTING_METHOD`, `INSUFFICIENT_COST`, `LAYER_IN_USE`, `ALLOCATION_MISMATCH`, `UNBALANCED_JOURNAL`, `PERIOD_CLOSED`, `ACCOUNT_MAPPING_MISSING`, `ACCOUNTING_PERIOD_MISSING`, `THREE_WAY_MATCH`, `WEBHOOK_DELIVERY_FAILED`, `LOT_EXPIRED`, `LOT_QUARANTINED`, `LOCATION_QUARANTINED`, `VALIDATION_ERROR`, `INTERNAL_ERROR`

## Testing

- Unit: locale get/set persistence; `formatApiError` code mapping EN/TH + fallback
- Parity: every `en` key exists in `th`
- Smoke: switch language without reload; nav + page + toast update

## Out of scope follow-ups

- Per-user / org default locale via API
- Accept-Language on API responses
- Zod/RHF validation message localization
