<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Marketing-Engine

Offline-first **PWA** (Next.js 16 App Router, React 19, Tailwind v4) for field staff to log marketing activities per **Hub** (a care-service location). Two activity types today: **Flyer/Aufsteller ausgelegt** and **Case-Management-Box beliefert**. Backend is **Supabase** (Auth + Postgres + Storage). An **Assistant** (Claude Opus 4.8, tool-use) answers reporting questions. All user-facing copy is **German**.

## Commands

```bash
npm run dev            # dev server (Turbopack) on http://localhost:3000
npm run build          # production build (also runs tsc)
npm run lint           # eslint
npx tsc --noEmit       # typecheck — run after edits; there is NO test suite yet
node scripts/gen-icons.mjs   # regenerate PWA placeholder icons
```

Env changes in `.env.local` require a **dev-server restart** (Next does not hot-reload env). See [.env.example](.env.example). The Assistant route returns a 503 with a clear message if `ANTHROPIC_API_KEY` is unset.

## Database & migrations

SQL in `supabase/` is applied by pasting into the Supabase SQL editor (no CLI wiring):
- `migrations/0001_init.sql` — tables + triggers (`handle_new_user` auto-creates a `profiles` row on signup; `set_updated_at`).
- `migrations/0002_rls.sql` — **all data access is RLS-scoped.** Helpers `is_admin()` / `has_hub(hid)` are `SECURITY DEFINER` to avoid recursion. Employees see/insert only their hubs (`user_hubs`) and update/delete only their **own** activities; admins see all.
- `migrations/0003_hubs_md.sql` — adds `hubs.responsible_md`.
- `seed.sql` — material catalog + real hubs (name + responsible MD).
- `setup.sql` — one-paste concatenation for fresh installs; **regenerate** it (`cat` migrations + seed) whenever they change.
- `apply_hubs.sql` — one-off to swap placeholder hubs for the real 24 on an existing DB.

No self-signup: create users in Supabase Auth, then promote to admin + assign hubs via SQL. User↔Hub is **n:m** (`user_hubs`); one person can own many hubs.

## Architecture

- **Data model.** `activities` is the core table; type-specific fields live in a `details` jsonb column **validated by Zod** in [src/lib/schemas.ts](src/lib/schemas.ts) (`activityInputSchema` = discriminated union on `type`). New activity type = new Zod variant + form branch, **no DB migration**. Auslage-Ort is free text (`standort_name`); `standorte` is only an optional autocomplete list.
- **Supabase clients** ([src/lib/supabase/](src/lib/supabase/)): `client.ts` (browser), `server.ts` (cookies), `middleware.ts` wired via [src/proxy.ts](src/proxy.ts) (Next 16 renamed `middleware`→`proxy`; it refreshes the session and guards routes). `Database` types are **hand-written** in [src/lib/types.ts](src/lib/types.ts) — every table needs `Relationships: []` or the typed client collapses to `never`. Keep types in sync with SQL by hand, and **avoid embedded-relation selects** (they resolve to `never` on hand-written types — do two simple queries; see `requireSession` in [src/lib/auth.ts](src/lib/auth.ts)).
- **Offline-first** ([src/lib/offline/](src/lib/offline/)) — the subtle part. UI writes never hit Supabase directly; they go through a **Dexie (IndexedDB) queue** keyed by a **client-generated UUID that is also the Supabase row id**, so sync is an **idempotent upsert** (create=update; delete by id). `syncQueue()` flushes in order and **stops on first failure**. The activity list **merges** server rows with the live queue so offline changes show immediately. The service worker ([public/sw.js](public/sw.js)) caches only the app shell, not data writes.
- **Assistant** ([src/app/api/assistant/route.ts](src/app/api/assistant/route.ts)) — manual tool-use loop (`client.messages.create`, cap 6 iterations) with read-only tools that query Supabase via the **logged-in user's** server client, so **RLS scopes results automatically**. Aggregation is done in JS after an RLS-scoped fetch.
- **CRM, Frontoffice & Call-Center.** Frontoffice (inbound leads) and call center (outbound calls + Recare) are **separate teams with separate token links**: `/f/[token]` = lead capture only, `/c/[token]` = CRM call list + Recare management (tokens in `app_settings`, helpers in [src/lib/frontoffice-token.ts](src/lib/frontoffice-token.ts)). One shared database for admins (`/ziele`), PDLs (`/h/[token]`) and both teams: `crm_targets` (institutions, with editable **`geo_tag`** auto-derived from Ort/Hub in [src/lib/geo-tags.ts](src/lib/geo-tags.ts)) + `crm_persons` (n contacts per institution) + `crm_contacts` (contact log; art `lead` = inbound lead, logged **without** touching follow-up dates). Inbound leads (`lead_calls`) are fuzzy-matched to institutions via `normName` in [src/lib/crm-log.ts](src/lib/crm-log.ts) and linked via `lead_calls.target_id`. CSV file import with column mapping lives in [crm-csv-import.tsx](src/components/crm-csv-import.tsx) (client parses via [src/lib/csv.ts](src/lib/csv.ts), server dedupes in `importCrmTargetsCsv`).
- **UI.** shadcn/ui on **base-ui** (not Radix): use the `render` prop, **not** `asChild`. Route group `(app)` is the authenticated shell; `/login` and `/offline` sit outside it. [ActivityForm](src/components/activity-form.tsx) is shared by create and edit.

## UI/UX Design System (binding for ALL UI work)

**Primary visual reference: [docs/design/crm-ui-reference.png](docs/design/crm-ui-reference.png) — inspect it before any significant UI change.** It outranks generic contemporary design trends. Full ruleset (read before UI work): [docs/design/design-system.md](docs/design/design-system.md).

- **Goal: extreme ease of use, glanceability, simplicity, intuitiveness.** Every screen must pass the **3-second test**: what page is this, what matters most, what are the primary actions?
- **Aesthetic:** polished 2018–2020 productivity SaaS (classic Airtable/Asana), an **application, not a website**: white / very light cool-gray canvas, strong grid, white boxes (8–12px radius, thin gray border, subtle shadow), persistent left sidebar with icon+label and a strong colored active state.
- **Color:** canvas mostly white; bold saturated accents (strong blue, emerald, purple, orange, coral, cyan, pink) reserved for KPIs, icons, primary buttons, active nav, statuses/tags, charts — with **consistent semantic meaning**. Never mostly-gray monochrome. (Chart internals additionally follow the dataviz skill — validated palettes win there.)
- **Typography:** page titles 24–28 bold · section titles 16–18 semibold · KPI values 26–34 bold · UI text 14–15 · secondary 12–13. Important numbers big and obvious.
- **Buttons look like buttons** (primary: solid color + white text; secondary: white + border), radius ~6–10px, no pill-everything. Prefer familiar patterns (tables, tabs, forms, modals, filters); essential actions stay visible — never hidden behind clever interactions.
- **Priority order (exact):** ease of use > glanceability > clarity > intuitiveness > predictability > speed > consistency > accessibility > visual attractiveness > novelty. When pretty conflicts with clear, choose clear.
- **Forbidden:** glassmorphism, dark futuristic UI, neon, mesh/excess gradients, floating decoration, excessive animation, giant radii, marketing typography, gray-on-gray low contrast, excessive whitespace, aesthetics-only bento, hidden controls, clarity-sacrificing minimalism.
- **Simplicity ≠ minimalism:** dense information is fine when structured via boxes, alignment, hierarchy and semantic color.
- **Consistency:** reuse shared components (`PageHeader`, cards, chips, tables, `ui/button`, `ui/input`, empty states) — extend them, don't restyle per screen.
- **Functionality is sacred:** inspect a screen's behavior before redesigning it and preserve every interaction; apply the design system around the functionality, never instead of it.

## Mitarbeiter-App (`/mitarbeiter`) — eigene Regeln

A second, **mobile-first** app for ~650 frontline staff lives in this repo: announcements + customer referrals + M&A referrals. Full runbook: **[docs/mitarbeiter-app.md](docs/mitarbeiter-app.md)** — read it before touching anything under `src/lib/employee/`, `src/app/(employee)/`, or `src/app/api/employee/`.

- **Separate Postgres schema `employee_app`** (not `public`). One-time prerequisite: add it to Supabase → Settings → API → **Exposed schemas**, otherwise PostgREST answers `406 / PGRST106` **even for service-role**. Tables have RLS enabled with **zero policies** + revoked grants + `alter default privileges` — unlike `public`, which carries the stock `anon` grants that currently make CRM tables world-readable/writable.
- **Auth is device-bound, not password-based.** Activation code → binds a device (32-byte secret, hashed) → the 6-digit PIN unlocks *only that device*. There is deliberately **no endpoint accepting (employee identifier + PIN)** — that is what makes a 6-digit PIN defensible. Recovery = new code from the hub leader; never build a self-service reset.
- **The invariant:** `staff_id` comes **only** from `requireEmployee()` — never from body/query/header. All Zod schemas are `.strict()` and contain no identity fields. Routes use the service-role client (`BYPASSRLS`), so the DB enforces *nothing* — a single line reading `staff_id` from the request would be a full IDOR across all 650 employees.
- **Never** create a view or `SECURITY DEFINER` function in `public` that reads `employee_app` — it would run with the owner's rights and bypass all three protection layers.
- **Design:** deliberately NOT the desktop CRM aesthetic above. It inherits the color/radius tokens but uses its own mobile layer (`src/components/m/`, `.m-*` classes in `globals.css`): 17px base font (below 16px iOS auto-zooms), 48px tap targets, bottom tab bar, safe-area insets. Do not add the sidebar shell here.
- **Online-only by design:** no Dexie, no service worker under `/mitarbeiter` (`public/sw.js` has an explicit bypass), no `next/image` — all three keep the future Capacitor wrapper simple.
- `npm test` (node:test via tsx) covers crypto/PIN/date logic; `npm run test:security` is a curl suite that must be re-run **after every migration**.

## Not yet built

CSV import for the `standorte` suggestion list (Admin) and the `/admin` area. Assistant answers in text only (no charts).

## Useful Claude Code skills for this project

| Skill | Why here | When |
|---|---|---|
| `/security-review` | Audits auth, RLS policies, API-key handling, offline data | Before go-live |
| `/code-review` | Bugs in the current diff (sync queue, assistant loop, RLS) | Now / before each merge |
| `/verify` | Drives a real flow (login → erfassen → sync → visible) | After each larger feature |
| `/init` | Regenerate this doc as the codebase grows | Periodically |
| `claude-api` | Reference for model IDs & tool-use (used for the Assistant) | When touching the Assistant |
