# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Pure frontend static website (no build step, no package manager, no server) that splits long book page screenshots into individual pages. All processing happens client-side via Canvas API. Open `index.html` directly in a browser to run.

## Script loading order

`index.html` loads scripts in this dependency chain (order matters):
1. `jspdf.umd.min.js` (CDN, external)
2. `js/graySeparatorDetector.js` — GraySeparatorDetector (V1)
3. `js/graySeparatorDetectorV2.js` — GraySeparatorDetectorV2 (default/recommended)
4. `js/imageAnalyzer.js` — ImageAnalyzer class
5. `js/imageProcessor.js` — ImageProcessor class
6. `js/pdfGenerator.js` — PDFGenerator class
7. `js/app.js` — ImageSplitterApp (main controller, initializes on DOMContentLoaded)

## Architecture: three processing paths

**Path A — Gray separator V2 (default, "推荐"):**
`app.processImage()` creates a `GraySeparatorDetectorV2`, calls `detector.detect(img, expectedPages, { sensitivity })`. V2 directly scans for contiguous gray bands (rows with low color variance, R≈G≈B, moderate brightness), scores them by gray purity + uniformity + context contrast + thickness, then selects the best set of non-overlapping bands. Returns a `splitPoints` array. The rest (canvas slicing, `filterSeparatorPages`, preview) is identical to V1.

**Path B — Gray separator V1:**
Same flow as V2 but uses `GraySeparatorDetector`. The V1 approach detects region-change boundaries first, then validates candidate regions as light-gray after the fact.

**Path C — All other modes (auto/gradient/edge/projection/color/hybrid):**
`app.processImage()` delegates to `ImageProcessor.process(file, sensitivity, progressCallback, detectionMode)`, which internally dispatches to one of six detection methods. Returns an array of `dataURL` strings directly.

Both paths ultimately produce an array of page `dataURL` strings stored in `this.processedPages`, displayed in the preview grid, then exported by `PDFGenerator` or downloaded directly as PNGs.

## GraySeparatorDetectorV2 pipeline (default)

V2 detects page gaps by finding low-activity regions (regardless of color — works for white gaps, gray bands, or any uniform separators):

1. `analyzeRows()` — per-row `activity` = edge density × 0.6 + normalized variance × 0.4. Text rows have high activity; gap rows have near-zero activity.
2. `findGapBands()` — scans for contiguous rows where activity ≤ maxGapActivity (0.02 + s×0.10)
3. `mergeNearbyBands()` — merges adjacent gap bands within mergeDistance, since page separators often appear as several close white bands (margins + gap)
4. `scoreBands()` — scores each merged band 0-100 by: width prominence vs global median (40%) + activity contrast with surroundings (30%) + uniformity (20%) + position (10%)
5. Selection — `selectByExpectedPages()` picks best bands near evenly-spaced expected positions; `selectAutomatically()` estimates page count from median gap between top bands

Sensitivity (0-100, default 20) normalized as `s = sensitivity / 100`. At s=0 only the widest, highest-contrast bands qualify; at s=1 even narrow gaps count. V2 receives raw sensitivity and handles all threshold mapping internally.

## GraySeparatorDetector V1 pipeline

1. `analyzeRows()` — samples every row for avg RGB, variance, brightness, edge density
2. `detectRegionChanges()` — sliding window comparison looking for variance/brightness/edge density deltas
3. `findSeparatorCandidates()` — searches near detected boundaries for low-variance regions
4. `validateGraySeparators()` — confirms candidate regions are actually light-gray (within configurable color thresholds)
5. Selection — if `expectedPages > 0`, uses `selectByExpectedPages()`; otherwise `selectAutomatically()` estimates from gap distribution

## ImageProcessor detection modes

All modes share the same interface: `detectSplitPoints(data, width, height, sensitivity)` returns `[0, ...splitYs, height]`. The `splitImage()` method converts split points to dataURLs. Modes are dispatched by string name in a switch statement (line 57-72 of imageProcessor.js).

## No tests

There is no test suite for this project. The only way to verify changes is to open `index.html` in a browser and manually test with sample book images.
