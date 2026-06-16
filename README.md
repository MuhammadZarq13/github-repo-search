# Repo Search

Search public GitHub repositories and open any result for its details. The app
talks directly to the GitHub REST API from the browser — there is no backend.

**Live:** https://github-repo-search-0.netlify.app

Most of the work is in handling the API's realities rather than the happy path:
debounced and cancellable requests, the 1000-result search ceiling, deeply nested
data, and explicit loading / empty / error / rate-limit states on every screen.

## Project structure

```
src/
  services/     # the only place fetch() lives: typed GitHub client + error model
  composables/  # search & detail state machines (debounce, abort, pagination)
  components/   # presentational pieces (RepoCard, StatePanel)
  views/        # SearchView, DetailView
  utils/        # pure helpers (formatting, error -> state mapping)
  types/        # domain + async-state types
```

Components stay presentational; fetching and logic live in composables; the UI
depends on a typed `GithubClient` interface rather than on `fetch` directly —
which is what makes it easy to test (the client is mocked, never the network).

## Key Behaviors 

- **Token is optional.** It runs unauthenticated, but GitHub's limits are low
  (search is 10 requests/min). To raise them, copy `.env.example` to `.env` and
  set `VITE_GITHUB_TOKEN` — a fine-grained token with public read-only access.
- **Rate limits are surfaced honestly.** Both the primary limit and the
  secondary (abuse) limit map to a clear "try again at …" state, never a silent
  failure or an endless spinner.
- **Async state is a discriminated union**, so every screen renders an explicit
  branch for idle / loading / empty / error / rate-limited.
- **Search state lives in the URL.** The query and page are in the address bar,
  so results are shareable and survive a refresh.
- **Tests** (Vitest + @vue/test-utils) focus on what breaks UX — debounce, abort,
  rate-limit, pagination, and each state's rendering.

## Scripts

```bash
npm install
npm run dev        # start the dev server
npm run test       # unit + component tests
npm run typecheck  # vue-tsc, strict
npm run build      # typecheck + production build
```

Built with Vue 3 (`<script setup>`), TypeScript (strict), Vuetify, and Vite.

## Deploying on Netlify

The app is a static SPA, so Netlify only needs to build `dist/` and serve
client-side routes through `index.html`. The included `netlify.toml` handles
both the build output and the SPA redirect.
