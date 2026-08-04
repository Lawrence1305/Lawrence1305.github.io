class GraySeparatorDetectorV2 {
    constructor() {
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.debugMode = false;
        this.debugCallback = null;
    }

    setDebugMode(enabled, callback = null) {
        this.debugMode = enabled;
        this.debugCallback = callback;
    }

    debug(message, data = null, type = 'info') {
        if (this.debugMode && this.debugCallback) {
            this.debugCallback(message, data, type);
        }
    }

    // ================================================================
    //  Phase 1: Row activity — how "busy" is each row
    //  High activity = text/images, Low activity = gap/separator
    // ================================================================

    analyzeRows(data, width, height) {
        const rows = [];
        const sampleRate = Math.max(1, Math.floor(width / 200));

        for (let y = 0; y < height; y++) {
            let varianceSum = 0;
            let brightnessSum = 0;
            let edgeCount = 0;
            let sampledCount = 0;
            let prevBrightness = null;

            for (let x = 0; x < width; x += sampleRate) {
                const i = (y * width + x) * 4;
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];

                const brightness = (r + g + b) / 3;
                brightnessSum += brightness;

                const pixelVariance = (
                    Math.pow(r - brightness, 2) +
                    Math.pow(g - brightness, 2) +
                    Math.pow(b - brightness, 2)
                ) / 3;
                varianceSum += pixelVariance;

                if (prevBrightness !== null) {
                    if (Math.abs(brightness - prevBrightness) > 20) {
                        edgeCount++;
                    }
                }
                prevBrightness = brightness;

                sampledCount++;
            }

            if (sampledCount === 0) sampledCount = 1;

            const avgBrightness = brightnessSum / sampledCount;
            const avgVariance = Math.sqrt(varianceSum / sampledCount);
            const edgeDensity = edgeCount / sampledCount;

            // Activity: composite of edge density and variance (normalized)
            // Content rows: activity > 0.15; Gap rows: activity < 0.05
            const activity = edgeDensity * 0.6 + Math.min(1, avgVariance / 30) * 0.4;

            rows.push({ y, avgBrightness, avgVariance, edgeDensity, activity });
        }

        return rows;
    }

    // ================================================================
    //  Phase 2: Find low-activity gap bands
    // ================================================================

    findGapBands(rows, config) {
        const bands = [];
        let inBand = false;
        let bandStart = 0;

        for (let i = 0; i < rows.length; i++) {
            const isGapRow = rows[i].activity <= config.maxGapActivity;

            if (isGapRow && !inBand) {
                inBand = true;
                bandStart = i;
            } else if (!isGapRow && inBand) {
                inBand = false;
                const thickness = i - bandStart;
                if (thickness >= config.minBandThickness && thickness <= config.maxBandThickness) {
                    bands.push({ start: bandStart, end: i, thickness });
                }
            }
        }

        if (inBand) {
            const thickness = rows.length - bandStart;
            if (thickness >= config.minBandThickness && thickness <= config.maxBandThickness) {
                bands.push({ start: bandStart, end: rows.length, thickness });
            }
        }

        return bands;
    }

    // ================================================================
    //  Phase 3: Merge nearby gap bands (close bands are part of same separator)
    // ================================================================

    mergeNearbyBands(bands, config) {
        if (bands.length <= 1) return bands;

        const merged = [];
        let current = { ...bands[0] };

        for (let i = 1; i < bands.length; i++) {
            const gap = bands[i].start - current.end;

            if (gap <= config.mergeDistance) {
                current.end = bands[i].end;
                current.thickness = current.end - current.start;
            } else {
                merged.push(current);
                current = { ...bands[i] };
            }
        }
        merged.push(current);

        return merged;
    }

    // ================================================================
    //  Phase 4: Score bands — width + gray↔white↔gray via row diff
    //
    //  Detects the gray→white→gray sandwich by analyzing row-to-row
    //  brightness differences. Even a subtle 2-3 unit drop per pixel
    //  becomes detectable when summed across the full image width.
    //  The separator signature is: DROP→RISE→[white plateau]→DROP→RISE
    // ================================================================

    // Compute total brightness sum for all pixels in a row (R+G+B)
    getRowEnergy(y) {
        if (!this._rawData || !this._imgWidth) return null;
        const offset = y * this._imgWidth * 4;
        const end = offset + this._imgWidth * 4;
        let sum = 0;
        for (let i = offset; i < end; i += 4) {
            sum += this._rawData[i] + this._rawData[i + 1] + this._rawData[i + 2];
        }
        return sum;
    }

    // Compute row energy sum (R+G+B for all pixels in a row)
    // Using the SUM makes tiny brightness differences visible:
    // a 2-unit drop per pixel → 3840-unit drop in the sum (for 1920px width)
    rowEnergy(y, rows) {
        if (this._rawData && this._imgWidth) {
            const e = this.getRowEnergy(y);
            if (e !== null) return e;
        }
        // Fall back to sampled data scaled to full width
        if (y >= 0 && y < rows.length) {
            return rows[y].avgBrightness * (this._imgWidth || 1920) * 3;
        }
        return null;
    }

    detectGrayWhiteGray(band, rows) {
        const n = band.thickness;
        if (n < 6) return { score: 0, whiteMiddle: null };

        // Build row-energy profile for band + context
        const ctxRows = Math.min(30, Math.floor(n * 0.6));
        const profileStart = Math.max(0, band.start - ctxRows);
        const profileEnd = Math.min(rows.length, band.end + ctxRows);

        const energies = [];
        for (let y = profileStart; y < profileEnd; y++) {
            const e = this.rowEnergy(y, rows);
            energies.push(e !== null ? e : 0);
        }

        if (energies.length < 10) return { score: 0, whiteMiddle: null };

        // Compute smoothed differences
        const diffs = [];
        for (let i = 1; i < energies.length; i++) {
            diffs.push(energies[i] - energies[i - 1]);
        }

        const smoothDiffs = [];
        for (let i = 0; i < diffs.length; i++) {
            let sum = 0, cnt = 0;
            for (let j = Math.max(0, i - 1); j <= Math.min(diffs.length - 1, i + 1); j++) {
                sum += diffs[j]; cnt++;
            }
            smoothDiffs.push(sum / cnt);
        }

        // Dynamic threshold: 0.5% of max row energy
        const maxEnergy = this._imgWidth ? this._imgWidth * 765 : 1468800;
        const minTransition = Math.max(500, maxEnergy * 0.003);

        // Extract significant transitions
        const trans = [];  // { idx, type: 'rise'|'drop', mag }
        for (let i = 0; i < smoothDiffs.length; i++) {
            if (smoothDiffs[i] > minTransition) {
                trans.push({ idx: i, type: 'rise', mag: smoothDiffs[i] });
            } else if (smoothDiffs[i] < -minTransition) {
                trans.push({ idx: i, type: 'drop', mag: -smoothDiffs[i] });
            }
        }

        if (trans.length < 4) {
            return this.detectGWByAbsolute(band, rows);
        }

        // Search for COMPACT drop→rise→[gap]→drop→rise pattern
        // The gray→white→gray sandwich is narrow (typically 15–60px),
        // so the total pattern span must be limited
        const maxPatternSpan = Math.min(80, Math.floor(n * 0.6));

        let bestWhiteStart = -1, bestWhiteEnd = -1, bestScore = 0;

        for (let a = 0; a < trans.length - 3; a++) {
            if (trans[a].type !== 'drop' || trans[a + 1].type !== 'rise') continue;

            for (let b = a + 2; b < trans.length - 1; b++) {
                if (trans[b].type !== 'drop' || trans[b + 1].type !== 'rise') continue;

                // Pattern must be COMPACT — real gray→white→gray is narrow
                const patternSpan = trans[b + 1].idx - trans[a].idx;
                if (patternSpan > maxPatternSpan) continue;

                const whiteStart = trans[a + 1].idx;
                const whiteEnd = trans[b].idx;
                const whiteLen = whiteEnd - whiteStart;

                if (whiteLen < 1) continue;

                // Verify overlap with band
                const bandStartRel = band.start - profileStart;
                const bandEndRel = band.end - profileStart;
                const marginPx = Math.max(5, Math.floor(n * 0.1));

                if (whiteStart > bandEndRel + marginPx || whiteEnd < bandStartRel - marginPx) continue;

                const whiteAbsStart = profileStart + whiteStart;
                const whiteAbsEnd = profileStart + whiteEnd;

                // Pattern magnitude
                const magSum = trans[a].mag + trans[a + 1].mag + trans[b].mag + trans[b + 1].mag;
                const magScore = Math.min(1, magSum / (maxEnergy * 0.02)) * 0.4;

                // White plateau quality: energy should be near max (pure white)
                let whiteEnergySum = 0;
                for (let i = whiteStart; i <= whiteEnd; i++) whiteEnergySum += energies[i];
                const whiteAvg = whiteEnergySum / whiteLen;
                const whiteScore = Math.min(1, whiteAvg / (maxEnergy * 0.95)) * 0.30;

                // Compactness: tighter pattern = higher score
                const compactScore = (1 - Math.min(1, patternSpan / maxPatternSpan)) * 0.15;

                // Position: prefer patterns near the band center (not at extreme edges)
                const bandCenterRel = (bandStartRel + bandEndRel) / 2;
                const patternCenterRel = (whiteStart + whiteEnd) / 2;
                const distFromCenter = Math.abs(patternCenterRel - bandCenterRel) / Math.max(1, (bandEndRel - bandStartRel) / 2);
                const positionScore = (1 - Math.min(1, distFromCenter)) * 0.15;

                const score = magScore + whiteScore + compactScore + positionScore;

                if (score > bestScore) {
                    bestScore = score;
                    bestWhiteStart = whiteAbsStart;
                    bestWhiteEnd = whiteAbsEnd;
                }
            }
        }

        if (bestScore > 0 && bestWhiteStart >= 0) {
            const whiteMiddle = Math.floor((bestWhiteStart + bestWhiteEnd) / 2);
            this.debug(`GW diff: white=[${bestWhiteStart}-${bestWhiteEnd}] mid=${whiteMiddle} score=${bestScore.toFixed(3)}`, null, 'info');
            return { score: bestScore, whiteMiddle };
        }

        // Absolute brightness fallback
        return this.detectGWByAbsolute(band, rows);
    }

    // Fallback: classify rows by absolute brightness thresholds
    detectGWByAbsolute(band, rows) {
        const types = [];
        for (let i = band.start; i < band.end; i++) {
            const row = rows[i];
            if (row.activity >= 0.03) {
                types.push('O');
            } else if (row.avgBrightness > 235) {
                types.push('W');
            } else if (row.avgBrightness >= 130 && row.avgBrightness <= 238) {
                types.push('G');
            } else {
                types.push('O');
            }
        }

        if (types.length === 0) return { score: 0, whiteMiddle: null };

        let bestStart = -1, bestLen = 0;
        let currStart = -1, currLen = 0;
        for (let i = 0; i < types.length; i++) {
            if (types[i] === 'W') {
                if (currStart === -1) currStart = i;
                currLen++;
            } else {
                if (currLen > bestLen) { bestLen = currLen; bestStart = currStart; }
                currStart = -1; currLen = 0;
            }
        }
        if (currLen > bestLen) { bestLen = currLen; bestStart = currStart; }

        if (bestLen < 2) return { score: 0, whiteMiddle: null };

        const whiteStart = bestStart;
        const whiteEnd = bestStart + bestLen;
        let grayBefore = 0, grayAfter = 0;
        for (let i = 0; i < whiteStart; i++) { if (types[i] === 'G') grayBefore++; }
        for (let i = whiteEnd; i < types.length; i++) { if (types[i] === 'G') grayAfter++; }

        let score = 0;
        if (whiteStart > 0 && grayBefore > 0) score += Math.min(1, grayBefore / whiteStart * 2.5) * 0.4;
        const afterLen = types.length - whiteEnd;
        if (afterLen > 0 && grayAfter > 0) score += Math.min(1, grayAfter / afterLen * 2.5) * 0.4;
        score += Math.min(1, bestLen / types.length * 2.5) * 0.2;

        const whiteMiddle = band.start + Math.floor((whiteStart + whiteEnd) / 2);
        return { score, whiteMiddle };
    }

    // Find the row with minimum activity within a band — used as fallback split point
    findMinActivityRow(band, rows) {
        let minAct = Infinity;
        let minY = Math.floor((band.start + band.end) / 2);
        for (let i = band.start; i < band.end; i++) {
            if (rows[i].activity < minAct) {
                minAct = rows[i].activity;
                minY = i;
            }
        }
        return minY;
    }

    scoreBands(bands, rows, config) {
        if (bands.length === 0) return [];

        const sortedByWidth = [...bands].sort((a, b) => a.thickness - b.thickness);
        const globalMedian = sortedByWidth[Math.floor(sortedByWidth.length / 2)].thickness;

        return bands.map(band => {
            let actSum = 0, varSum = 0, brightSum = 0;
            for (let i = band.start; i < band.end; i++) {
                actSum += rows[i].activity;
                varSum += rows[i].avgVariance;
                brightSum += rows[i].avgBrightness;
            }
            const n = band.thickness;
            const avgActivity = actSum / n;
            const avgVariance = varSum / n;
            const avgBrightness = brightSum / n;

            const ctxRange = Math.min(50, band.thickness * 2);
            const ctxAbove = this.avgActivityInRange(rows, band.start - ctxRange, band.start);
            const ctxBelow = this.avgActivityInRange(rows, band.end, band.end + ctxRange);
            const surroundingActivity = Math.max(ctxAbove, ctxBelow);

            const widthRatio = band.thickness / Math.max(globalMedian, 1);
            const contrastRatio = surroundingActivity / (avgActivity + 0.001);

            // Detect gray→white→gray pattern
            const gw = this.detectGrayWhiteGray(band, rows);

            // Score components (total 0–100)
            // 1. Width prominence (0–35)
            const widthScore = Math.min(1, widthRatio / config.minWidthRatio) * 35;

            // 2. Activity contrast (0–25)
            const contrastScore = Math.min(1, contrastRatio / config.minContrastRatio) * 25;

            // 3. Gray→white→gray pattern bonus (0–20)
            const gwScore = gw.score * 20;

            // 4. Uniformity (0–15)
            const uniformityScore = (1 - Math.min(1, avgVariance / config.maxGapVariance)) * 15;

            // 5. Position (0–5)
            const totalRows = rows.length;
            const bandMiddle = (band.start + band.end) / 2;
            const edgeMargin = totalRows * 0.05;
            let positionScore = 5;
            if (bandMiddle < edgeMargin || bandMiddle > totalRows - edgeMargin) {
                positionScore = Math.max(0, Math.min(bandMiddle / edgeMargin, (totalRows - bandMiddle) / edgeMargin)) * 5;
            }

            const totalScore = widthScore + contrastScore + gwScore + uniformityScore + positionScore;

            // Split point: prefer white section center (GW pattern) → min-activity row → band middle
            let middle;
            if (gw.whiteMiddle !== null) {
                middle = gw.whiteMiddle;
            } else {
                middle = this.findMinActivityRow(band, rows);
            }

            return {
                ...band,
                avgActivity,
                avgVariance,
                avgBrightness,
                surroundingActivity,
                contrastRatio,
                widthRatio,
                widthScore,
                contrastScore,
                gwScore,
                uniformityScore,
                positionScore,
                totalScore,
                middle
            };
        }).sort((a, b) => b.totalScore - a.totalScore);
    }

    avgActivityInRange(rows, start, end) {
        start = Math.max(0, start);
        end = Math.min(rows.length, end);
        if (end <= start) return 0;

        let sum = 0;
        for (let i = start; i < end; i++) {
            sum += rows[i].activity;
        }
        return sum / (end - start);
    }

    // ================================================================
    //  Phase 5: Select split points
    // ================================================================

    selectSplitPoints(scoredBands, expectedPages, imageHeight, config) {
        if (expectedPages > 0) {
            return this.selectByExpectedPages(scoredBands, expectedPages, imageHeight, config);
        }
        return this.selectAutomatically(scoredBands, imageHeight, config);
    }

    selectByExpectedPages(scoredBands, expectedPages, imageHeight, config) {
        if (scoredBands.length === 0) {
            const pts = [0];
            for (let i = 1; i < expectedPages; i++) pts.push(Math.floor(imageHeight * i / expectedPages));
            pts.push(imageHeight);
            return pts;
        }

        // Pick top (expectedPages - 1) bands by totalScore, enforcing minPageHeight
        const needed = expectedPages - 1;
        const selected = [];

        for (const band of scoredBands) {
            if (selected.length >= needed) break;

            let tooClose = false;
            for (const sel of selected) {
                if (Math.abs(band.middle - sel.middle) < config.minPageHeight) {
                    tooClose = true;
                    break;
                }
            }
            if (!tooClose) {
                selected.push(band);
            }
        }

        // If not enough qualified bands, fill remaining with synthetic splits
        const mids = selected.map(b => b.middle).sort((a, b) => a - b);
        if (mids.length < needed) {
            const avgPage = imageHeight / expectedPages;
            for (let i = 1; i < expectedPages && mids.length < needed; i++) {
                const expY = Math.floor(avgPage * i);
                // Only add if no existing band is within minPageHeight
                let hasNearby = false;
                for (const m of mids) {
                    if (Math.abs(m - expY) < config.minPageHeight) { hasNearby = true; break; }
                }
                if (!hasNearby) mids.push(expY);
            }
            mids.sort((a, b) => a - b);
        }

        const splitPoints = [0, ...mids, imageHeight];
        return splitPoints;
    }

    selectAutomatically(scoredBands, imageHeight, config) {
        if (scoredBands.length === 0) {
            return [0, imageHeight];
        }

        const estimatedPages = this.estimatePageCount(scoredBands, imageHeight, config);
        const splitPoints = this.selectByExpectedPages(scoredBands, estimatedPages, imageHeight, config);

        if (splitPoints.length < 3) {
            return this.selectWithLowerThreshold(scoredBands, imageHeight, config);
        }

        return splitPoints;
    }

    estimatePageCount(scoredBands, imageHeight, config) {
        if (scoredBands.length === 0) return 2;

        const positions = scoredBands.map(b => b.middle).sort((a, b) => a - b);

        const gaps = [];
        let prev = 0;
        for (const pos of positions) {
            const gap = pos - prev;
            if (gap > imageHeight * 0.02) gaps.push(gap);
            prev = pos;
        }
        gaps.push(imageHeight - prev);

        const validGaps = gaps.filter(g => g > imageHeight * 0.02);
        if (validGaps.length === 0) return 2;

        validGaps.sort((a, b) => a - b);
        const medianGap = validGaps[Math.floor(validGaps.length / 2)];

        let estimated = Math.round(imageHeight / medianGap);
        estimated = Math.max(2, Math.min(estimated, 50));
        return estimated;
    }

    selectWithLowerThreshold(scoredBands, imageHeight, config) {
        const splitPoints = [0];

        for (let threshold = 40; threshold >= 10; threshold -= 5) {
            const selected = [];
            let lastY = 0;

            for (const band of scoredBands) {
                if (band.totalScore >= threshold && band.middle - lastY >= config.minPageHeight) {
                    selected.push(band.middle);
                    lastY = band.middle;
                }
            }

            if (selected.length >= 2) {
                splitPoints.push(...selected);
                break;
            }
        }

        splitPoints.push(imageHeight);
        return splitPoints;
    }

    // ================================================================
    //  Public entry point
    // ================================================================

    detect(img, expectedPages = 0, options = {}) {
        const sensitivity = options.sensitivity !== undefined ? options.sensitivity : 50;
        // s ∈ [-0.25, 1.0]: sens=0 → strictest, sens=20 → default, sens=100 → loose
        const s = (sensitivity - 20) / 80;

        const config = {
            // Gap detection: rows with activity <= maxGapActivity are "gap rows"
            maxGapActivity: Math.max(0.005, Math.min(0.30, 0.02 + s * 0.12)),
            maxGapVariance: Math.max(1, Math.min(100, 3 + s * 50)),

            // Band thickness (max is generous — scoring handles false positives)
            minBandThickness: Math.max(1, Math.floor(15 - s * 14)),
            maxBandThickness: Math.floor(img.height * 0.06),

            // Band merging: close bands within mergeDistance are merged
            mergeDistance: Math.max(2, Math.min(40, Math.floor(30 - s * 27))),

            // Scoring thresholds
            minWidthRatio: Math.max(0.15, 3.5 - s * 2.5),
            minContrastRatio: Math.max(0.15, 4.0 - s * 3.0),

            // Constraints
            minPageHeight: Math.floor(img.height * 0.01),

            ...options
        };

        this.canvas.width = img.width;
        this.canvas.height = img.height;
        this.ctx.drawImage(img, 0, 0);

        const imageData = this.ctx.getImageData(0, 0, img.width, img.height);
        const data = imageData.data;

        // Store for full-row energy computation in detectGrayWhiteGray
        this._rawData = data;
        this._imgWidth = img.width;

        this.debug('========== V2 活动度检测 ==========', null, 'header');
        this.debug(`灵敏度: ${sensitivity} (s=${s.toFixed(2)})`, null, 'info');
        this.debug(`活动度阈值: ${config.maxGapActivity.toFixed(3)}, 最小带宽: ${config.minBandThickness}px`, null, 'info');

        // Phase 1: Row activity analysis
        const rows = this.analyzeRows(data, img.width, img.height);
        this.debug(`逐行分析完成: ${rows.length} 行`, null, 'success');

        // Phase 2: Find gap bands
        const bands = this.findGapBands(rows, config);
        this.debug(`检测到 ${bands.length} 个候选间隙带`, null, 'info');

        // Phase 3: Merge nearby bands
        const merged = this.mergeNearbyBands(bands, config);
        this.debug(`合并后: ${merged.length} 个候选区域 (合并距离=${config.mergeDistance}px)`, merged.slice(0, 20).map(b => ({
            start: b.start, end: b.end, thickness: b.thickness
        })), 'info');

        // Phase 4: Score by local width prominence
        const scored = this.scoreBands(merged, rows, config);
        if (scored.length > 0) {
            this.debug(`评分完成 (宽度比阈值=${config.minWidthRatio.toFixed(1)}x)`, scored.slice(0, 15).map(b => ({
                middle: b.middle,
                thickness: b.thickness,
                widthRatio: b.widthRatio.toFixed(1),
                width: b.widthScore.toFixed(1),
                contrast: b.contrastScore.toFixed(1),
                gw: b.gwScore.toFixed(1),
                total: b.totalScore.toFixed(1)
            })), 'info');
        }

        // Phase 5: Select split points
        const splitPoints = this.selectSplitPoints(scored, expectedPages, img.height, config);
        this.debug(`最终分割点 (${splitPoints.length - 1} 页): [${splitPoints.join(', ')}]`, null, 'success');

        return splitPoints;
    }
}

if (typeof window !== 'undefined') {
    window.GraySeparatorDetectorV2 = GraySeparatorDetectorV2;
}
