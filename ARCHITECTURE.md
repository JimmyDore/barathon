# Barathon architecture

Reference for anyone building pages on top of the foundation. Product rules live in [SPEC.md](SPEC.md) (French, authoritative). The UI is in French and uses *tu*.

**Ground rules for feature work**

- Don't add npm dependencies. Everything the app needs is already installed (SvelteKit, better-sqlite3, maplibre-gl, fonts).
- Svelte 5 runes only: `$props`, `$state`, `$derived`, `$effect`, snippets, `onclick=`.
- Reuse what's below instead of re-implementing it (scoring, validation, DB access, geo, components, tokens).
- Treat foundation files as shared. If you need a change there, keep it small and additive (new export, new optional prop). Don't rename or reshape existing exports.
- Put page-specific components next to the route (`src/routes/foo/Thing.svelte`) or in `src/lib/components/` if two pages need them.
- Checks that must stay green: `npm run check` (0 errors), `npm test`, `npm run build`.

## Route plan

| URL | What | Main building blocks |
|---|---|---|
| `/` | Full-screen map (one colored pill per bar) + map ⇄ ranking toggle (`?vue=classement`), filters: terrace, ambiances, max pint price. Floating "Noter un bar" button. Centered on the user, else `GEO.defaultCenter`/`defaultZoom`. | `getStore().listBarSummaries()`, `MapView` (`locate`, `markers`, `onmarkerclick`), `ScoreBadge`, `AmbiancePicker` (as a filter, no `name`) |
| `/noter` | Step 1: pick the bar ("Autour de moi" 5 bars within 200 m, search with debounce, "Bar introuvable ?" manual pin with the 50 m duplicate warning). Step 2: the visit form. `?bar=<id>` skips step 1. On success: store token, remember pseudo, `PintCelebration`, then go to `/bars/<id>`. | `findNearby`, `findByName`, `optionToFormFields`, `MapView` (`bind:pin`), `/api/bars/nearby?radius=50`, `RatingInput`, `TerraceInput`, `MoodPicker`, `AmbiancePicker`, `Field`, `createVisitFromForm`, `saveVisitToken`, `savePseudo` |
| `/bars/[id]` | Bar page: name, address, block and overall scores, most cited ambiances, average pint price, terrace, visits (pseudo, date, visit score, mood, comment). "Noter ce bar" → `/noter?bar=<id>`. "Modifier" on visits this browser has a token for. | `getStore().getBarSummary(id)`, `listVisitsByBar(id)`, `ScoreBadge`, `.leader`, `getVisitToken` |
| `/passages/[id]/modifier` | Edit or delete a visit (author token or admin). Actions `?/update` and `?/delete`. | `getStore().getVisit(id)`, `visitToFormValues`, `updateVisitFromForm`, `deleteVisitFromForm`, `TOKEN_FIELD`, `getVisitToken`, `forgetVisitToken` |
| `/barathoniens` | Ranking of people: distinct bars, then visits. | `getStore().listPeople()` |
| `/barathoniens/[key]` | One person's visits. `key` = `encodeURIComponent(person.key)`. | `getStore().getPerson(key)`, `listVisitsByPerson(key)` |
| `/admin` | Password login (`?/login`), logout (`?/logout`), list of bars and recent visits, edit/delete any visit (link to `/passages/[id]/modifier`). | `loginAdmin`, `logoutAdmin`, `adminLoginLimiter`, `requireAdmin`, `listBarSummaries`, `listRecentVisits` |
| `/admin/bars/[id]` | Rename, move (pin on a map), delete, merge A into B. | `requireAdmin`, `renameBar`, `moveBar`, `deleteBar`, `mergeBars`, `barsNearby` (merge candidates), `MapView` |
| `/health` | `200 {"ok":true}` (exists). | |
| `/api/bars/nearby`, `/api/bars/search` | Our bars as JSON (exist, see below). | |
| `/dev/components` | Component showcase, dev only (404 in prod). | |

`src/routes/+page.svelte` is a placeholder: the home page owner replaces it.

## File map

```
src/
  app.html              lang=fr, noindex meta, theme-color, favicon
  app.css               design tokens + base styles + utilities (see "Design system")
  app.d.ts              App.Locals { admin: boolean }
  fonts.d.ts            lets TS accept `import '@fontsource/…/700'`
  hooks.server.ts       init: checks ADMIN_PASSWORD + opens/migrates DB; handle: locals.admin, X-Robots-Tag
  lib/
    constants.ts        criteria, blocks, ambiances, moods, categories, limits, GEO, RATE_LIMITS
    scoring.ts          pure scoring (SPEC "Calcul des notes")
    validation.ts       visit form + bar choice parsing (FormData or plain object), French errors
    pseudo.ts           pseudo grouping key, display spelling
    text.ts             foldText (lowercase, no accents)
    dates.ts            todayInParis, isIsoDate
    format.ts           French formatting + score colors
    stats.ts            bar summary, people ranking (pure)
    types.ts            Bar, Visit, BarSummary, Person… (shared server/client)
    geo/
      distance.ts       haversine
      provider.ts       THE search provider (Photon). Only file to rewrite to switch provider
      merge.ts          merge provider places with our bars
    client/             browser-only helpers
      storage.ts        localStorage: pseudo + author tokens
      map.ts            MapLibre loader, OpenFreeMap styles (slate restyle)
      places.ts         findNearby / findByName (provider + our API, merged)
    server/             server-only
      config.ts         DATA_DIR, db path, ADMIN_PASSWORD
      db.ts             schema, migrations, data-access layer (Store)
      tokens.ts         author tokens (generate, hash, verify)
      ratelimit.ts      in-memory sliding-window limiter
      limiters.ts       shared limiter instances + clientKey(event)
      admin.ts          signed admin cookie, login/logout, requireAdmin
      visit-actions.ts  create/update/delete visit from a form (honeypot, rate limit, validation, auth)
      api.ts            JSON shape of /api/bars/*
    components/         shared Svelte components (see below)
  routes/
    +layout.svelte      fonts, header (wordmark → /, Barathoniens, Noter), footer (admin link)
    +page.svelte        placeholder home
    health/+server.ts
    api/bars/nearby/+server.ts
    api/bars/search/+server.ts
    dev/components/     showcase (dev only)
scripts/backup.mjs      consistent DB snapshot: node scripts/backup.mjs <dest>
static/robots.txt       Disallow: /
```

## Data model

SQLite file `${DATA_DIR}/barathon.db` (default `./data`), WAL, `foreign_keys = ON`. Migrations are the `MIGRATIONS` array in `src/lib/server/db.ts`; the version is `PRAGMA user_version`. To change the schema, **append** a migration, never edit an existing one.

```sql
CREATE TABLE bars (
  id          INTEGER PRIMARY KEY,
  name        TEXT NOT NULL,
  address     TEXT,
  lat         REAL NOT NULL,
  lon         REAL NOT NULL,
  source      TEXT NOT NULL CHECK (source IN ('osm','manual')),
  source_id   TEXT,              -- 'node/123', 'way/456', 'relation/789'; NULL for manual bars
  category    TEXT,              -- bar | pub | cafe | biergarten | nightclub | restaurant | NULL
  created_at  TEXT NOT NULL      -- ISO UTC
);
CREATE UNIQUE INDEX bars_source_uid ON bars (source, source_id) WHERE source_id IS NOT NULL;

CREATE TABLE visits (             -- one visit = one person, one bar, one date
  id               INTEGER PRIMARY KEY,
  bar_id           INTEGER NOT NULL REFERENCES bars(id) ON DELETE CASCADE,
  pseudo           TEXT NOT NULL,  -- as typed (trimmed)
  pseudo_key       TEXT NOT NULL,  -- pseudoKey(pseudo): grouping key
  visit_date       TEXT NOT NULL,  -- YYYY-MM-DD, Europe/Paris
  beaute, emplacement            INTEGER 1–5 | NULL,
  terrasse                       INTEGER 0–5 | NULL,  -- 0 = "pas de terrasse"
  choix_bieres, qualite_biere    INTEGER 1–5 | NULL,
  soiree                         INTEGER 1–5 NOT NULL,
  ambiances        TEXT NOT NULL DEFAULT '[]',  -- JSON array of slugs
  humeur           INTEGER 1–5 | NULL,          -- never used in scores
  prix_pinte_cents INTEGER | NULL,
  commentaire      TEXT | NULL,                  -- ≤ 280 chars
  token_hash       TEXT NOT NULL,                -- SHA-256 of the author token
  created_at       TEXT NOT NULL,
  updated_at       TEXT
);
```

No IP address is ever stored. The plain author token never touches the DB.

In TypeScript, rows come out camelCased (`Bar`, `Visit` in `src/lib/types.ts`). `Visit` extends `VisitInput` (`pseudo, date, beaute, emplacement, terrasse, choixBieres, qualiteBiere, soiree, ambiances, humeur, prixCents, commentaire`) plus `id, barId, pseudoKey, createdAt, updatedAt, score` (score of that visit alone). The token hash is never exposed.

## Server API (`$lib/server/*`)

### `db.ts`: `getStore()` and the `Store`

`getStore(): Store`: app singleton (opens + migrates on first call). Tests: `createStore(openDatabase(':memory:'))`.

Also exported: `openDatabase(file): DB`, `migrate(db): number`, `MIGRATIONS`, `closeStore()`, types `DB`, `Store`, `VisitAuth`, `VisitAccess`, `NewBar`, `CreateVisitResult`, `UpdateVisitResult`, `DeleteVisitResult`, `MergeBarsResult`.

`VisitAuth = { admin: true } | { token: string | null | undefined }`

| Method | Returns | Purpose |
|---|---|---|
| `getBar(id)` | `Bar \| null` | One bar, no aggregates |
| `getBarSummary(id)` | `BarSummary \| null` | Bar + scores, terrace, ambiances, avg price, counts |
| `listBarSummaries()` | `BarSummary[]` | All bars with aggregates, best score first (unrated last) |
| `barsNearby(lat, lon, radiusM)` | `BarNearby[]` | Our bars within radius, closest first (`distance` in m) |
| `findBarBySourceId(sourceId)` | `Bar \| null` | OSM bar already in DB |
| `getBarSummariesBySourceIds(ids)` | `BarSummary[]` | Our bars matching provider results |
| `searchBars(query, limit = 10)` | `BarSummary[]` | Name/address contains query, case- and accent-insensitive |
| `createBar(place: NewBar)` | `Bar` | Create an osm/manual bar; an OSM bar already known is returned as is |
| `resolveBar(choice: BarChoice)` | `Bar \| null` | Existing id → bar; osm/manual → find or create |
| `renameBar(id, name, address?)` | `Bar \| null` | Rename (address unchanged when omitted, `null` clears it) |
| `moveBar(id, lat, lon)` | `Bar \| null` | Move |
| `deleteBar(id)` | `boolean` | Delete bar and its visits |
| `mergeBars(fromId, intoId)` | `MergeBarsResult` | Visits of A move to B, A deleted; B inherits A's OSM id if it had none |
| `createVisit(choice, input)` | `CreateVisitResult` | `{ ok, visit, bar, token }` (plain token, return it to the browser once) or `{ ok: false, reason: 'bar_not_found' }` |
| `getVisit(id)` | `Visit \| null` | One visit |
| `checkVisitAccess(id, auth)` | `'ok' \| 'not_found' \| 'forbidden'` | Can this token/admin edit it? |
| `updateVisit(id, input, auth)` | `UpdateVisitResult` | Replace the visit fields |
| `deleteVisit(id, auth)` | `DeleteVisitResult` | `{ ok, barId, barDeleted }`: a bar left with no visit is deleted too |
| `listVisitsByBar(barId)` | `Visit[]` | Newest first |
| `listVisitsByPerson(key)` | `VisitWithBar[]` | Newest first, with `barName` |
| `listRecentVisits(limit = 50)` | `VisitWithBar[]` | Latest created (admin) |
| `listPeople()` | `Person[]` | Ranking: distinct bars desc, then visits desc |
| `getPerson(key)` | `Person \| null` | One person (`key` = `pseudoKey`) |

### `visit-actions.ts`: form actions in one call

- `createVisitFromForm(form: FormSource, ctx: { ip: string; store?; limiter?; today? }): CreateVisitOutcome`: honeypot (fake success with `discarded: true`, nothing stored), rate limit 20 / 10 min / IP (`429`), bar choice + visit validation (`400`), unknown bar (`404`). Success: `{ ok: true, visitId, barId, token, score }`.
- `updateVisitFromForm(visitId, form, { admin: boolean }): { ok: true, visitId, barId, score } | Failure`: author token read from the `token` field (`TOKEN_FIELD`) unless admin.
- `deleteVisitFromForm(visitId, form, { admin }): { ok: true, barId, barDeleted } | Failure`.
- `Failure = { ok: false; status: 400 | 403 | 404 | 429; errors: FieldErrors }`. `errors.form` holds the message that isn't tied to a field.

```ts
// src/routes/noter/+page.server.ts
import { fail } from '@sveltejs/kit';
import { clientKey } from '$lib/server/limiters';
import { createVisitFromForm } from '$lib/server/visit-actions';

export const actions = {
	default: async (event) => {
		const out = createVisitFromForm(await event.request.formData(), { ip: clientKey(event) });
		if (!out.ok) return fail(out.status, { errors: out.errors });
		return out;
	}
};
```

### Others

- `tokens.ts`: `generateToken(): { token, hash }`, `hashToken(token): string`, `verifyToken(token, hash): boolean` (constant time).
- `ratelimit.ts`: `createRateLimiter({ limit, windowMs }): RateLimiter` with `hit(key, now?) → { ok, remaining, retryAfterMs }`, `reset(key?)`, `size()`.
- `limiters.ts`: `visitCreateLimiter` (20 / 10 min), `adminLoginLimiter` (10 / 10 min), `clientKey(event): string` (IP from `getClientAddress()`, `'unknown'` on failure; never store it).
- `admin.ts`: `ADMIN_COOKIE` (`barathon_admin`), `isAdmin(cookies)`, `loginAdmin(cookies, password): boolean` (sets the httpOnly, sameSite=lax, 30-day signed cookie), `logoutAdmin(cookies)`, `requireAdmin(locals)` (throws 403), `signSession`, `verifySession`, `checkPassword`. `locals.admin` is already set by `hooks.server.ts` on every request.
- `config.ts`: `dataDir()`, `dbPath()`, `adminPassword()` (throws in prod if missing, `'dev'` in dev).
- `api.ts`: `toApiBar(summary): ApiBar` (fields of `OwnBarLike` + optional `distance`).

```ts
// admin login action
login: async (event) => {
	if (!adminLoginLimiter.hit(clientKey(event)).ok) return fail(429, { error: 'Trop d’essais, attends un peu.' });
	const data = await event.request.formData();
	if (!loginAdmin(event.cookies, String(data.get('password') ?? ''))) return fail(401, { error: 'Mauvais mot de passe.' });
	redirect(303, '/admin');
}
```

### JSON routes (exist)

- `GET /api/bars/nearby?lat=&lon=&radius=` → `{ bars: ApiBar[] }`, radius in m (10–5000, default 200), closest first, each with `distance`. Use `radius=50` for the "Il y a déjà X à 30 m, c'est pas celui-là ?" check before creating a manual bar.
- `GET /api/bars/search?q=&source_ids=node/1,way/2` → `{ bars: ApiBar[] }`: text matches (max 8) + bars matching those OSM ids.

## Shared modules (client + server)

**`constants.ts`**: `CRITERIA` (`{ key, field, label, block, required }` ×6; `field` is the HTML name), `BLOCKS` (`lieu`, `biere`, `moment` with their criteria), `TERRASSE_NONE = 0`, `TERRASSE_NONE_FORM_VALUE = 'none'`, `RATING_WORDS` (`['', 'bof', 'moyen', 'correct', 'bien', 'top']`), `AMBIANCES` (`{ slug, label }` ×9), `AMBIANCE_SLUGS`, `ambianceLabel(slug)`, `MOODS` (`{ value, emoji, label }` ×5), `moodEmoji(value)`, `PLACE_CATEGORIES`, `PLACE_CATEGORY_LABELS`, `LIMITS` (pseudo 40, comment 280, bar name 80, price 50–5000 cents), `GEO` (`nearbyRadiusM` 200, `nearbyLimit` 5, `duplicateRadiusM` 50, `defaultCenter` {46.95, -1.5}, `defaultZoom` 9), `RATE_LIMITS`, `TIMEZONE`.

**`scoring.ts`** (pure): `scoreVisits(ratings[]): Score` (bar), `scoreVisit(ratings): Score` (one visit), `terraceStatus(values): 'oui' | 'non' | null` (majority of visits that filled it; tie → oui), `criterionAverages`, `blockAverages`, `overallScore`, `mean`, `isCountedRating`, `roundScore`. `Score = { criteria, blocks: { lieu, biere, moment }, overall }`, all `number | null`. Mood is not part of `Ratings`; `terrasse = 0` is ignored.

**`stats.ts`** (pure): `summarizeVisits(visits): BarStats`, `ratingsOf(visit): Ratings`, `compareBarsByScore(a, b)`, `rankPeople(visits): Person[]`.

**`validation.ts`**:
- `parseVisitForm(src: FormData | URLSearchParams | object, { today }): { ok: true, value: VisitInput } | { ok: false, errors: FieldErrors }`. Empty date → today. Ratings `''` → null.
- `parseBarChoice(src): { ok: true, value: BarChoice } | { ok: false, error }`. `BarChoice = { kind: 'existing', barId } | { kind: 'osm', sourceId, category, name, address, lat, lon } | { kind: 'manual', name, address, lat, lon }`.
- `visitToFormValues(visit): Record<field, string | string[]>` to prefill an edit form.
- `VISIT_FIELDS` / `BAR_FIELDS` (HTML field names), `HONEYPOT_FIELD = 'site_web'`, `isHoneypotFilled`, `parseRating`, `parsePriceCents`, `parseBarName`, `parseAddress`, `parseCoordinates`, `getField`, `getFieldAll`.

Visit form field names: `pseudo`, `date`, `beaute`, `emplacement`, `terrasse` (`none` or 1–5), `choix_bieres`, `qualite_biere`, `soiree`, `ambiances` (repeated), `humeur`, `prix` (`"6,50"`), `commentaire`, `site_web` (honeypot). Bar fields: `bar_id`, or `source` + `source_id` + `name` + `address` + `lat` + `lon` + `category`.

**`pseudo.ts`**: `pseudoKey(s)` (trim, collapse spaces, lowercase, strip accents), `cleanPseudo(s)`, `displayPseudo(spellings)`. **`text.ts`**: `foldText(s)`.

**`dates.ts`**: `todayInParis(now?)` → `YYYY-MM-DD`, `isIsoDate(s)`.

**`format.ts`**: `formatScore(4.25) → '4,3'` (`'–'` for null), `formatPrice(650) → '6,50 €'`, `priceToInput(650) → '6,50'`, `formatDate('2026-09-12') → '12 sept. 2026'`, `formatDistance(42) → '40 m'`, `plural(n, 'passage')`, `scoreColor(score) → { bg, fg }` (brick → amber → blonde ramp, readable ink).

**`types.ts`**: `Bar`, `Visit`, `VisitWithBar`, `BarStats`, `BarSummary`, `BarNearby`, `AmbianceCount`, `Person`, `BarSource`.

### Geo (`$lib/geo/*`)

`provider.ts` is the only provider-specific file (Photon today). Works in the browser (Photon sends CORS `*`) and on the server.

- `search(query, { lat?, lon?, limit = 8, signal?, timeoutMs = 6000, fetch? }): Promise<Place[]>`: amenity bar/pub/cafe/biergarten/nightclub/restaurant, biased around lat/lon, re-ranked by distance band (<5 km, <50 km, rest). Queries under 2 chars return `[]` without a request.
- `nearby({ lat, lon }, radiusM = 200, { limit = 20, signal?, timeoutMs?, fetch? }): Promise<Place[]>`: Photon `/reverse` with `radius`, closest first. Photon was chosen over Overpass: measured around Nantes, Photon answered in 1–2 s every time while the public Overpass instance returned 429/504/timeouts on 3 of 4 requests.
- Errors: `ProviderError` with `kind: 'network' | 'timeout' | 'http' | 'aborted'` (ignore `aborted`: that's your own AbortController).
- `Place = { sourceId, name, address, lat, lon, category, distance }`. Also `haversine(a, b)` (m), `LatLon`, `parsePhotonFeature`, `rankByProximity`, `PROVIDER_NAME`.

`merge.ts`: `PlaceOption = { key, barId, source, sourceId, name, address, lat, lon, category, distance, overall, visitCount }` (`barId` null = not in our DB yet). `mergeNearby(places, ours, origin, { radiusM, limit })` (dedupe by `sourceId`, our bar wins, sort by distance, keep 5), `mergeSearch(places, ours, origin, limit)` (our text matches first, provider results with our bars substituted), `optionToFormFields(option)` (hidden fields for the visit form), `barToOption`, `placeToOption`.

## Browser helpers (`$lib/client/*`)

- `places.ts`: `findNearby(origin, { radiusM?, limit?, signal? }): Promise<{ options, providerError }>` and `findByName(query, origin | null, { limit?, signal? })`. Both call Photon and `/api/bars/*` and merge. If Photon fails you still get our bars and `providerError: true`: show "La recherche ne répond pas…" and keep the manual option. Debounce search input (~300 ms) and abort the previous request.
- `storage.ts`: every access is wrapped in try/catch.
  - `barathon.pseudo`: `getSavedPseudo()`, `savePseudo(p)`.
  - `barathon.tokens`: JSON `{ "<visitId>": "<token>" }`: `saveVisitToken(visitId, token)` right after creation, `getVisitToken(visitId)`, `getVisitTokens()`, `forgetVisitToken(visitId)` after deletion.
  - Read these in `onMount`/`$effect` (not during SSR): the server can't see localStorage.
- `map.ts`: `loadMaplibre()`, `loadMapStyle(theme)`, `currentTheme()`, `DARK_STYLE_URL` (`https://tiles.openfreemap.org/styles/dark`, restyled to slate by `slateStyle`), `LIGHT_STYLE_URL` (`…/positron`). `MapView` already uses them.

## Forms, CSRF, tokens

- SvelteKit rejects cross-origin form POSTs. In prod `ORIGIN=https://barathon.jimmydore.fr`. With `node build` locally, set `ORIGIN=http://localhost:3000`. With curl, send `-H "Origin: http://localhost:3000"` (plus `-H "Accept: application/json" -H "x-sveltekit-action: true"` to get JSON back from a form action, like `use:enhance` does).
- Use form actions with `use:enhance` and a custom callback: on `failure` show `result.data.errors` (field errors next to fields, `errors.form` at the top) and don't reset the form; on `success` read `result.data`.
- The create form must include the honeypot, hidden off-screen:
  `<div class="honeypot" aria-hidden="true"><label>Ne pas remplir <input name="site_web" tabindex="-1" autocomplete="off" /></label></div>`
- The create action returns the author token once. The page stores it with `saveVisitToken(visitId, token)`. Edit/delete forms send it back in a hidden `token` input (`TOKEN_FIELD`), filled from `getVisitToken(id)` after mount. Admins (`locals.admin`) don't need it.
- Rate limiting and admin checks happen server-side only (`clientKey(event)`, `requireAdmin(locals)`).

## Components (`$lib/components/*`)

All are mobile-first, keyboard-accessible, and themed by the tokens.

| Component | Props | Notes |
|---|---|---|
| `Button` | `variant?: 'primary' \| 'secondary' \| 'ghost' \| 'danger'`, `size?: 'md' \| 'lg'`, `full?`, `busy?`, `href?`, any button/anchor attribute, children | `<a>` when `href` is set. Default HTML type is submit inside a form: pass `type="button"` otherwise. `primary` (amber) = the one main action of a screen. |
| `Card` | `as?` (element, default `section`), `tone?: 'raised' \| 'outline' \| 'sunk'`, `padded?`, `class?`, children | For a group of info that belongs together, not for every list row. |
| `Field` | `id`, `label`, `hint?`, `error?`, `required?`, children | Label + control + hint + error. Give your input the same `id`. |
| `ScoreBadge` | `score: number \| null`, `variant?: 'pill' \| 'numeral'`, `size?: 'sm' \| 'md' \| 'lg'`, `outOf?` | Pill colored by score, or big condensed numeral for the bar page header. |
| `RatingInput` | `name`, `label`, `bind:value` (`number \| null`), `required?`, `hint?`, `error?`, `noneLabel?`, `onchange?` | Five big cells that fill like a pint. Tap the selected cell again (or "effacer") → null ("pas testé"). Native radios: submits `name=1..5`, nothing when null. |
| `TerraceInput` | `bind:value` (`null \| 0 \| 1..5`), `name?='terrasse'`, `label?`, `error?`, `onchange?` | Adds a "Pas de terrasse" chip (value 0, submitted as `none`). |
| `MoodPicker` | `bind:value`, `name?='humeur'`, `label?='Mon humeur'`, `error?`, `onchange?` | 😫 😕 😐 🙂 🤩, clearable. |
| `AmbiancePicker` | `bind:value` (`string[]` of slugs), `name?='ambiances'`, `label?`, `error?`, `onchange?` | Chips. Pass `name=""` to use it as a filter without submitting. |
| `MapView` | `center?`, `zoom?`, `markers?: MapMarker[]`, `selectedId?`, `onmarkerclick?`, `bind:pin?` (`LatLon \| null`), `pinDraggable?`, `onpinchange?`, `locate?`, `onlocate?`, `onlocateerror?`, `onmapclick?`, `onmoveend?`, `onready?`, `label?`, `class?` | Needs a sized parent. `MapMarker = { id, lat, lon, score?, title? }`. Methods via `bind:this`: `flyTo(pos, zoom?)`, `fitTo(points, maxZoom?)`, `getCenter()`, `locateMe()`. `locate` adds the geolocate button and centers on the user at load (falls back to `center` if refused). OSM attribution is always visible. Follows light/dark automatically. |
| `PintCelebration` | `open`, `score?`, `title?='Santé !'`, `message?`, `ondone?`, children (actions) | Full-screen pint-filling animation (~1.6 s, instant with reduced motion), then `ondone()`. |

## Design system

Direction: "ardoise de bistrot". Blue-green slate (not black) with chalk text; beer amber is reserved for actions and scores; foam cream for highlights. Light theme follows `prefers-color-scheme` automatically (all tokens are redefined, so use tokens, never raw colors). Works from 360 px wide with no horizontal scroll.

Typography: **Big Shoulders Display** (`--font-display`, weights 700/800/900) for the wordmark, headings and score numerals; **Atkinson Hyperlegible** (`--font-body`, 400/400 italic/700) for everything else. Sentence case everywhere, no all-caps labels.

Tokens (`src/app.css`):

- Colors: `--bg`, `--bg-raised`, `--bg-sunk`, `--line`, `--line-strong`, `--ink`, `--ink-dim`, `--ink-faint`, `--accent`, `--accent-strong`, `--accent-ink` (text on amber), `--accent-text` (amber as text color), `--accent-soft`, `--foam`, `--danger`, `--danger-soft`, `--success`, `--focus`, `--overlay`, `--shadow`.
- Type scale: `--text-xs` 13, `--text-sm` 15, `--text-md` 17 (body), `--text-lg` 20, `--display-sm` 26, `--display-md` 36, `--display-lg` 52, `--display-xl` 80 (px).
- Spacing: `--space-1` … `--space-7` (4, 8, 12, 16, 24, 32, 48 px).
- Radii: `--radius-s` 6, `--radius-m` 10, `--radius-l` 16, `--radius-pill`.
- Touch: `--tap` 48 px minimum for anything tappable, `--tap-lg` 56 px for main buttons and rating cells.
- Layout: `--content-max` 40rem, `--gutter` 16 px, `--header-h` 56 px.
- Motion: `--ease-out`, `--ease-pour`. Reduced motion is handled globally.

Utility classes: `.container` (centered column + 16 px gutter; pages wrap their content in it), `.stack` (vertical flex, gap `--stack-gap`), `.visually-hidden`, `.honeypot`, `.muted`, `.field-error`, `.leader` (menu-board line: `<div class="leader"><span>Beauté</span><span>4,2</span></div>` draws dotted leaders between label and value). Base styles already cover inputs, textareas, selects, headings, links and focus rings.

Layout: the sticky header is `--header-h` tall (plus the iOS safe area). `<main>` has no padding. On `/` the footer is hidden so the map can fill the screen: give it `height: calc(100dvh - var(--header-h) - env(safe-area-inset-top))`. Put floating buttons above `env(safe-area-inset-bottom)`.

Copy: French, *tu*, plain and short. Buttons say what they do ("Enregistrer mon passage", "Noter ce bar"). Errors say what to fix.

## Deployment contract (for reference)

`npm ci && npm run build` → `build/`; `node build` starts the server. Runtime image layout: `/app/package.json`, `/app/node_modules` (prod deps, incl. `better-sqlite3` with its prebuilt linux/musl binaries), `/app/build`, `/app/scripts/backup.mjs`. Env: `PORT`, `HOST`, `ORIGIN`, `DATA_DIR=/data`, `ADMIN_PASSWORD` (required), `ADDRESS_HEADER=X-Forwarded-For`, `XFF_DEPTH=1`, `TZ=Europe/Paris`. Backup: `docker exec barathon-web node scripts/backup.mjs /data/snapshot.db`. Details in `deploy/README.md`.
