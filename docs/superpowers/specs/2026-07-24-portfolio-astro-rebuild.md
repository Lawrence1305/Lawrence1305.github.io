# Portfolio Site Rebuild with Astrofy

**Date**: 2026-07-24
**Status**: Approved

## Overview

Rebuild the static HTML/CSS portfolio site using Astro + TailwindCSS + DaisyUI (based on the Astrofy template), adapting it for a teacher-first identity with developer projects as supporting evidence.

## Identity & Tone

- Primary identity: AP/A-Level math and physics teacher
- Secondary identity: developer who builds educational tools
- Language: Chinese (simplified)

## Tech Stack

| Layer | Choice | Reason |
|---|---|---|
| Framework | Astro 5.x | Static generation, fast, low JS |
| CSS | TailwindCSS + DaisyUI | Built into Astrofy, 30 themes |
| Content | Markdown (Astro Content Collections) | No CMS needed, git-managed |
| Deployment | GitHub Pages (preview) + VPS/Nginx (prod) | Same static `dist/` output |
| Template | Astrofy v3 (manuelernestog/astrofy) | Mature, MIT license, 1.2k stars |

## Site Structure

| Path | Page | Content Source | Notes |
|---|---|---|---|
| `/` | 首页 | Page component | Hero + subject cards + featured projects |
| `/about` | 关于我 | Page component | Bio, education, philosophy, testimonials |
| `/cv` | 简历/经历 | Page component | Timeline — teaching & dev experience |
| `/blog` | 博客列表 | `src/content/blog/*.md` | Paginated post listing |
| `/blog/[slug]` | 文章详情 | `src/content/blog/*.md` | Individual post |
| `/projects` | 项目列表 | `src/content/projects/*.md` | Project cards linking to tools |
| `/contact` | 联系方式 | Page component | Contact info + form |

Navigation: 首页, 关于我, 简历, 博客, 项目, 联系方式

## Visual Design

### Color
- Use DaisyUI theme system, select a blue-leaning theme
- Primary accent: blue (~`#3498db`) from the original site
- Background: light, clean, academic feel

### Typography
- Body: system Chinese font stack, `Noto Sans SC` as Google Fonts fallback
- Formulas/decorative math: `Cambria Math`, serif

### Home Page
- Hero: teaching tagline + secondary dev mention, dual CTA buttons ("预约咨询" + "查看项目")
- Subject cards: 4 cards (AP Physics, AP Math, A-Level Physics, A-Level Math) each with formula decoration, hover lift effect
- Featured projects: 3 most recent/notable project cards

### About Page
- Profile photo (round), bio text
- Education background in highlight box
- Teaching philosophy
- Student testimonials in card grid

### CV Page
- Timeline component (reuse Astrofy TimeLine)
- Mix of teaching and development experience

### Projects Page
- Card grid of projects from content collection
- Each card: title, description, tech stack tags, links (demo + source)

### Blog
- Standard Astrofy blog layout
- Posts as Markdown files with frontmatter

## Content Migration

| Original | New Location | Format |
|---|---|---|
| `index.html` content | `src/pages/index.astro` | Astro component |
| `about.html` content | `src/pages/about.astro` | Astro component |
| `projects.html` → placeholder | `src/content/projects/*.md` + `src/pages/projects/index.astro` | Markdown + Astro |
| `blog.html` listing | `src/pages/blog/index.astro` | Astro (Astrofy default) |
| `blog/exam-preparation-guide.html` | `src/content/blog/exam-preparation-guide.md` | Markdown |
| `contact.html` | `src/pages/contact.astro` | Astro component |
| `css/styles.css` | Tailwind classes + minimal custom CSS | Removed, replaced by Tailwind |

## Sub-Project Integration

Existing functional projects stay as-is in `projects/` directory, linked from project cards:

- `projects/book_splitter/index.html` — Book splitter tool
- `projects/Question_Extractor/index.html` — Question extractor tool
- `projects/Scene_Splitter/index.html` — Scene splitter tool

Each gets a corresponding `.md` entry in `src/content/projects/` with title, description, tech stack, screenshot, and relative link.

## Deployment

### GitHub Pages (preview)
- Astro build outputs to `dist/`
- Configure Astro `base` to `/` since repo name is `Lawrence1305.github.io`
- GitHub Actions builds on push to main

### VPS (production)
- Same `dist/` served by Nginx
- `scp` or rsync to VPS after build
- Functional projects served as static subdirectories or via Docker (future)

## Project Structure

```
/
├── src/
│   ├── components/       # Reusable Astro components
│   ├── content/
│   │   ├── blog/         # .md blog posts
│   │   └── projects/     # .md project descriptions
│   ├── layouts/          # BaseLayout, BlogPostLayout
│   ├── pages/            # Route pages
│   ├── styles/           # Global CSS (minimal)
│   └── config.ts         # Site config
├── public/               # Static assets (images, favicon)
├── projects/             # Existing functional sub-projects (unchanged)
├── astro.config.mjs
├── tailwind.config.mjs
└── package.json
```

## Out of Scope (for now)
- Docker Compose setup for sub-projects
- VPS Nginx configuration
- CI/CD beyond GitHub Pages auto-deploy
- Contact form backend (form stays as static HTML, or use form service later)
