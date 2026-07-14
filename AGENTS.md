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
- **UI.** shadcn/ui on **base-ui** (not Radix): use the `render` prop, **not** `asChild`. Route group `(app)` is the authenticated shell; `/login` and `/offline` sit outside it. [ActivityForm](src/components/activity-form.tsx) is shared by create and edit.

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
