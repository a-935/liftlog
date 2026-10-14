# LiftLog

A mobile-first gym workout tracker. It's an installable PWA that works fully offline and keeps every
workout on your phone (IndexedDB).

React + Vite + TypeScript · vite-plugin-pwa · Dexie · Recharts · SheetJS

---

## Put it on your iPhone

### 1. Deploy it (free, GitHub Pages) — one time

1. Sign in at [github.com](https://github.com) (or create a free account).
2. Click **+ → New repository**. Name it `liftlog`, keep it **Public**, don't add a README, and click **Create repository**.
3. In a terminal in this folder, run the two commands GitHub shows under "…push an existing repository"
   (replace `YOUR-USERNAME`):

   ```bash
   git remote add origin https://github.com/YOUR-USERNAME/liftlog.git
   git push -u origin main
   ```

   A browser window opens the first time so you can sign in to GitHub.
4. On GitHub, open the repo, then **Settings → Pages**. Under **Build and deployment → Source**, choose **GitHub Actions**.
5. Open the **Actions** tab. When "Deploy to GitHub Pages" shows a green tick (about 1 minute), your app is live at
   **`https://YOUR-USERNAME.github.io/liftlog/`**

If the first run happened before step 4 and failed, open it in **Actions** and click **Re-run all jobs**.

### 2. Add it to your Home Screen

1. On your iPhone, open **Safari** and go to `https://YOUR-USERNAME.github.io/liftlog/`.
2. Tap the **Share** button (square with an arrow), scroll down, tap **Add to Home Screen**, then **Add**.
3. Open **LiftLog** from the Home Screen icon (not from Safari). It runs full screen and works offline from now on.

> Your data lives in the Home Screen app's own storage, separate from Safari tabs. Use
> **Settings → Backup** now and then, and save the file to iCloud Drive / Files.

### Updating the app later

Commit and `git push` — GitHub rebuilds automatically. The app downloads the new version in the
background and uses it the next time you open it (it never reloads mid-workout).

---

## Develop

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production build into dist/
npm run preview    # serve dist/ (service worker active → test offline here)
npm run icons      # regenerate icons + iOS launch screens (scripts/make-icons.mjs)
```

## Project layout

```
src/
  db/
    schema.ts     Dexie database + record types (exercises, workouts, workoutExercises, sets, settings)
    seed.ts       Built-in exercise library (stable ids)
    queries.ts    Read helpers (used with useLiveQuery)
    repo.ts       All writes – the single place a sync layer would hook into
  lib/            Pure logic & device helpers: PR rules, stats, dates, Excel export, backup,
                  haptics (iOS switch trick), sound, file saving
  ui/             Shared components: Sheet, toasts/confirm, NumberField, TopBar, TabBar, icons
  features/       One folder per area: home, workout, exercises, history, progress, settings
  router.ts       Tiny hash router (works on any static host)
```

### Rules worth knowing

- **PR**: heaviest weight ever for that exercise, or more reps than ever at that same weight;
  bodyweight (0 kg) = most reps ever. An exercise's very first session is the baseline (no PR).
- **A set counts** when it's ticked and has reps. On "Save workout", unticked sets and
  exercises with no logged sets are dropped (the summary offers to count filled-in sets as done).
- **Rest stopwatch** stores its start timestamp on the workout, so it's correct after the phone
  locks or the app is closed. Stopping it (or ticking the next set) saves the time on the
  last ticked set.
- **Removing an exercise** only archives it (hidden from lists); its history and charts stay.

### Adding cloud sync later

Every record has a string `id` (UUID) and `updatedAt`, and every write goes through
`src/db/repo.ts`. A sync adapter (e.g. Supabase) can push changed rows after each repo call and
pull remote rows into Dexie. Deletes would need tombstones (e.g. a `deletedAt` field) instead of
hard deletes.
