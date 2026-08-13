# Progress Log

## 2026-08-13

- Added a curriculum tab as a separate page (`/curriculum`), linked from the main conversation page via "View curriculum".
- Transcribed the full Spanish curriculum (Units 0-4) from `docs/curriculum.md` into structured data at `src/data/curriculum.js` — vocabulary groups, grammar topics, and phrases/topics, all organized by unit.
- Built `src/pages/CurriculumPage.jsx` to render vocabulary, then grammar, then phrases/topics for each unit as clickable chips.
- Added click-to-track progress: clicking a word/topic cycles it through untouched -> yellow ("working on") -> green ("mastered") -> untouched. Implemented in `src/hooks/useProgress.js`, persisted to `localStorage` so it survives page reloads.
- Installed `react-router-dom` and set up routing in `src/main.jsx` (`/` -> conversation page, `/curriculum` -> curriculum page).
- Added theme-aware yellow/green status colors (light + dark mode) to `src/index.css`.
- Verified with `eslint` and a production `vite build`; both passed cleanly.
