# Repository Guidelines

## Project Overview

This is Lawrence's personal portfolio and blog (AP/A-Level math and physics educator), built with Astro 5, Tailwind CSS, and DaisyUI, and deployed to GitHub Pages.

## Project Structure & Module Organization

- `src/pages/` — Astro route components, including dynamic routes like `blog/[slug].astro`.
- `src/components/` — reusable UI components (e.g., `Header.astro`, `SubjectCard.astro`).
- `src/layouts/` — page shells (`BaseLayout.astro`, `PostLayout.astro`).
- `src/content/blog/` and `src/content/projects/` — Markdown content collections.
- `src/content/config.ts` — Zod schemas that validate frontmatter at build time.
- `src/lib/` — utilities such as `createSlug.ts`.
- `src/styles/` and `src/config.ts` — global CSS and site metadata.
- `public/` — static assets (favicon, profile images).
- `projects/` — standalone legacy web apps (`book_splitter`, `Scene_Splitter`, `Question_Extractor`); keep them self-contained with their own README.
- `docs/superpowers/` — dated design specs and implementation plans.
- `dist/` — build output; gitignored and never committed.

## Build, Test, and Development Commands

- `npm install` — install dependencies.
- `npm run dev` — start the dev server with hot reload (defaults to `localhost:4321`).
- `npm run build` — compile the static site into `dist/` and validate all content collection schemas.
- `npm run preview` — serve the production build locally for final verification.

## Coding Style & Naming Conventions

- TypeScript strict mode via `astro/tsconfigs/strict`; 2-space indentation and single quotes.
- PascalCase for components and layouts (`Footer.astro`); kebab-case for page routes and Markdown content files (`about.astro`, `exam-preparation-guide.md`); camelCase for utilities (`createSlug.ts`).
- No linter is configured; keep formatting consistent with the surrounding code.

## Testing Guidelines

There is no automated test suite yet. Content collections are the main test surface: run `npm run build` to confirm every post and project satisfies its Zod schema. For legacy apps under `projects/`, validate manually and note how to run them in their README.

## Commit & Pull Request Guidelines

Follow Conventional Commits, as in recent history: `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, with an imperative summary.

```text
feat: add blog listing and post detail pages with pagination
fix: add navigation bar, featured projects section, and favicon
```

Pull requests should describe what changed and why, link related issues, include screenshots for visual changes, and pass `npm run build` before requesting review.
