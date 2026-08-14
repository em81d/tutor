# Progress Log

## 2026-08-13

- Added a curriculum tab as a separate page (`/curriculum`), linked from the main conversation page via "View curriculum".
- Transcribed the full Spanish curriculum (Units 0-4) from `docs/curriculum.md` into structured data at `src/data/curriculum.js` — vocabulary groups, grammar topics, and phrases/topics, all organized by unit.
- Built `src/pages/CurriculumPage.jsx` to render vocabulary, then grammar, then phrases/topics for each unit as clickable chips.
- Added click-to-track progress: clicking a word/topic cycles it through untouched -> yellow ("working on") -> green ("mastered") -> untouched. Implemented in `src/hooks/useProgress.js`, persisted to `localStorage` so it survives page reloads.
- Installed `react-router-dom` and set up routing in `src/main.jsx` (`/` -> conversation page, `/curriculum` -> curriculum page).
- Added theme-aware yellow/green status colors (light + dark mode) to `src/index.css`.
- Verified with `eslint` and a production `vite build`; both passed cleanly.

### Supabase-backed progress with named profiles

- Set up a Supabase project schema (`supabase/schema.sql`): `users` (id, name) and `progress` (user_id, item_id, status, updated_at) tables, RLS enabled with permissive anon-key policies (no auth — personal/family use only).
- Added `src/lib/supabaseClient.js` using the public anon key via `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` (see root `.env.example`).
- Added a "Who's learning?" name-entry gate (`src/components/NameGate.jsx`) backed by `src/context/UserContext.js` + `UserProvider.jsx` + `src/hooks/useUser.js` — looks up or creates a `users` row by name, remembers the current profile in `localStorage`, and shows a "Switch user" control once signed in.
- Rewired `src/hooks/useProgress.js` to read/write the `progress` table instead of `localStorage`, scoped to the current user's id, so each named profile has its own vocab/grammar/phrase progress.
- Wrapped the app in `UserProvider` + `NameGate` in `main.jsx` so no page is reachable without picking a name first.

### Migrated styling to Tailwind CSS

- Installed `tailwindcss` + `@tailwindcss/vite` and wired the plugin into `vite.config.js`.
- Rebuilt `src/index.css` around Tailwind: kept the existing light/dark CSS variables (`--bg`, `--text`, `--accent`, `--learning-*`, `--mastered-*`, etc.) and mapped them into Tailwind's `@theme` (e.g. `--color-accent: var(--accent)`), so utilities like `bg-accent`/`text-text-h`/`border-border` still swap automatically between light and dark mode.
- Converted every component (`App.jsx`, `CurriculumPage.jsx`, `NameGate.jsx`) to inline Tailwind utility classes and deleted the old stylesheets (`App.css`, `CurriculumPage.css`, `NameGate.css`).
- Moved `#root`'s page-shell layout (centered, max-width, bordered, full-height column) onto the root `<div>` in `index.html`, since it sits outside the React tree.
- Verified with `eslint` and a production `vite build`; both passed cleanly.
