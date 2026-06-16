# Repo Search

Search public GitHub repositories and open any result for its details. The app
talks directly to the GitHub REST API from the browser — there is no backend.

Most of the work here is in handling the API's realities rather than the happy
path: request debouncing and cancellation, the 1000-result search ceiling, and
explicit loading / empty / error / rate-limit states on every screen.

## Token (optional)

It runs fine unauthenticated. GitHub's unauthenticated limits are low though
(search is 10 requests/min), so to raise them, copy `.env.example` to `.env` and
add a `VITE_GITHUB_TOKEN` — a fine-grained token with public read-only access is
enough.

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
