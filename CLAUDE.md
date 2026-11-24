# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

FoodStack: a restaurant ordering platform with four surfaces: a customer web app, a mobile-responsive version of it, a kitchen board for staff and an admin back-office. Flask JSON API + SQL Server (pyodbc, raw SQL) backend. The README is in Spanish.

The menu has exactly **4 categories: Burgers, Burritos, Sides, Beverages**. Do not add tacos, shakes or other categories (milkshakes belong to Beverages).

> **Read this first: the repo is mid-migration.** The sections marked **Current** describe code that exists today. The sections marked **Target** describe the agreed architecture and are not implemented yet. Before you assume a Target file or module exists, check that it does. When you implement a Target item, build it the way this file describes and tick it in the Roadmap at the bottom.

## Working rules for Claude Code (read before every task)

- **Repo:** `github.com/Operator-JL/foodstack`. Pushing to `main` **deploys to production on Azure**. Never push to `main`. Work on a branch named `feat/phase-N-short-name` (or `fix/…`), make small commits and open a PR.
- **One roadmap phase (or one screen) per session.** Before you code, read the relevant section of this file and the matching Figma frame. When you finish, tick the Roadmap item and update this file if something changed.
- **Database safety:**
  - Never run migrations or seeds against the Azure database. Use a local SQL Server only; Jesus runs production migrations by hand.
  - Never edit an applied migration; add a new numbered file.
  - Never hard-delete rows. Soft-delete with `Status = 0`.
- **Stop and ask first** before you change any of these:
  - pricing or fee rules
  - existing column types or names
  - auth or role logic
  - the response envelope
  - anything in Business rules below
- **Compatibility:** keep the legacy endpoints and pages working until Phase 7 replaces them. New endpoints go under the paths in API contract.
- **Done means done:**
  - Lint, typecheck and tests pass.
  - New logic has tests.
  - New env vars are added to `.env.example`.
  - Every new UI string exists in both `en.json` and `es.json` (natural Mexican Spanish, informal "tú").
- **Never hard-code:** secrets, hex colors, prices, fees or restaurant info. They come from env, `tokens.css` or the DB.
- **Ignore:** the Figma `v1 ·` pages. (The Hotels leftovers were removed in Phase 0.)

## Design source of truth (Figma)

- File: **FoodStack Mockups**: https://www.figma.com/design/9sr5AsgjAjfKeh5HQPnreo/FoodStack-Mockups (fileKey `9sr5AsgjAjfKeh5HQPnreo`)
- Pages:
  - `00 · Cover`: client-facing cover.
  - `01 · Design System`: tokens, type and components.
  - `02 · Customer Web`: 9 screens.
  - `03 · Customer Mobile`: 3 screens.
  - `04 · Staff & Admin`: 5 screens.
  - `05 · User Flow`: flows by role and the data model.
  - `v1 · …`: old mockups. Ignore them.
- When you build or change a UI, read the matching Figma frame through the Figma MCP (`get_design_context` / `get_screenshot`). Do not invent layouts.
- Font: **Plus Jakarta Sans** (Regular, Medium, SemiBold, Bold, ExtraBold). Icons: **Lucide** (`lucide-react`); every icon in Figma is a Lucide icon with the same name.

### Screen → route map (Target)

| Figma frame | Route | Role |
|---|---|---|
| 01 · Landing | `/` | public |
| 02 · Menu | `/menu` (grouped by category, with a live cart panel) | public |
| 03 · Product Detail (modal) | `/menu/:productId` (modal over the menu; ingredient customization) | public |
| 04 · Cart | `/cart` | public |
| 05 · Checkout | `/checkout` (contact → pickup/delivery → payment) | customer |
| 06 · Order Tracking | `/orders/:id` (live status timeline) | customer |
| 07 · My Orders | `/account/orders` | customer |
| 08 · Login / 09 · Sign up | `/login`, `/signup` (email + Google) | public |
| A1 · Admin Dashboard | `/admin` | admin |
| A2 · Kitchen Board | `/kitchen` (New → Preparing → Ready → Completed) | staff, admin |
| A3 · Products | `/admin/products` | admin |
| A4 · Product Editor | `/admin/products/:id` (`new` creates a product) | admin |
| A5 · Orders | `/admin/orders` (table + detail drawer) | admin |
| M1–M3 (mobile) | same routes below 768px: bottom tab bar, floating cart bar, bottom-sheet product detail | — |

### Design tokens

Figma holds these tokens in the variable collection **"FoodStack Tokens"**. In code they must live as CSS custom properties in `src/design-system/tokens.css`, and every component must use them. **No hex values outside `tokens.css`.**

Figma currently has the Light values only. The Dark values below are the specification for dark mode; if they change, update Figma to match.

| Token | Light | Dark |
|---|---|---|
| `--color-brand-50` | #FFF5EC | #2B1A0D |
| `--color-brand-100` | #FFE6CF | #3A2310 |
| `--color-brand-200` | #FFC999 | #5A3414 |
| `--color-brand-500` (primary) | #EF7D1A | #F28A2E |
| `--color-brand-600` | #D9650A | #F59A4A |
| `--color-brand-700` | #B04F06 | #FFB877 |
| `--color-on-brand` (text on orange) | #FFFFFF | #FFFFFF |
| `--color-ink-900` (text) | #1C1714 | #F6F1EC |
| `--color-ink-700` | #443B35 | #D9D0C8 |
| `--color-ink-500` | #776C64 | #A39890 |
| `--color-ink-400` | #A39890 | #7E736B |
| `--color-ink-300` | #CFC6BE | #554A43 |
| `--color-surface-page` | #FAF7F3 | #14100E |
| `--color-surface-card` | #FFFFFF | #1E1916 |
| `--color-surface-muted` | #F4EFE9 | #2A231F |
| `--color-surface-dark` (sidebar, dark CTAs) | #1C1714 | #0B0908 |
| `--color-surface-dark-2` | #2A231F | #1E1916 |
| `--color-border-default` | #ECE5DD | #2E2622 |
| `--color-border-strong` | #DCD2C8 | #3D332D |
| `--color-success` / `-bg` | #15803D / #E7F6EC | #4ADE80 / #0F2A1A |
| `--color-warning` / `-bg` | #B45309 / #FEF3E2 | #FBBF24 / #2E2210 |
| `--color-danger` / `-bg` | #DC2626 / #FDECEC | #F87171 / #331616 |
| `--color-info` / `-bg` | #2563EB / #EAF1FE | #60A5FA / #14213A |

- Spacing: 4, 8, 12, 16, 24, 32, 48, 64. Radius: sm 8, md 12 (controls), lg 16 / xl 20–24 (cards), full (pills).
- Type ramp (size/line-height):
  - Display XL 64/72, Display L 48/56
  - H1 36/44, H2 28/36, H3 22/30, H4 18/26
  - Body L 18/28, Body M 16/24, Body S 14/20
  - Label M 14/20 SemiBold, Label S 12/16 SemiBold
  - Overline 11/16 Bold, uppercase, +1.2 tracking
  - KPI number 32/40 ExtraBold
- Shadows: `sm`, `md`, `lg` and `brand` (an orange glow, used only on primary CTAs).
- Text on orange buttons always uses `--color-on-brand`. Never use the card color for it, because the card color turns dark in dark mode.

### Components (map 1:1 to Figma `01 · Design System`)

| Component | Variants / props |
|---|---|
| `Logo` | — |
| `Button` | variant: primary / secondary / ghost / dark; size: M (44px) / L (56px); optional trailing icon |
| `Badge` | tone: success / warning / danger / info / neutral / brand. Order status → tone: New=info, Preparing=brand, Ready=success, Completed=neutral, Cancelled=danger |
| `Chip` | active / default |
| `Input` | default / focus / error; label, helper text, leading icon |
| `Stepper` | quantity control |
| `ProductCard` | — |
| `KpiCard` | — |
| `CustomerNav` | — |
| `AdminSidebar` | — |

Build these once in `src/design-system/components/` and compose screens from them.

## Commands

**Current**
```bash
python -m venv .venv && .venv\Scripts\activate
pip install -r requirements-dev.txt   # runtime deps + pytest + ruff
cp .env.example .env            # fill in the env vars listed below
python scripts/migrate.py --baseline --seed   # fresh DB: schema + migrations + catalog seed
python scripts/migrate.py                     # existing DB: apply pending migrations only
python scripts/migrate.py --status            # show applied/pending migrations
python app.py                   # frontend + API at http://127.0.0.1:5000 (health: /api/test)
python scripts/seed_users.py    # creates admin/staff/customer @foodstack.local test users
pytest                          # backend tests (tests/); no database needed
pytest tests/test_order_service.py::test_design_example_totals_28_80   # single test
ruff check . && ruff format --check .   # lint + format (legacy layers are excluded from format)
```

**Frontend (Phase 2, Current)**
```bash
cd frontend && npm install
npm run dev          # Vite on :5173, proxies /api -> :5000 (design-system QA page: /_design-system)
npm run build        # tsc -b + vite build -> frontend/dist (Flask does not serve it yet)
npm run lint && npm run typecheck && npm test && npm run format:check
npx vitest run src/lib/lib.test.ts -t "theme"   # single test
```

**Target (not built yet)**
```bash
npx playwright test                              # E2E: checkout, login, kitchen flow
stripe listen --forward-to localhost:5000/api/payments/webhook   # local Stripe webhooks
```

- DB: see the **Database** section. `docs/sql/master_data_audit_cleanup.sql` is a manual audit script; never run it automatically. New schema changes go in numbered files under `docs/sql/migrations/` and must be idempotent (`IF NOT EXISTS` / `COL_LENGTH` checks, with `GO` between adding a column and using it).
- Set `SQL_TRUST_SERVER_CERT=yes` for a local SQL Server with a self-signed certificate.
- ODBC driver: read from `SQL_DRIVER`, default `ODBC Driver 18 for SQL Server`.
- Production: every push to `main` deploys to Azure App Service (West US 3) through `.github/workflows/main_foodstack-api-jl.yml` (gunicorn, Python 3.11). The workflow runs `ruff` and `pytest` before deploying (Phase 1). **Target:** it will also run `npm ci && npm run build` in `frontend/`.

### Environment variables
```
# Database / core
SQL_SERVER, DATABASE, SQL_USER, SQL_PASSWORD, SQL_DRIVER=ODBC Driver 18 for SQL Server, SQL_TRUST_SERVER_CERT
JWT_SECRET_KEY, FLASK_SECRET_KEY, FRONTEND_ORIGIN=http://localhost:5173, APP_ENV=development|production
# Payments
STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_CURRENCY=usd
# Business config (see Business rules)
TAX_RATE, SERVICE_FEE, DELIVERY_FEE, STORE_NAME, STORE_ADDRESS, STORE_TIMEZONE, STORE_HOURS
# Storage
AZURE_STORAGE_CONNECTION_STRING, AZURE_STORAGE_CONTAINER=product-images
# OAuth
GOOGLE_CLIENT_ID
# Frontend (Vite, public)
VITE_API_BASE_URL, VITE_STRIPE_PUBLISHABLE_KEY, VITE_GOOGLE_CLIENT_ID
```
Never commit `.env`. In Azure, secrets live in App Service → Configuration.

## Architecture

**Active code is `app.py`, `backend/`, `frontend/`, `scripts/` and `docs/`.**

### Backend (Current)
- `app.py` registers every blueprint under `/api`. It adds CORS headers in `after_request` only for the origin in `FRONTEND_ORIGIN` (with credentials; none when unset) and also serves the static files: `/` → `frontend/home.html`, `/<name>` → a file or `<name>.html`. Unknown non-API paths fall back to `login.html`.
- Each entity is layered (category, ingredient, order, order_product, order_product_ingredient, product, product_ingredient, user):
  - `Controllers/<x>_controller.py` is a Flask blueprint.
  - `Models/<x>.py` is a class with private `_attrs`, properties and raw SQL through pyodbc.
  - `Infrastructure/SQLServerConnection.py` opens a new connection per call and fails with a clear error when env vars are missing. No ORM.
- Response envelope: `{"status": 0, "data": ...}` on success and `{"status": 1, "errorMessage": ...}` on failure. Errors are often returned with HTTP 200, so clients must check `status`. Models raise `RecordNotFoundException` for missing rows.
- Many routes have singular/plural aliases (`/order/<id>` and `/orders/<id>`, `/user` and `/users`). `Endpoints.txt` is a partial endpoint map.
- Auth (`Security/Auth.py`):
  - JWT (HS256), read from `Authorization: Bearer` or the `auth_token` cookie. Use `@require_auth` and then `@require_roles("staff", ...)`. Roles: `customer`, `staff`, `admin`.
  - Order, order_product and order_product_ingredient routes are protected (list/update: staff or admin; orders are readable only by their owner or staff). Other controllers (users, catalog writes) still have `#@require_auth` commented out. Check before assuming a route is protected.
  - Public signup forces the role `customer` on the server.
- Orders have three levels: Order → OrderProduct → OrderProductIngredient (per-item customization). Product ↔ Ingredient goes through product_ingredient.

### Model / controller pattern (mandatory, Current and Target)
- **Models:**
  - Private attributes with property getters/setters.
  - Methods: `load_by_id`, `get_by_id` (returns nested full data), `get_all`, `to_dict`, `to_json`, `add`, `update`.
  - `add()` uses `OUTPUT INSERTED.Id` and returns the new id. `update()` validates `rowcount`.
  - Nested child data shares one `conn`, passed down the call chain.
- **Controllers:**
  - Call `to_dict()` directly, never `json.loads(to_json())`, and never pass `conn` into `to_dict()`.
  - POST returns the new id. PUT does partial merging: load the existing record, then overwrite only the fields that were sent.
  - Never call methods that don't exist on the model. Flag any deviation from this pattern explicitly.

### Backend (Target)
**Done in Phase 1:** `app.py` is thin; `backend/app_factory.py` (`create_app`, CORS, global error handlers with `errorCode`, static serving), `backend/config.py` (validated env; production fails fast on missing vars), `backend/errors.py` (shared `RecordNotFoundException`, `AppError`, `ValidationError`, `ConflictError`) and `backend/Services/order_service.py` (pure pricing, promo validation and status state machine, fully unit tested) exist. **Not done yet:** `payment_service`, `auth_service`, wiring `order_service` into the controllers (needs the new Orders columns and `Order_Status_History`), and the `Security/csrf.py` / `rate_limit.py` / `i18n/` modules.
```
app.py                      # thin: from backend.app_factory import create_app; app = create_app()
backend/
  app_factory.py            # create_app(): config, blueprints, CORS, error handlers, static SPA serving
  config.py                 # reads env, validates required vars at startup
  Controllers/              # thin blueprints: parse/validate input → call a service → envelope
  Services/                 # business logic; the only layer that talks to Stripe/Google
    order_service.py        # server-side pricing, status state machine
    payment_service.py      # Stripe PaymentIntents + webhook handling
    auth_service.py         # password + Google login, JWT issuing
  Models/                   # unchanged pattern above (data access only)
  Infrastructure/           # SQLServerConnection, stripe_client.py, google_oauth.py, blob_storage.py
  Security/                 # Auth.py, csrf.py, rate_limit.py
  i18n/                     # en.json, es.json for server messages (emails, receipts)
docs/sql/migrations/        # 001_…sql, 002_…sql
tests/                      # pytest: services with a fake connection, controllers with Flask test client
```
- **Controllers never contain business logic or SQL.** Services orchestrate models and integrations.
- **HTTP status codes:** keep the `{status, data | errorMessage}` envelope, and also return the correct HTTP code (400/401/403/404/409/422/500). Add a stable `errorCode` (for example `ORDER_NOT_FOUND`) that the frontend translates. Global error handlers map `RecordNotFoundException` → 404 and validation errors → 422.
- **Order status state machine** (enforced in `order_service`):
    - Order status: `pending_payment → received → preparing → ready → completed`. `cancelled` is allowed from `pending_payment` or `received` only.
  - Payment status, a separate field: `unpaid | paid | refunded | failed | pay_at_counter`.
  - Every transition also inserts a row into `Order_Status_History`.
- **Pricing is computed only on the server**, from DB prices plus the extra prices of the chosen ingredients. Never trust totals sent by the client. Amounts are stored as `DECIMAL(10,2)` and converted to integer cents only for Stripe.
- **Real-time:** the kitchen board and order tracking poll every 10 seconds, as the design says ("auto-refresh every 10s"). Server-Sent Events (`/api/orders/stream`) can come later behind the same client hook.
- **Product images:** stored in Azure Blob Storage, with only the URL saved in the DB. The Pillow menu-graphic generator lives in `scripts/`.

### Frontend (Current)
- Plain pages (`home, menu, cart, login, signup, staff-home, admin-login, admin-dashboard`), each with a matching `js/` and `css/` file, plus a shared `global.css`.
- `js/runtime-config.js` + `js/api-client.js` are the shared layer:
  - API base URL resolution: config → `localStorage['foodstack-api-base-url']` → same origin.
  - Token storage in `foodstack-auth-token`, and the `Authorization` header.
  - Go through `api-client.js`; don't call `fetch` directly.
- Demo mode: `js/demo-catalog.js`, `data.js` and `admin-data.js` provide fallback data when the API is down. It is toggled by `DEV_FALLBACK_MODE`, `?demo=1|0` or `localStorage['foodstack-demo-mode']`.
- Staff views validate the session with `GET /api/session`, not just localStorage.
- Serve the frontend through Flask (same origin) rather than Live Server, to avoid cookie/session problems.
- **Legacy pages shadow SPA routes.** `menu.html`, `cart.html`, `login.html`, `signup.html` share a folder (and Flask's `<name>.html` lookup) with the new app. The Vite dev server has a `spaFirst` plugin so `/menu` etc. render React; Flask will need the same precedence when it serves `dist` (Phase 7 removes the legacy pages).

### Frontend (Target)
**Done in Phase 2:** the Vite + React 18 + TypeScript app lives in `frontend/` next to the legacy pages (`index.html`, `src/`, `package.json`). It has `design-system/` (tokens.css light + dark, typography, motion tokens, the 10 Figma components + `TabBar`, Lucide icons), the router with every route in the screen map as a placeholder, role guards (`RequireRole`), `CustomerLayout` / `MobileTabLayout` / `AdminLayout`, theme + language + auth providers, `locales/en.json` + `es.json`, `lib/api-client.ts`, and Vitest tests. **Not done:** all real screens (Phase 3/6), Tailwind, Zustand cart, MSW demo mode, Playwright, and Flask serving `frontend/dist`.

**Done in Phase 3:** all nine customer screens under `src/features/` (`landing`, `menu` incl. the product modal and cart panel, `cart`, `checkout`, `orders` for tracking and history, `auth`), a Zustand cart persisted in localStorage (`features/cart/cartStore.ts`), TanStack Query hooks (`features/shared/queries.ts`), a toast provider, `Modal` / `Checkbox` / `Textarea` / `SegmentedControl` / `RadioCard` / `Skeleton` / `ErrorBanner` / `EmptyState` in the design system, and the mobile bottom-sheet modal and floating cart bar. Totals are **never computed in the UI**: every price comes from `POST /cart/quote`.

**Mock API (demo mode).** `src/mocks/` implements the contract with MSW (catalog of 17 products, pricing that mirrors `backend/Services/order_service.py` in integer cents, auth, checkout, orders that advance received -> preparing -> ready on a timer). It is ON for `npm run dev` and OFF for production builds. Toggle with `?demo=1|0`, `localStorage['foodstack-demo-mode']` or `VITE_MOCK_API`. `localStorage['foodstack-mock-open']` = `1` (default) / `0` (store closed) / `auto` (real 11:00-23:00 America/Tijuana). Seeded accounts are the ones from `scripts/seed_users.py`. Tests use the same handlers through `src/test/msw.ts` (`setupMockApi()`) and `src/test/render.tsx` (`renderApp`, `signInAs`).

**Phase 3 status (deliberately left out because the data or backend does not exist):** product ratings and the size picker, favorites, reward points, saved addresses/payment methods, the "SMS updates" card, the My Orders stats row and search, "Remember me" / "Forgot password", the Google button (Phase 5), card payment (disabled "Coming soon" until Phase 4; every order is pay-at-counter), the trust stats and testimonial on Landing, and Deals/Locations links. Cart line names are stored in the language active when the item was added.

React 18 + Vite + TypeScript, built to `frontend/dist` and served by Flask (same origin in production; the Vite proxy in development).
```
frontend/src/
  app/                 # router (React Router), providers (Query, Theme, I18n, Auth), layouts (CustomerLayout, AdminLayout, MobileTabLayout)
  design-system/       # tokens.css, motion.ts, components/ (see table above)
  features/            # menu, product, cart, checkout, orders, auth, kitchen, admin-dashboard, admin-products, admin-orders
  lib/                 # api-client.ts (port of api-client.js incl. envelope + errorCode handling), query keys, format.ts (Intl currency/date)
  locales/             # en.json, es.json
```
- Data fetching uses TanStack Query (the `refetchInterval: 10_000` for live views). The cart lives in a small Zustand store persisted to localStorage, and is re-priced by the API at checkout.
- Styling: CSS variables from `tokens.css`. Phase 2 components use plain CSS files that only reference those variables (no Tailwind yet; add it only if screens need utilities, mapped to the same variables). Never hard-code colors: no hex outside `tokens.css`.
- Carry demo mode forward as a mock API adapter (MSW), used for client demos without a database.
- Accessibility:
  - Every control is keyboard-reachable with a visible focus ring (`brand-500`).
  - Modals and drawers trap focus and close on Esc.
  - Text contrast is WCAG AA in both themes.

## Features to implement (Target specs)

### 1. Stripe payments
- Use **Stripe Payment Element + PaymentIntents**: the card fields are embedded, as in the Checkout design. Apple Pay and Google Pay come automatically through the Payment Element. "Pay at counter" skips Stripe and sets `payment_status = pay_at_counter`.
- Flow:
  1. `POST /api/checkout` validates the cart, creates the order (`pending_payment`), computes the total on the server and creates a PaymentIntent with `metadata.order_id`. It returns `client_secret`.
  2. The frontend confirms the payment with `stripe.confirmPayment`, then goes to `/orders/:id`.
  3. `POST /api/payments/webhook` checks the signature with `STRIPE_WEBHOOK_SECRET`. On `payment_intent.succeeded`, it sets `paid` and `received`. On `payment_intent.payment_failed`, it sets `failed`.
- **The webhook is the only source of truth for "paid".** It must be idempotent: store processed `event.id` values in `Stripe_Events` and skip duplicates. Record every charge and refund in `Payments`.
- Refunds: admin `POST /api/orders/:id/refund` → Stripe Refund → `refunded`, plus the order is cancelled.
- Promo codes (for example `FOODSTACK20`) are validated and applied on the server before the PaymentIntent is created.
- Never log card data or full Stripe objects. Use test mode and test cards (`4242 4242 4242 4242`) outside production.

### 2. Google OAuth
- The frontend uses Google Identity Services ("Continue with Google" on Login and Sign up) to get a Google **ID token**. It posts the token to `POST /api/auth/google`.
- The backend verifies the token with `google.oauth2.id_token.verify_oauth2_token` (audience = `GOOGLE_CLIENT_ID`) and requires `email_verified`. It then finds the user by `google_sub` or `email` (linking accounts by email), or creates a `customer`.
- After that it issues **the same FoodStack JWT** as password login. Roles still come only from our DB; staff and admin roles are never granted through Google.
- Password users and Google users share the same `/api/session` flow.

### 3. English / Spanish toggle
- `react-i18next` with `locales/en.json` and `locales/es.json`. Keys are namespaced by feature (`menu.title`, `checkout.placeOrder`).
- **No hard-coded UI strings.**
- The language is chosen in this order: `localStorage['foodstack-lang']` → `users.preferred_language` (when logged in) → `navigator.language` → `en`. The toggle sits in `CustomerNav`, the mobile Profile tab and the admin topbar.
- Set `<html lang>`. Format money and dates with `Intl` for the active locale (`en-US` / `es-MX`). The currency comes from `STRIPE_CURRENCY`.
- Product and category content is translated in the DB (see schema). The API accepts `?lang=` or `Accept-Language` and falls back to English.
- API errors are translated on the client from `errorCode`, not from `errorMessage`.

### 4. Dark mode toggle
- Set `data-theme="light|dark"` on `<html>`. `tokens.css` defines `:root` (light) and `[data-theme="dark"]` from the token table above.
- The theme is chosen in this order: `localStorage['foodstack-theme']` → `prefers-color-scheme` → light. The toggle offers Light / Dark / System.
- To avoid a flash of the wrong theme, an inline script in `index.html` applies the theme before React mounts.
- Images and food photos stay unfiltered. Shadows get lighter in dark mode, and borders carry the elevation instead.

### 5. Animations
- Use the `motion` (Framer Motion) package. Tokens live in `design-system/motion.ts`:
  - Durations: `fast` 120ms, `base` 200ms, `slow` 320ms.
  - Easing: `standard` `cubic-bezier(0.2, 0, 0, 1)`, `emphasized` `cubic-bezier(0.3, 0, 0, 1.2)`.
- Patterns:
  - Page enter: fade + 8px rise.
  - Product card hover: lift 2px + `shadow-md`.
  - Add to cart: the cart count badge pops (scale 1 → 1.2 → 1), and a toast confirms.
  - Product modal: overlay fade + panel scale 0.96 → 1. On mobile it is a bottom sheet.
  - Order drawer: slides in from the right.
  - Kitchen board: `layout` animation when a ticket moves between columns, plus a pulse on new tickets with an optional sound.
  - Order tracking: the progress connector animates, and the active step pulses.
  - Loading: skeleton shimmer, not spinners.
- **Always respect `prefers-reduced-motion`.** With it on, reduce everything to plain opacity changes.

## Business rules (source of truth for pricing and order logic)

The numbers below come from the Figma design, which they reproduce exactly (cart $35.60, checkout $28.80). They are set through env/config and **never hard-coded**:
```
TAX_RATE=0.08  SERVICE_FEE=1.50  DELIVERY_FEE=2.99  CURRENCY=USD
STORE_NAME="FoodStack Zona Río"  STORE_ADDRESS="Blvd. Sánchez Taboada 10488, Tijuana, B.C."
STORE_TIMEZONE=America/Tijuana  STORE_HOURS="mon-sun 11:00-23:00"
```
- **Pricing** (Python `Decimal`, `ROUND_HALF_UP` to 2 decimals at each step):
  - `line = (product.Price + Σ extra) × quantity`, where `extra = max(0, chosen_qty − Default_Ingredients) × Ingredient.Extra_Price`. Removing an ingredient never lowers the price.
  - `subtotal = Σ lines`
  - `discount = subtotal × Percent_Off/100`, or `Amount_Off`, capped at the subtotal
  - `fees = SERVICE_FEE (+ DELIVERY_FEE if delivery)`
  - `tax = (subtotal − discount + fees) × TAX_RATE`
  - `total = subtotal − discount + fees + tax`
  - Check: subtotal 31.46 → discount 6.29 → fee 1.50 → tax 2.13 → total 28.80.
- **Customization limits:** `0 ≤ qty ≤ Max_Ingredients`. The quantity may go below `Default_Ingredients` only if `Is_Removable`. Products with `Allow_Customization = 0` accept no ingredient changes.
- **Promo codes:**
  - Valid when `Status = 1`, the current time is inside Starts_At/Expires_At, subtotal ≥ Min_Subtotal, redemptions are under the max, and for first-order codes the user has no paid or completed order.
  - Increment `Times_Redeemed` only when the order reaches `received`.
- **Availability:** a product is orderable when `Status = 1`, `Is_Available = 1`, `Publish_Status = 'active'` and (`Stock` IS NULL or > 0).
- **Stock:** decrement stock when the order reaches `received`, and restore it on cancel or refund. At 0, the product shows "Out of stock" and can't be added to the cart.
- **Ordering hours:** orders are accepted only while the store is open (`STORE_HOURS`, `STORE_TIMEZONE`). Outside hours, the menu still shows, but checkout is disabled with a "Closed · opens at 11:00" message. A scheduled order must fall inside open hours, today or tomorrow.
- **Order flow:**
  - Card: `pending_payment` until the Stripe webhook arrives, then `received`.
  - Pay at counter: straight to `received`, with payment status `pay_at_counter`.
  - Staff then move the order through `preparing → ready → completed`.
  - The customer can cancel only while the order is `received` (before the kitchen accepts it). Staff or admin can cancel from `received` or `pending_payment`.
  - A cancelled paid order is refunded automatically.
- **ETA ("Ready in 8 min"):** `max(Prep_Time_Max of items) + 2 min × orders currently preparing`, counted from `received`.
- **Every status change** writes an `Order_Status_History` row with `Changed_By_User_Id`.

## API contract (Target; all under `/api`, all return the `{status, data | errorMessage, errorCode}` envelope)

> **Backend status:** none of these endpoints exist in Flask yet; the frontend runs on MSW mocks (`src/mocks/`). The typed DTOs are in `frontend/src/lib/api/types.ts`. Phase 3 relied on these **proposed extensions** that the real backend must implement: `GET /store` (name, address, timezone, currency, `isOpen`, `opensAt`, `closesAt`, `waitMinutes`); `isFeatured`, `prepTimeMin`/`prepTimeMax` and `allowCustomization` on products; `lang` on `/menu`, `/products/:id`, `/me/orders` and `/orders/:id`; `status=active|completed|cancelled` on `/me/orders`; `/auth/*` paths instead of the legacy `/login`, `/user`; `productIngredientId` on order-line ingredients; HTTP 409 `STORE_CLOSED` from `/checkout`.

| Method & path | Auth | Request → `data` |
|---|---|---|
| `GET /menu?lang=` | public | → `[{category:{id,slug,name}, products:[{id,name,description,image,price,calories,prepTime,isAvailable,stock}]}]` (only orderable products, sorted) |
| `GET /products/:id?lang=` | public | → product + `ingredients:[{productIngredientId,name,extraPrice,default,max,removable}]` |
| `POST /cart/quote` | public | `{items:[{productId,quantity,ingredients:[{productIngredientId,quantity}],notes}], promoCode?, fulfillmentType}` → `{lines:[…], subtotal, discount, serviceFee, deliveryFee, tax, total, promo:{code,valid,reason}}` |
| `POST /auth/signup` · `/auth/login` · `/auth/google` `{idToken}` · `/auth/logout` | public | → `{user}`. The token is set as an HttpOnly cookie |
| `GET /session` | any | → `{user:{id,name,email,role,preferredLanguage,preferredTheme}}` |
| `PATCH /me` | customer | `{name?,phone?,preferredLanguage?,preferredTheme?}` |
| `POST /checkout` | customer | cart (as in quote) + `{contact:{name,phone,email}, fulfillmentType, deliveryAddress?, scheduledFor?, paymentMethod:'card'\|'counter', promoCode?}` → `{orderId, orderNumber, total, clientSecret?}` |
| `GET /me/orders?status=&page=` | customer | → paged order summaries |
| `GET /orders/:id` | owner, staff, admin | → order + lines + `history[]` + `eta` |
| `POST /orders/:id/cancel` | owner, staff, admin | `{reason?}` |
| `POST /payments/webhook` | Stripe signature | raw body, no auth/CSRF |
| `GET /kitchen/orders` | staff, admin | → active orders grouped by status |
| `PATCH /orders/:id/status` | staff, admin | `{status}` (validated against the state machine) |
| `GET /admin/dashboard?range=today\|7d\|30d\|90d` | admin | → KPIs (revenue, orders, avg ticket, avg prep), revenue series, best sellers, recent orders |
| `GET /admin/orders?status=&q=&page=` | admin | → paged orders |
| `POST /orders/:id/refund` | admin | `{amount?}` (default is a full refund) |
| `GET/POST/PUT/DELETE /admin/products[/:id]` | admin | full product, including translations and ingredient rules; DELETE soft-deletes |
| `POST /admin/products/:id/image` | admin | multipart → Azure Blob → `{imageUrl}` |
| `GET/POST/PUT /admin/promo-codes[/:id]` | admin | promo code CRUD |

Paging is `?page=1&pageSize=20` → `{items, page, pageSize, total}`. Use camelCase in JSON and `Pascal_Snake` in SQL; map between them in `to_dict()`.

## Scope

- **In scope:** everything in the Figma screens, plus the states the design doesn't draw: loading skeletons, empty cart, empty orders, empty kitchen column, out-of-stock product, store closed, API error banner with retry, 404 page and session-expired redirect.
- **UI only for now (no backend yet):**
  - Hide these sidebar items behind a `coming soon` badge: Customers, Reports, Categories, Ingredients.
  - Hide the reward points.
  - Saved addresses and saved payment methods.
  - Favorites (the heart icon).
  - The Deals and Locations nav links.
- **Out of scope:**
  - SMS. The tracking page shows the order status only; remove the "SMS updates" card or say "We'll notify you here".
  - Multiple stores.
  - Driver tracking.
  - Native mobile apps. Mobile means responsive web.
- **Definition of done for each screen:**
  - Matches Figma at 1440px and 390px.
  - Works in light and dark themes and in EN and ES.
  - Fully keyboard-accessible.
  - Respects reduced motion.
  - Handles loading, empty and error states.
  - Has no console errors.

## Test accounts & local payments
- `scripts/seed_users.py` creates `admin@`, `staff@` and `customer@foodstack.local`. Use them for every role-based check.
- Stripe test mode only, with test keys. Test cards: `4242 4242 4242 4242` (success), `4000 0000 0000 9995` (declined), `4000 0025 0000 3155` (3-D Secure). Run `stripe listen --forward-to localhost:5000/api/payments/webhook` and put the printed secret in `STRIPE_WEBHOOK_SECRET`.
- Google OAuth: create a Web client in Google Cloud Console, and add `http://localhost:5173` and the production URL as authorized JavaScript origins.

## Database (SQL Server)

Tables are plural with `Pascal_Snake` columns, except `Users`, which uses lowercase. Every table has `Id INT IDENTITY` PK, `Status INT` (1 = alive, 0 = soft-deleted; every model filters on it) and `Created_At`. Money is `DECIMAL(10,2)`; convert to integer cents only when calling Stripe (`int(round(amount * 100))`).

Setup: `docs/sql/schema.sql` (baseline) → `docs/sql/migrations/NNN_*.sql` (idempotent, tracked in `Schema_Migrations`) → `docs/sql/seed.sql` (runs only when `Products` is empty). One command does it all: `python scripts/migrate.py --baseline --seed`. Never edit an applied migration; add a new numbered file.

| Table | Key columns (★ = added by migrations 001–007) | Notes |
|---|---|---|
| `Users` | id, name, lastname, phone_number, email (unique), password_hash (NULL for Google-only ★), role (`customer\|staff\|admin`), ★google_sub (unique), ★auth_provider (`password\|google`), ★preferred_language (`en\|es`), ★preferred_theme (`light\|dark\|system`), ★avatar_url, ★last_login_at | CHECK: password_hash or google_sub required |
| `Categories` | Id, Name, ★Slug, ★Sort_Order | Exactly 4 live rows: burgers, burritos, sides, beverages |
| `Category_Translations` ★ | Category_Id, Lang, Name | unique (Category_Id, Lang) |
| `Products` | Id, Category_Id, Name, Description, Image, Price, ★Sku (unique), ★Cost, ★Stock (NULL = untracked), ★Low_Stock_Threshold, ★Prep_Time_Min/Max, ★Calories, ★Is_Available, ★Is_Featured, ★Allow_Customization, ★Publish_Status (`active\|draft`), ★Updated_At | Base row = English text |
| `Product_Translations` ★ | Product_Id, Lang, Name, Description | |
| `Ingredients` | Id, Name, Extra_Price | |
| `Ingredient_Translations` ★ | Ingredient_Id, Lang, Name | |
| `Product_Ingredients` | Product_Id, Ingredient_Id, Default_Ingredients (qty included), Max_Ingredients, ★Is_Removable, ★Sort_Order | Extra charge = (chosen − default) × Extra_Price |
| `Promo_Codes` ★ | Code (unique), Percent_Off \| Amount_Off, Min_Subtotal, First_Order_Only, Max_Redemptions, Times_Redeemed, Starts_At, Expires_At | Seed: `FOODSTACK20` (20%, first order) |
| `Orders` | Id, User_Id, Status, Total, Datetime, ★Order_Number (computed `FS-0042`), ★Payment_Status (`unpaid\|paid\|failed\|refunded\|pay_at_counter`), ★Payment_Method (`card\|counter`), ★Fulfillment_Type (`pickup\|delivery`), ★Contact_Name/Phone/Email, ★Delivery_Address, ★Scheduled_For (NULL = ASAP), ★Notes, ★Currency, ★Subtotal, ★Discount, ★Service_Fee, ★Delivery_Fee, ★Tax, ★Promo_Code_Id, ★Stripe_Payment_Intent_Id (unique), ★Cancel_Reason, ★Updated_At | Total = Subtotal − Discount + fees + Tax |
| `Order_Products` | Order_Id, Product_Id, Quantity, Price (unit price snapshot), ★Notes | |
| `Order_Product_Ingredients` | Order_Product_Id, Product_Ingredient_Id, Quantity, ★Unit_Extra_Price (snapshot) | |
| `Order_Status_History` ★ | Order_Id, From_Status, To_Status, Changed_By_User_Id (NULL = system/webhook), Note | Feeds the tracking timeline, the drawer "Activity" and prep-time KPIs. Write a row on every status change. |
| `Payments` ★ | Order_Id, Kind (`charge\|refund`), Provider (`stripe\|counter`), Provider_Ref (unique, `pi_…`/`re_…`), Amount, Currency, Status (`pending\|succeeded\|failed`), Card_Brand, Card_Last4 | Display data only; never store full card numbers |
| `Stripe_Events` ★ | Event_Id (PK), Type, Order_Id | Webhook idempotency: insert first; a duplicate key means already processed |
| `Schema_Migrations` | Version, Applied_At | Managed by `scripts/migrate.py` |

- **Order status values:**
  - Normal flow: `pending_payment`, `received`, `preparing`, `ready`, `completed`. `cancelled` is allowed from `pending_payment` or `received` only.
  - `pending` is legacy: the current controller still writes it. Migration 005 converts existing rows to `received`, and the CHECK constraint keeps allowing `pending` until Phase 1 changes the controller default.
- **Retired categories:** Tacos and Shakes are soft-deleted (`Status = 0`), along with their products. Never hard-delete products, because past orders reference them.
- **When you add columns to a model**, extend its SELECT/INSERT/UPDATE and `to_dict()` together. Follow the model pattern above.
- **Seed catalog:** 17 products. 4 burgers (Overkill Double, BBQ Bacon, Stack, Spicy), 4 burritos (Stack, Chicken, Spicy Beef, Veggie), 4 sides (Cheese Bites, Fries, Onion Rings, Nachos) and 5 beverages (Iced Horchata, Classic Milkshake, Lemonade, Iced Tea, Soda). EN and ES text, USD prices. `assets/images/drinks/iced-horchata.png` doesn't exist yet; add it.

## Security & quality checklist
- CORS is already restricted to `FRONTEND_ORIGIN` (Phase 0). Store the JWT in an `HttpOnly; Secure; SameSite=Lax` cookie, and require a CSRF token (double-submit) on cookie-authenticated state-changing requests.
- Order routes are protected (Phase 0); audit the remaining blueprints (users, product/category/ingredient writes):
  - Customers may only read their own orders.
  - Staff may change order status.
  - Only admins may manage products, users and refunds.
- Rate-limit `/api/auth/*`, `/api/checkout` and `/api/payments/*` (Flask-Limiter).
- Validate input on every POST/PUT (pydantic or marshmallow schemas in the controllers). Use parameterized SQL only; never format strings into SQL.
- Set security headers (CSP that allows `js.stripe.com` and `accounts.google.com`).
- Tests are required for:
  - pricing
  - the order state machine
  - webhook idempotency
  - Google token verification (mocked)
  - auth/role guards
- Add Ruff and ESLint/Prettier. CI fails on lint, typecheck or test errors.

## Roadmap (tick as implemented)
- [x] Phase 0: Remove the Hotels leftovers, fix the ODBC driver env var, restrict CORS, re-enable auth on orders, return proper HTTP codes. (Scope: order, order_product and order_product_ingredient controllers; catalog/user/category controllers still have `#@require_auth` commented out and per-line ownership checks come with the Phase 1 services.)
- [x] Database: migrations 001–007, the 4-category seed and `scripts/migrate.py`.
- [ ] Phase 1: `app_factory`, `config`, `Services/` layer, update the models and controllers for the new columns, pytest + Ruff. (Done: app_factory, config, errors, order_service, pytest + Ruff + CI step. **Remaining:** model/controller column updates and wiring the service into controllers, blocked until migrations 001-007 are committed to the repo.)
- [x] Phase 2: Vite + React + TS app, `tokens.css` (light + dark), design-system components, routing, i18n + theme scaffolding. (Components verified against Figma in light and dark. Provisional: `--shadow-md/lg`, `--color-on-dark`, `--radius-tile/card` are not in the Figma variables. Mobile floating cart bar waits for the Phase 3 cart store.)
- [x] Phase 3: Customer screens (Landing, Menu, Product modal, Cart, Checkout without payment, Tracking, My Orders, Login, Sign up) plus the mobile layouts. (Runs on MSW mocks of the API contract; the Flask endpoints do not exist yet. See "Phase 3 status" below for what was left out on purpose.)
- [ ] Phase 4: Stripe (PaymentIntents, webhook, refunds, promo codes).
- [ ] Phase 5: Google OAuth.
- [ ] Phase 6: Staff Kitchen Board and Admin (Dashboard, Orders + drawer, Products, Product Editor with ingredients and image upload).
- [ ] Phase 7: Animations polish, accessibility pass, Playwright E2E, CI build of the frontend, remove the legacy `frontend/*.html` pages.
