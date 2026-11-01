# Browser regression tests

Run from the frontend directory with Node 20.19+ and the Playwright Chromium browser:

```powershell
npx.cmd playwright install chromium
npm.cmd run test:e2e:public
npm.cmd run test:e2e:admin
npm.cmd run test:e2e
npm.cmd run test:e2e:report
```

Start the frontend separately at `http://127.0.0.1:5173` and its backend proxy at `http://127.0.0.1:8000`. On this restricted Windows environment, the working development command is `npm.cmd run dev -- --host 127.0.0.1 --configLoader native`.

Admin scenarios **must use a disposable backend**. From the backend directory run `.venv/Scripts/python.exe scripts/setup_e2e.py --serve`. The script copies/migrates backend `data/e2e.db`, uses a separate media directory, and creates a disposable administrator and runtime token. The original `data/predatory_beavers.db` must never be used for browser CRUD testing.

Credentials stay in the backend's gitignored `data/e2e-credentials.json` (or a path provided through `E2E_RUNTIME_FILE`). Required fields are `baseURL`, `frontendURL`, `databasePath`, `mediaPath`, `username`, `password`, `runtimeToken`. The tests refuse to mutate a non-local server or a database whose filename does not begin with `e2e` and end with `.db`. Before logging in, they verify the token-protected `/api/v1/health/e2e` marker through both the actual frontend proxy and the direct API, checking that the server confirms the exact disposable database/media paths. A normal backend cannot pass this guard. The frontend URL must agree with that local runtime; update the gitignored JSON's `frontendURL` when testing a preview server on a different port.

Optional environment variables:

- `E2E_BASE_URL`: local frontend URL; defaults to `http://127.0.0.1:5173`.
- `E2E_BROWSER_CHANNEL`: browser channel; defaults to bundled `chromium`. Set `msedge` to use installed Edge. On this laptop Edge sometimes stalled while creating a test page; the compatible bundled Chromium completed the suite.
- `E2E_RUNTIME_FILE`: local disposable-backend runtime JSON path.
- `API_PROXY_TARGET`: backend URL used by Vite dev/preview; defaults to `http://127.0.0.1:8000`. Set it before starting a separate preview so its proxy points to the disposable API instead of the working database.

For a production check on separate ports, build the site, start the isolated API, then start a preview:

```powershell
npm.cmd run build
$env:API_PROXY_TARGET='http://127.0.0.1:8013'
npm.cmd run preview -- --host 127.0.0.1 --port 4174 --strictPort
```

In another terminal, set `E2E_BASE_URL` to `http://127.0.0.1:4174` and `E2E_RUNTIME_FILE` to that API's generated runtime JSON. Its `frontendURL` must also be `http://127.0.0.1:4174`. Run `npm.cmd run test:e2e`; the runtime marker checks remain mandatory.

Reports and screenshots are written beneath gitignored `.data/`: `test-results`, `playwright-report`, `playwright-results.json`. Traces and videos are disabled because they could record login request bodies. No credentials or session state are stored in tracked files.

The suite checks desktop and mobile routes, overflow, browser runtime exceptions, keyboard/mobile navigation, failed-request recovery, stale response races, serious/critical WCAG 2 A/AA and 2.1 AA axe findings, authentication restoration/logout, real image uploads, media reference conflicts, player/competition/venue/match CRUD, match score validation, draft/public history and rules, text escaping, and unsaved-dialog confirmation. UI-created records are tracked and removed in reverse dependency order after each test. Public API readback checks verify that edits actually persisted; screenshots alone are insufficient.

`navigation.spec.ts` also checks that team choice follows roster → matches → standings, survives reload, respects an explicit shared URL, and updates the mobile team shortcut. It verifies the latest-result fallback when no upcoming match exists and the desktop header/achievement layout around 901–1150 px.

`match-dates.spec.ts` uses a fixed browser clock to distinguish future scheduled matches from past games awaiting an official result. Live games remain visible among upcoming games. Past scheduled records remain available through the status filter and never turn into a false empty state.

`match-outcomes.spec.ts` checks final outcomes in the schedule, the featured home card and recent results. Its explicit home/away fixtures cover wins, losses, a zero draw, zero scores, incomplete scores and unfinished games. The signed point difference always belongs to the club; displayed scores keep the original home/away order. It runs as part of `test:e2e:public`.

Axe excludes only Vite's injected `#__vue-devtools-container__`, which does not exist in the production build. No product components are excluded. Automated accessibility checks cover a subset of accessibility requirements and do not replace a screen reader review.
