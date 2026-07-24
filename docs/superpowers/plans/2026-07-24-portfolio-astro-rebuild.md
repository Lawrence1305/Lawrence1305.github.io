# Portfolio Astro Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the static HTML portfolio site using Astro 4 + TailwindCSS 3 + DaisyUI 4 (Astrofy template adapted), teacher-first identity, Chinese content.

**Architecture:** Astro static site with DaisyUI drawer layout. Content collections (blog, projects) in Markdown with Zod schemas. Page components for home/about/cv/contact. Existing functional sub-projects kept as-is in `projects/` directory.

**Tech Stack:** Astro 4.x, TailwindCSS 3.x, DaisyUI 4.x, @astrojs/mdx, @astrojs/tailwind, @astrojs/rss, @astrojs/sitemap, dayjs, sharp

## Global Constraints

- All text in Chinese (simplified)
- Teacher identity first, developer second
- npm as package manager (Windows)
- Site builds to `dist/` for both GitHub Pages preview and VPS/Nginx production
- Existing functional sub-projects in `projects/` directory remain unchanged
- DaisyUI theme: `lofi` (light, clean, academic) or `corporate`

---

### Task 1: Scaffold Astro Project

**Files:**
- Create: `package.json`, `astro.config.mjs`, `tailwind.config.mjs`, `tsconfig.json`, `.gitignore`
- Create: `src/env.d.ts`

**Produces:** Working `npm run dev` with blank Astro site

- [ ] **Step 1: Initialize Astro project**

```bash
cd /e/Documents/Coding/Lawrence1305.github.io
npm create astro@latest . -- --template minimal --skip-houston --install
```

Expected: Creates astro.config.mjs, tsconfig.json, src/, package.json

- [ ] **Step 2: Install dependencies**

```bash
npm install @astrojs/mdx @astrojs/rss @astrojs/sitemap @astrojs/tailwind dayjs sharp daisyui
npm install -D @tailwindcss/typography tailwindcss
```

- [ ] **Step 3: Configure astro.config.mjs**

Write `astro.config.mjs`:

```js
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import tailwind from "@astrojs/tailwind";

export default defineConfig({
  site: 'https://lawrence1305.github.io',
  integrations: [mdx(), sitemap(), tailwind()]
});
```

- [ ] **Step 4: Configure tailwind.config.mjs**

Write `tailwind.config.mjs`:

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: { extend: {} },
  plugins: [require('@tailwindcss/typography'), require('daisyui')],
  daisyui: {
    themes: ['lofi', 'corporate', 'light'],
    logs: false,
  },
};
```

- [ ] **Step 5: Write src/env.d.ts**

Write `src/env.d.ts`:

```ts
/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />
```

- [ ] **Step 6: Verify dev server starts**

```bash
npm run dev
```

Open http://localhost:4321 — should show Astro starter page.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json astro.config.mjs tailwind.config.mjs tsconfig.json src/env.d.ts .gitignore
git commit -m "feat: scaffold Astro project with Tailwind + DaisyUI

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 2: Configure Site + Global Styles

**Files:**
- Create: `src/config.ts`
- Create: `src/styles/global.css`

**Produces:** Site-wide config values and global CSS

- [ ] **Step 1: Write src/config.ts**

```ts
export const SITE_TITLE = 'Lawrence — AP/A-Level数学物理教师';
export const SITE_DESCRIPTION = 'AP与A-Level数学物理专业辅导，同时热衷于用代码构建教育工具。';
export const GENERATE_SLUG_FROM_TITLE = true;
export const TRANSITION_API = true;
```

- [ ] **Step 2: Write src/styles/global.css**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 3: Verify build**

```bash
npm run build
```

Expected: Build succeeds, no errors about missing imports.

- [ ] **Step 4: Commit**

```bash
git add src/config.ts src/styles/global.css
git commit -m "feat: add site config and global styles

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 3: Build BaseLayout + Navigation

**Files:**
- Create: `src/components/BaseHead.astro`
- Create: `src/components/Header.astro`
- Create: `src/components/Footer.astro`
- Create: `src/layouts/BaseLayout.astro`

**Produces:** Shared layout with Chinese navigation header and footer

- [ ] **Step 1: Write src/components/BaseHead.astro**

```astro
---
import { SITE_TITLE, SITE_DESCRIPTION } from "../config";

const { title = SITE_TITLE, description = SITE_DESCRIPTION, image, ogType } = Astro.props;
---
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>{title}</title>
<meta name="description" content={description} />
<meta property="og:title" content={title} />
<meta property="og:description" content={description} />
<meta property="og:type" content={ogType || "website"} />
<meta property="og:site_name" content={SITE_TITLE} />
{image && <meta property="og:image" content={image} />}
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<link rel="sitemap" href="/sitemap-index.xml" />
```

- [ ] **Step 2: Write src/components/Header.astro**

```astro
---
const navItems = [
  { href: "/", label: "首页" },
  { href: "/about", label: "关于我" },
  { href: "/cv", label: "简历" },
  { href: "/blog", label: "博客" },
  { href: "/projects", label: "项目" },
  { href: "/contact", label: "联系方式" },
];
---

<div class="sticky lg:hidden top-0 z-30 flex h-16 w-full justify-center bg-opacity-90 backdrop-blur transition-all duration-100 bg-base-100 text-base-content shadow-sm">
  <div class="navbar">
    <div class="navbar-start">
      <label for="my-drawer" class="btn btn-square btn-ghost">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="inline-block w-5 h-5 stroke-current">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path>
        </svg>
      </label>
    </div>
    <div class="navbar-center">
      <a class="btn btn-ghost normal-case text-xl" href="/">Lawrence</a>
    </div>
    <div class="navbar-end"></div>
  </div>
</div>
```

- [ ] **Step 3: Write src/components/Footer.astro**

```astro
<footer class="footer footer-center p-10 bg-base-200 text-base-content rounded">
  <div>
    <div class="grid grid-flow-col gap-4">
      <a href="https://github.com/Lawrence1305" target="_blank" class="btn btn-ghost btn-circle" aria-label="GitHub">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
        </svg>
      </a>
      <a href="mailto:your.email@example.com" class="btn btn-ghost btn-circle" aria-label="Email">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
        </svg>
      </a>
    </div>
  </div>
  <div>
    <p>&copy; {new Date().getFullYear()} Lawrence. 保留所有权利。</p>
  </div>
</footer>
```

- [ ] **Step 4: Write src/layouts/BaseLayout.astro**

```astro
---
import BaseHead from "../components/BaseHead.astro";
import Header from "../components/Header.astro";
import Footer from "../components/Footer.astro";
import { ViewTransitions } from "astro:transitions";
import { SITE_TITLE, SITE_DESCRIPTION, TRANSITION_API } from "../config";
import "../styles/global.css";

const {
  title = SITE_TITLE,
  description = SITE_DESCRIPTION,
  image,
  ogType,
} = Astro.props;
---

<!doctype html>
<html lang="zh-CN" data-theme="lofi">
  <head>
    <BaseHead title={title} description={description} image={image} ogType={ogType} />
    {TRANSITION_API && <ViewTransitions />}
  </head>
  <body>
    <div class="bg-base-100 min-h-screen">
      <Header />
      <div class="md:flex md:justify-center">
        <main class="p-6 pt-10 lg:max-w-[900px] max-w-[100vw]">
          <slot />
        </main>
      </div>
      <Footer />
    </div>
  </body>
</html>
```

- [ ] **Step 5: Verify layout renders**

Replace `src/pages/index.astro` temporarily with:

```astro
---
import BaseLayout from "../layouts/BaseLayout.astro";
---
<BaseLayout>
  <h1 class="text-3xl font-bold">测试</h1>
</BaseLayout>
```

Run `npm run dev` — page should show header with "Lawrence", navigation hamburger on mobile, footer with GitHub icon and copyright.

- [ ] **Step 6: Commit**

```bash
git add src/components/BaseHead.astro src/components/Header.astro src/components/Footer.astro src/layouts/BaseLayout.astro src/pages/index.astro
git commit -m "feat: add BaseLayout with Chinese navigation and footer

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 4: Build Home Page

**Files:**
- Create: `src/components/SubjectCard.astro`
- Modify: `src/pages/index.astro`

**Produces:** Home page with hero, subject cards, featured projects, latest blog posts

- [ ] **Step 1: Write src/components/SubjectCard.astro**

```astro
---
const { title, description, formula } = Astro.props;
---

<div class="card bg-base-100 shadow-md hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
  <div class="card-body">
    <h3 class="card-title text-primary">{title}</h3>
    <p class="text-base-content/70">{description}</p>
    <div class="mt-2 font-serif italic text-2xl text-secondary">{formula}</div>
  </div>
</div>
```

- [ ] **Step 2: Write src/pages/index.astro**

```astro
---
import BaseLayout from "../layouts/BaseLayout.astro";
import SubjectCard from "../components/SubjectCard.astro";
import HorizontalCard from "../components/HorizontalCard.astro";
import { getCollection } from "astro:content";

const posts = (await getCollection("blog")).sort(
  (a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf()
);
const latestPosts = posts.slice(0, 3);

const subjectCards = [
  { title: "AP 物理", description: "专注AP Physics 1, 2和C (Mechanics, E&M)课程辅导，帮助学生掌握物理核心概念和解题技巧。", formula: "F = ma" },
  { title: "AP 数学", description: "提供AP Calculus AB/BC和AP Statistics专业指导，通过系统化方法提高学生的数学思维。", formula: "∫f(x)dx" },
  { title: "A-Level 物理", description: "全面覆盖A-Level物理课程，着重培养学生的实验技能和理论应用能力。", formula: "E = hf" },
  { title: "A-Level 数学", description: "针对A-Level数学和Further Mathematics提供深入辅导，为学生未来的学术发展打下坚实基础。", formula: "eiπ + 1 = 0" },
];
---

<BaseLayout>
  <!-- Hero -->
  <div class="pb-12 mt-5">
    <div class="text-5xl font-bold leading-tight">
      AP与A-Level<br />数学物理专业辅导
    </div>
    <div class="text-xl py-3 text-base-content/70">
      帮助学生掌握核心概念，提升解题能力，成功应对国际考试挑战
    </div>
    <div class="py-2 text-lg">
      也热衷于用代码构建教育工具，让教学更加高效。
    </div>
    <div class="mt-8 flex gap-4">
      <a class="btn btn-primary" href="/contact">预约咨询</a>
      <a class="btn btn-outline" href="/projects">查看项目</a>
    </div>
  </div>

  <!-- Subject Cards -->
  <div class="mt-16">
    <h2 class="text-3xl font-bold mb-6">我的专业领域</h2>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      {subjectCards.map((card) => (
        <SubjectCard title={card.title} description={card.description} formula={card.formula} />
      ))}
    </div>
  </div>

  <!-- Why Choose Me -->
  <div class="mt-16">
    <h2 class="text-3xl font-bold mb-6">为什么选择我的辅导</h2>
    <div class="bg-base-200 rounded-lg p-6 space-y-3">
      <p class="flex items-start gap-2"><span class="text-primary font-bold">✓</span> 多年国际考试辅导经验，熟悉AP和A-Level考试要求和评分标准</p>
      <p class="flex items-start gap-2"><span class="text-primary font-bold">✓</span> 个性化教学方案，根据学生的学习风格和需求调整教学策略</p>
      <p class="flex items-start gap-2"><span class="text-primary font-bold">✓</span> 强调概念理解与应用，而非单纯的题海战术</p>
      <p class="flex items-start gap-2"><span class="text-primary font-bold">✓</span> 提供详细的学习资料和练习题，帮助学生巩固所学知识</p>
    </div>
  </div>

  <!-- Latest Blog Posts -->
  {
    latestPosts.length > 0 && (
      <div class="mt-16">
        <h2 class="text-3xl font-bold mb-6">最新博客</h2>
        {latestPosts.map((post) => (
          <>
            <HorizontalCard
              title={post.data.title}
              img={post.data.heroImage}
              desc={post.data.description}
              url={"/blog/" + post.slug}
              target="_self"
              badge={post.data.badge}
            />
            <div class="divider my-0" />
          </>
        ))}
      </div>
    )
  }
</BaseLayout>
```

- [ ] **Step 3: Write src/components/HorizontalCard.astro**

(This component is used by the home page for blog posts. Write a minimal working version since the blog content collection doesn't exist yet.)

```astro
---
const { title, img, desc, url, target = "_blank", badge } = Astro.props;
---

<div class="py-4">
  <div class="flex gap-4 items-start">
    {img && <img src={img} alt={title} class="w-24 h-24 object-cover rounded-lg flex-shrink-0" />}
    <div class="flex-1 min-w-0">
      <div class="flex items-center gap-2 flex-wrap">
        <a href={url} target={target} class="text-xl font-bold hover:text-primary transition-colors">{title}</a>
        {badge && <span class="badge badge-primary badge-sm">{badge}</span>}
      </div>
      <p class="text-base-content/60 mt-1">{desc}</p>
    </div>
  </div>
</div>
```

- [ ] **Step 4: Verify home page renders**

```bash
npm run build
```

Expected: Build failure due to missing blog content collection — this is expected since we haven't created content yet. Temporarily wrap the `getCollection("blog")` call:

In `src/pages/index.astro`, change the blog section to handle missing collection gracefully:

```astro
const posts = (() => {
  try {
    return (await getCollection("blog")).sort(
      (a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf()
    );
  } catch {
    return [];
  }
})();
```

Run `npm run dev` — home page should show hero, subject cards, "why choose me" section.

- [ ] **Step 5: Commit**

```bash
git add src/components/SubjectCard.astro src/components/HorizontalCard.astro src/pages/index.astro
git commit -m "feat: build home page with hero, subject cards and highlights

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 5: Build About Page

**Files:**
- Create: `src/pages/about.astro`

**Produces:** About page with profile, education, philosophy, testimonials

- [ ] **Step 1: Write src/pages/about.astro**

```astro
---
import BaseLayout from "../layouts/BaseLayout.astro";
---

<BaseLayout title="关于我 — Lawrence" description="了解Lawrence的教学背景、教育理念和学生反馈。">
  <h1 class="text-3xl font-bold mb-8">关于我</h1>

  <div class="flex flex-col md:flex-row gap-8 items-start">
    <img
      src="/images/profile.jpg"
      alt="Lawrence的照片"
      class="w-48 h-48 object-cover rounded-full border-4 border-primary flex-shrink-0"
    />
    <div class="space-y-4">
      <p>
        作为一名资深的数学和物理教师，我专注于为准备国际考试的学生提供AP和A-Level课程辅导。
        我相信每个学生都有自己独特的学习方式，我的目标是帮助他们找到最适合自己的学习路径。
      </p>
      <p>
        我拥有数学和物理学背景，并且在国际教育领域有多年的教学经验。
        通过与来自不同背景的学生合作，我开发了一套有效的教学方法，帮助学生不仅能应对考试，更能真正理解和应用所学知识。
      </p>
    </div>
  </div>

  <div class="mt-10">
    <h2 class="text-2xl font-bold mb-4">教育背景</h2>
    <div class="bg-base-200 rounded-lg p-6 space-y-2">
      <p class="flex items-center gap-2"><span class="text-primary">•</span> 数学理学硕士</p>
      <p class="flex items-center gap-2"><span class="text-primary">•</span> 物理教育学学士</p>
      <p class="flex items-center gap-2"><span class="text-primary">•</span> AP和A-Level考官培训认证</p>
    </div>
  </div>

  <div class="mt-10">
    <h2 class="text-2xl font-bold mb-4">教学理念</h2>
    <p>
      我相信数学和物理不应该只是抽象的概念和公式，而应该是解决实际问题的工具。
      我的课程注重培养学生的批判性思维和问题解决能力，帮助他们建立对学科的信心和热情。
    </p>
    <p class="mt-2">
      无论是解决复杂的微积分问题，还是理解量子物理的基本原理，我都致力于让学习过程变得清晰、有条理且引人入胜。
    </p>
  </div>

  <div class="mt-10">
    <h2 class="text-2xl font-bold mb-6">学生反馈</h2>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div class="card bg-base-200">
        <div class="card-body">
          <p>"Lawrence老师的教学方法让我对物理有了全新的理解。通过他的辅导，我在AP物理C考试中获得了满分。"</p>
          <p class="font-bold mt-2">— 张同学，现就读于MIT</p>
        </div>
      </div>
      <div class="card bg-base-200">
        <div class="card-body">
          <p>"数学一直是我的弱项，但Lawrence老师的耐心指导让我建立了信心，最终在A-Level数学考试中获得了A*。"</p>
          <p class="font-bold mt-2">— 李同学，现就读于剑桥大学</p>
        </div>
      </div>
    </div>
  </div>
</BaseLayout>
```

- [ ] **Step 2: Verify about page**

```bash
npm run dev
```

Navigate to http://localhost:4321/about — should show profile, education, philosophy, testimonials.

- [ ] **Step 3: Commit**

```bash
git add src/pages/about.astro
git commit -m "feat: build about page with profile and testimonials

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 6: Build CV Page with Timeline

**Files:**
- Create: `src/components/cv/TimeLine.astro`
- Create: `src/pages/cv.astro`

**Produces:** CV/resume page with timeline showing teaching and dev experience

- [ ] **Step 1: Write src/components/cv/TimeLine.astro**

```astro
---
const { events } = Astro.props;
---

<ul class="timeline timeline-snap-icon max-md:timeline-compact timeline-vertical">
  {events.map((event, i) => (
    <li>
      {i > 0 && <hr />}
      <div class="timeline-middle">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-5 w-5 text-primary">
          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clip-rule="evenodd" />
        </svg>
      </div>
      <div class={i % 2 === 0 ? "timeline-start md:text-end mb-10" : "timeline-end mb-10"}>
        <div class="text-lg font-black text-primary">{event.period}</div>
        <div class="text-xl font-bold">{event.title}</div>
        <div class="text-base-content/70">{event.company}</div>
        {event.description && <div class="mt-2 text-base-content/80">{event.description}</div>}
        {event.tags && (
          <div class="mt-2 flex gap-2 flex-wrap">
            {event.tags.map((tag) => <span class="badge badge-outline">{tag}</span>)}
          </div>
        )}
      </div>
      <hr />
    </li>
  ))}
</ul>
```

- [ ] **Step 2: Write src/pages/cv.astro**

```astro
---
import BaseLayout from "../layouts/BaseLayout.astro";
import TimeLine from "../components/cv/TimeLine.astro";

const teachingEvents = [
  {
    period: "2020 — 至今",
    title: "AP/A-Level 数学物理教师",
    company: "独立辅导",
    description: "为学生提供AP Physics, AP Calculus, A-Level Physics和A-Level Mathematics的一对一专业辅导。多名学生获得AP满分和A-Level A*成绩。",
    tags: ["AP", "A-Level", "Physics", "Mathematics"],
  },
  {
    period: "2018 — 2020",
    title: "数学教师",
    company: "国际学校",
    description: "担任国际学校数学教师，教授IGCSE和A-Level数学课程，参与课程设计和考试评估。",
    tags: ["IGCSE", "A-Level", "Mathematics"],
  },
];

const devEvents = [
  {
    period: "2024 — 至今",
    title: "教育工具开发者",
    company: "个人项目",
    description: "开发试卷提取、书籍分割、视频场景分割等教育工具，将技术应用于教学场景。",
    tags: ["Python", "JavaScript", "FastAPI", "Docker"],
  },
];
---

<BaseLayout title="简历 — Lawrence" description="Lawrence的教学与开发经历。">
  <h1 class="text-3xl font-bold mb-2">简历</h1>
  <p class="text-base-content/70 mb-8">教学经历与开发项目</p>

  <h2 class="text-2xl font-bold mb-6">教学经历</h2>
  <TimeLine events={teachingEvents} />

  <h2 class="text-2xl font-bold mt-8 mb-6">开发经历</h2>
  <TimeLine events={devEvents} />
</BaseLayout>
```

- [ ] **Step 3: Verify CV page**

Run `npm run build` — should succeed. Run `npm run dev` and check http://localhost:4321/cv.

- [ ] **Step 4: Commit**

```bash
git add src/components/cv/TimeLine.astro src/pages/cv.astro
git commit -m "feat: build CV page with DaisyUI timeline

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 7: Set Up Content Collections

**Files:**
- Create: `src/content/config.ts`
- Create: `src/content/blog/.gitkeep`
- Create: `src/content/projects/.gitkeep`

**Produces:** Blog and projects content collections with Zod schemas

- [ ] **Step 1: Write src/content/config.ts**

```ts
import { z, defineCollection } from "astro:content";

const blogSchema = z.object({
  title: z.string(),
  description: z.string(),
  pubDate: z.coerce.date(),
  updatedDate: z.coerce.date().optional(),
  heroImage: z.string().optional(),
  badge: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

const projectSchema = z.object({
  title: z.string(),
  description: z.string(),
  techStack: z.array(z.string()).optional(),
  demoUrl: z.string().optional(),
  repoUrl: z.string().optional(),
  heroImage: z.string().optional(),
  date: z.coerce.date(),
  featured: z.boolean().default(false),
});

export type BlogSchema = z.infer<typeof blogSchema>;
export type ProjectSchema = z.infer<typeof projectSchema>;

const blogCollection = defineCollection({ schema: blogSchema });
const projectCollection = defineCollection({ schema: projectSchema });

export const collections = {
  blog: blogCollection,
  projects: projectCollection,
};
```

- [ ] **Step 2: Create placeholder directories**

```bash
mkdir -p src/content/blog src/content/projects
touch src/content/blog/.gitkeep src/content/projects/.gitkeep
```

- [ ] **Step 3: Verify collections register**

```bash
npm run build
```

Expected: Build should succeed. The blog collection is now available — fix the home page to remove the try/catch workaround from Task 4.

- [ ] **Step 4: Commit**

```bash
git add src/content/
git commit -m "feat: add blog and projects content collections with schemas

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 8: Build Blog Pages

**Files:**
- Create: `src/layouts/PostLayout.astro`
- Create: `src/pages/blog/[...page].astro`
- Create: `src/pages/blog/[slug].astro`
- Create: `src/lib/createSlug.ts`
- Modify: `src/pages/index.astro` (restore getCollection blog call now that collection exists)

**Produces:** Blog listing with pagination and blog post detail pages

- [ ] **Step 1: Write src/lib/createSlug.ts**

```ts
export default function createSlug(title: string, existingSlug: string): string {
  return existingSlug;
}
```

- [ ] **Step 2: Write src/layouts/PostLayout.astro**

```astro
---
import BaseLayout from "./BaseLayout.astro";
import type { BlogSchema } from "../content/config";
import dayjs from "dayjs";

const { post } = Astro.props as { post: { data: BlogSchema; body: string; slug: string } };
---

<BaseLayout title={post.data.title + " — Lawrence"} description={post.data.description} ogType="article">
  <article class="prose prose-lg max-w-none">
    <h1>{post.data.title}</h1>
    <div class="text-base-content/60 text-sm mb-8">
      {dayjs(post.data.pubDate).format("YYYY年MM月DD日")}
    </div>
    {post.data.badge && <span class="badge badge-primary mb-4">{post.data.badge}</span>}
    <slot />
  </article>
</BaseLayout>
```

- [ ] **Step 3: Write src/pages/blog/[...page].astro**

```astro
---
import BaseLayout from "../../layouts/BaseLayout.astro";
import { getCollection } from "astro:content";
import createSlug from "../../lib/createSlug";

const allPosts = (await getCollection("blog")).sort(
  (a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf()
);

const pageSize = 6;
const { page } = Astro.params;
const currentPage = page ? Number(page) : 1;
const totalPages = Math.ceil(allPosts.length / pageSize);
const posts = allPosts.slice((currentPage - 1) * pageSize, currentPage * pageSize);
---

<BaseLayout title="博客 — Lawrence" description="Lawrence的博客文章。">
  <h1 class="text-3xl font-bold mb-2">博客</h1>
  <p class="text-base-content/70 mb-8">分享教学心得、备考技巧和技术笔记</p>

  {posts.length === 0 && <p class="text-center py-12 text-base-content/50">还没有文章。</p>}

  <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
    {posts.map((post) => (
      <a href={"/blog/" + createSlug(post.data.title, post.slug)} class="card bg-base-200 hover:bg-base-300 transition-colors">
        {post.data.heroImage && (
          <img src={post.data.heroImage} alt={post.data.title} class="w-full h-48 object-cover rounded-t-lg" />
        )}
        <div class="card-body">
          <h2 class="card-title">{post.data.title}</h2>
          <p class="text-base-content/70">{post.data.description}</p>
          <div class="card-actions justify-between items-center mt-2">
            <span class="text-sm text-base-content/50">{post.data.pubDate.toLocaleDateString("zh-CN")}</span>
            {post.data.badge && <span class="badge badge-primary badge-sm">{post.data.badge}</span>}
          </div>
        </div>
      </a>
    ))}
  </div>

  {totalPages > 1 && (
    <div class="join mt-8 flex justify-center">
      {Array.from({ length: totalPages }, (_, i) => (
        <a
          href={i === 0 ? "/blog" : `/blog/${i + 1}`}
          class={`join-item btn ${currentPage === i + 1 ? "btn-active" : ""}`}
        >
          {i + 1}
        </a>
      ))}
    </div>
  )}
</BaseLayout>
```

- [ ] **Step 4: Write src/pages/blog/[slug].astro**

```astro
---
import PostLayout from "../../layouts/PostLayout.astro";
import { getCollection } from "astro:content";

export async function getStaticPaths() {
  const posts = await getCollection("blog");
  return posts.map((post) => ({ params: { slug: post.slug } }));
}

const { slug } = Astro.params;
const posts = await getCollection("blog");
const post = posts.find((p) => p.slug === slug);

if (!post) {
  return Astro.redirect("/404");
}

const { Content } = await post.render();
---

<PostLayout post={post}>
  <Content />
</PostLayout>
```

- [ ] **Step 5: Fix home page blog import**

In `src/pages/index.astro`, remove the try/catch wrapper around `getCollection("blog")` now that the collection exists. The call should be:

```astro
const posts = (await getCollection("blog")).sort(
  (a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf()
);
```

- [ ] **Step 6: Verify blog pages**

```bash
npm run build
```

Expected: Build succeeds. `/blog` shows empty blog listing with "还没有文章。" message.

- [ ] **Step 7: Commit**

```bash
git add src/layouts/PostLayout.astro src/pages/blog/ src/lib/createSlug.ts src/pages/index.astro
git commit -m "feat: add blog listing and post detail pages with pagination

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 9: Build Projects Page

**Files:**
- Create: `src/pages/projects.astro`

**Produces:** Projects listing page from content collection

- [ ] **Step 1: Write src/pages/projects.astro**

```astro
---
import BaseLayout from "../layouts/BaseLayout.astro";
import { getCollection } from "astro:content";

const allProjects = (await getCollection("projects")).sort(
  (a, b) => b.data.date.valueOf() - a.data.date.valueOf()
);
---

<BaseLayout title="项目 — Lawrence" description="Lawrence的技术项目。">
  <h1 class="text-3xl font-bold mb-2">项目</h1>
  <p class="text-base-content/70 mb-8">教学工具与开发项目</p>

  {allProjects.length === 0 && <p class="text-center py-12 text-base-content/50">还没有项目。</p>}

  <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
    {allProjects.map((project) => (
      <div class="card bg-base-200 shadow-md">
        {project.data.heroImage && (
          <img src={project.data.heroImage} alt={project.data.title} class="w-full h-48 object-cover rounded-t-lg" />
        )}
        <div class="card-body">
          <h2 class="card-title">{project.data.title}</h2>
          <p class="text-base-content/70">{project.data.description}</p>
          {project.data.techStack && (
            <div class="flex gap-2 flex-wrap mt-2">
              {project.data.techStack.map((tech) => (
                <span class="badge badge-outline">{tech}</span>
              ))}
            </div>
          )}
          <div class="card-actions mt-4">
            {project.data.demoUrl && (
              <a href={project.data.demoUrl} target="_blank" class="btn btn-primary btn-sm">在线体验</a>
            )}
            {project.data.repoUrl && (
              <a href={project.data.repoUrl} target="_blank" class="btn btn-outline btn-sm">源代码</a>
            )}
          </div>
        </div>
      </div>
    ))}
  </div>
</BaseLayout>
```

- [ ] **Step 2: Verify projects page**

```bash
npm run build
```

Expected: Succeeds. `/projects` shows empty state.

- [ ] **Step 3: Commit**

```bash
git add src/pages/projects.astro
git commit -m "feat: add projects listing page from content collection

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 10: Build Contact Page

**Files:**
- Create: `src/pages/contact.astro`

**Produces:** Contact page with info and form

- [ ] **Step 1: Write src/pages/contact.astro**

```astro
---
import BaseLayout from "../layouts/BaseLayout.astro";
---

<BaseLayout title="联系方式 — Lawrence" description="联系Lawrence。">
  <h1 class="text-3xl font-bold mb-8">联系我</h1>

  <p class="mb-8">如果您有任何问题或合作意向，请通过以下方式联系我：</p>

  <div class="space-y-4 mb-10">
    <div class="flex items-center gap-3">
      <span class="text-primary font-bold min-w-[4rem]">邮箱</span>
      <a href="mailto:your.email@example.com" class="link link-primary">your.email@example.com</a>
    </div>
    <div class="flex items-center gap-3">
      <span class="text-primary font-bold min-w-[4rem]">GitHub</span>
      <a href="https://github.com/Lawrence1305" target="_blank" class="link link-primary">github.com/Lawrence1305</a>
    </div>
    <div class="flex items-center gap-3">
      <span class="text-primary font-bold min-w-[4rem]">LinkedIn</span>
      <a href="https://www.linkedin.com/in/yourusername" target="_blank" class="link link-primary">LinkedIn主页</a>
    </div>
  </div>

  <h2 class="text-2xl font-bold mb-4">给我留言</h2>
  <form class="space-y-4 max-w-lg">
    <div class="form-control">
      <label class="label" for="name">
        <span class="label-text">姓名</span>
      </label>
      <input type="text" id="name" name="name" required class="input input-bordered" />
    </div>
    <div class="form-control">
      <label class="label" for="email">
        <span class="label-text">邮箱</span>
      </label>
      <input type="email" id="email" name="email" required class="input input-bordered" />
    </div>
    <div class="form-control">
      <label class="label" for="message">
        <span class="label-text">留言</span>
      </label>
      <textarea id="message" name="message" rows="5" required class="textarea textarea-bordered"></textarea>
    </div>
    <button type="submit" class="btn btn-primary">发送</button>
  </form>
</BaseLayout>
```

- [ ] **Step 2: Verify contact page**

```bash
npm run build
```

Expected: Succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/pages/contact.astro
git commit -m "feat: add contact page with form and social links

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 11: Add 404 Page + RSS

**Files:**
- Create: `src/pages/404.astro`
- Create: `src/pages/rss.xml.js`

**Produces:** Custom 404 page and RSS feed

- [ ] **Step 1: Write src/pages/404.astro**

```astro
---
import BaseLayout from "../layouts/BaseLayout.astro";
---

<BaseLayout title="页面未找到 — Lawrence">
  <div class="text-center py-20">
    <h1 class="text-6xl font-bold text-primary">404</h1>
    <p class="text-xl mt-4">页面未找到</p>
    <a href="/" class="btn btn-primary mt-8">返回首页</a>
  </div>
</BaseLayout>
```

- [ ] **Step 2: Write src/pages/rss.xml.js**

```js
import rss from "@astrojs/rss";
import { getCollection } from "astro:content";
import { SITE_TITLE, SITE_DESCRIPTION } from "../config";

export async function GET(context) {
  const posts = await getCollection("blog");
  return rss({
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    site: context.site,
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.pubDate,
      link: `/blog/${post.slug}/`,
    })),
  });
}
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/404.astro src/pages/rss.xml.js
git commit -m "feat: add 404 page and RSS feed

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 12: Migrate Existing Content

**Files:**
- Create: `src/content/blog/exam-preparation-guide.md`
- Create: `src/content/projects/book-splitter.md`
- Create: `src/content/projects/question-extractor.md`
- Create: `src/content/projects/scene-splitter.md`

**Produces:** All existing content migrated to Markdown content collections

- [ ] **Step 1: Write src/content/blog/exam-preparation-guide.md**

```markdown
---
title: "国际考试备考指南"
description: "分享国际考试的备考技巧和资源，帮助您高效准备托福、雅思、AP、A-Level等国际考试。"
pubDate: 2026-02-11
badge: "备考"
tags: ["考试", "备考", "技巧"]
---

在这篇文章中，我将分享我对国际考试备考的经验和建议。无论您是准备托福、雅思、GRE还是其他国际考试，希望这些信息对您有所帮助。

## 制定合理的学习计划

备考国际考试首先需要制定一个合理的学习计划。根据您的目标分数和当前水平，确定需要多长时间准备，然后将学习任务分解为每日和每周的小目标。

## 掌握考试结构和要求

深入了解考试的结构、题型和评分标准。这样可以有针对性地进行准备，避免浪费时间在不重要的内容上。

## 使用优质的学习资源

选择权威的备考材料和资源。官方指南通常是最可靠的资源，因为它们直接来自考试机构。此外，还可以使用在线课程、应用程序和模拟测试来补充学习。

## 定期进行模拟测试

模拟测试是评估进步和发现弱点的最佳方式。尽量在与实际考试相似的条件下进行模拟，包括时间限制和环境。

## 建立学习小组

与其他备考同学一起学习可以提高动力和效率。您可以互相解答问题，分享资源，并提供情感支持。

## 保持健康的生活方式

充足的睡眠、均衡的饮食和适当的运动对于保持大脑功能和学习效率至关重要。不要忽视身心健康。

## 结语

备考国际考试是一段充满挑战但也充满收获的旅程。通过制定合理的计划、使用优质资源和保持健康的生活方式，您一定能够取得满意的成绩。
```

- [ ] **Step 2: Write src/content/projects/book-splitter.md**

```markdown
---
title: "书籍分割工具"
description: "将扫描的书籍图片自动分割为单页，使用灰度分隔符检测算法实现精准分割。"
techStack: ["JavaScript", "HTML", "CSS", "Canvas API"]
demoUrl: "/projects/book_splitter/index.html"
date: 2026-02-25
featured: true
---

一个基于浏览器的工具，能够自动检测扫描书籍图片中的灰色分隔线，并将双页扫描自动分割为单独页面。

### 主要功能

- 灰度分隔符自动检测
- 图片预处理与优化
- PDF 生成与导出
- 批量处理支持
```

- [ ] **Step 3: Write src/content/projects/question-extractor.md**

```markdown
---
title: "试卷题目提取器"
description: "从PDF格式的考试试卷中自动提取和识别题目，支持数学和物理试卷的题目分离。"
techStack: ["JavaScript", "PDF.js", "HTML", "CSS"]
demoUrl: "/projects/Question_Extractor/index.html"
date: 2026-03-07
featured: true
---

一个用于从PDF考试试卷中自动提取题目的工具，支持复杂排版的识别和题目区域定位。

### 主要功能

- PDF 文件加载与渲染
- 题目区域智能识别
- 题目图文混合提取
- 支持数学公式识别
```

- [ ] **Step 4: Write src/content/projects/scene-splitter.md**

```markdown
---
title: "视频场景分割器"
description: "基于AI的视频场景自动分割工具，支持镜头检测、场景分类和批量导出。"
techStack: ["Python", "FastAPI", "Celery", "OpenCV"]
demoUrl: "/projects/Scene_Splitter/index.html"
date: 2026-03-15
featured: true
---

一个利用AI技术自动检测和分割视频场景的工具，适用于教学视频的章节划分和内容组织。

### 主要功能

- 视频镜头边界检测
- AI 场景内容分析
- 批量视频处理
- 场景标注与导出
```

- [ ] **Step 5: Verify content renders**

```bash
npm run build
```

Expected: Build succeeds. Check:
- `/blog` shows the exam preparation guide post
- `/blog/exam-preparation-guide` renders the full article with prose typography
- `/projects` shows 3 project cards with tech stack badges and links

- [ ] **Step 6: Commit**

```bash
git add src/content/blog/exam-preparation-guide.md src/content/projects/book-splitter.md src/content/projects/question-extractor.md src/content/projects/scene-splitter.md
git commit -m "feat: migrate existing blog and project content to markdown

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 13: Clean Up Old Files + Final Verification

**Files:**
- Delete: `index.html`, `about.html`, `projects.html`, `blog.html`, `contact.html`
- Delete: `css/styles.css`, `js/main.js`
- Delete: `blog/exam-preparation-guide.html`
- Delete: `_config.yaml`

**Produces:** Clean repo with only Astro code and sub-projects

- [ ] **Step 1: Remove old site files**

```bash
git rm index.html about.html projects.html blog.html contact.html
git rm css/styles.css js/main.js
git rm blog/exam-preparation-guide.html
git rm _config.yaml
```

- [ ] **Step 2: Full build verification**

```bash
npm run build
```

Expected: Build succeeds, `dist/` directory generated with all HTML pages. No warnings about missing files or broken links.

- [ ] **Step 3: Verify dist/ output structure**

```bash
ls dist/ && echo "---" && ls dist/blog/ && echo "---" && ls dist/projects/
```

Expected: `dist/index.html`, `dist/about/index.html`, `dist/cv/index.html`, `dist/blog/index.html`, `dist/projects/index.html`, `dist/contact/index.html`, etc.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove old static site files, finalize Astro rebuild

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Summary

After all tasks, the repo will have:

```
/
├── astro.config.mjs
├── tailwind.config.mjs
├── package.json
├── tsconfig.json
├── src/
│   ├── components/
│   │   ├── BaseHead.astro
│   │   ├── Header.astro
│   │   ├── Footer.astro
│   │   ├── SubjectCard.astro
│   │   ├── HorizontalCard.astro
│   │   └── cv/TimeLine.astro
│   ├── content/
│   │   ├── config.ts
│   │   ├── blog/exam-preparation-guide.md
│   │   └── projects/{book-splitter,question-extractor,scene-splitter}.md
│   ├── layouts/
│   │   ├── BaseLayout.astro
│   │   └── PostLayout.astro
│   ├── pages/
│   │   ├── index.astro
│   │   ├── about.astro
│   │   ├── cv.astro
│   │   ├── contact.astro
│   │   ├── projects.astro
│   │   ├── 404.astro
│   │   ├── rss.xml.js
│   │   └── blog/[...page].astro, [slug].astro
│   ├── lib/createSlug.ts
│   ├── styles/global.css
│   └── config.ts
├── public/ (favicon, images)
├── projects/ (existing sub-projects, unchanged)
└── dist/ (build output)
```
