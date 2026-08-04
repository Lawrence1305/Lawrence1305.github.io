class GraySeparatorDetector {
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

    detect(img, expectedPages = 0, options = {}) {
        // 自动模式下使用更宽松的默认参数
        const isAutoMode = expectedPages === 0;

        const config = {
            windowSize: options.windowSize || 5,
            // 自动模式下使用更低的阈值，更容易检测到变化
            varianceChangeThreshold: isAutoMode ? 0.2 : (options.varianceChangeThreshold || 0.3),
            brightnessChangeThreshold: isAutoMode ? 8 : (options.brightnessChangeThreshold || 10),
            edgeDensityChangeThreshold: isAutoMode ? 0.2 : (options.edgeDensityChangeThreshold || 0.3),
            // 更宽松的灰色检测范围
            grayBrightnessMin: options.grayBrightnessMin || (isAutoMode ? 140 : 150),
            grayBrightnessMax: options.grayBrightnessMax || (isAutoMode ? 250 : 240),
            grayColorDiffMax: options.grayColorDiffMax || (isAutoMode ? 40 : 30),
            grayVarianceMax: options.grayVarianceMax || 25,
            minGrayRatio: options.minGrayRatio || (isAutoMode ? 0.5 : 0.6),
            minSeparatorHeight: options.minSeparatorHeight || (isAutoMode ? 2 : 3),
            maxSeparatorHeight: options.maxSeparatorHeight || 100,
            minPageHeight: options.minPageHeight || Math.floor(img.height * 0.02),
            ...options
        };

        this.canvas.width = img.width;
        this.canvas.height = img.height;
        this.ctx.drawImage(img, 0, 0);

        const imageData = this.ctx.getImageData(0, 0, img.width, img.height);
        const data = imageData.data;

        // 阶段1：分析每一行的特征
        const rowFeatures = this.analyzeRows(data, img.width, img.height);

        // 阶段2：检测颜色区域变化
        const boundaries = this.detectRegionChanges(rowFeatures, config);

        // 阶段3：查找分隔线候选
        const candidates = this.findSeparatorCandidates(boundaries, rowFeatures, data, img.width, config);

        // 阶段4：验证候选是否为浅灰色
        const validCandidates = this.validateGraySeparators(candidates, data, img.width, config);

        // 步骤5：选择最佳分割点
        let splitPoints;
        if (expectedPages > 0) {
            splitPoints = this.selectByExpectedPages(validCandidates, expectedPages, img.height, config);
        } else {
            splitPoints = this.selectAutomatically(validCandidates, img.height, config);
        }

        return splitPoints;
    }

    /**
     * 分析每一行的特征
     */
    analyzeRows(data, width, height) {
        const rowFeatures = [];
        const sampleRate = Math.max(1, Math.floor(width / 300));

        for (let y = 0; y < height; y++) {
            let rSum = 0, gSum = 0, bSum = 0;
            let rSquareSum = 0, gSquareSum = 0, bSquareSum = 0;
            let brightnessSum = 0;
            let edgeCount = 0;
            let sampledPixels = 0;
            let prevBrightness = null;

            for (let x = 0; x < width; x += sampleRate) {
                const i = (y * width + x) * 4;
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];

                rSum += r;
                gSum += g;
                bSum += b;
                rSquareSum += r * r;
                gSquareSum += g * g;
                bSquareSum += b * b;

                const brightness = (r + g + b) / 3;
                brightnessSum += brightness;

                // 检测边缘
                if (prevBrightness !== null) {
                    const diff = Math.abs(brightness - prevBrightness);
                    if (diff > 20) {
                        edgeCount++;
                    }
                }
                prevBrightness = brightness;

                sampledPixels++;
            }

            const avgR = rSum / sampledPixels;
            const avgG = gSum / sampledPixels;
            const avgB = bSum / sampledPixels;
            const avgBrightness = brightnessSum / sampledPixels;

            const rVariance = (rSquareSum / sampledPixels) - (avgR * avgR);
            const gVariance = (gSquareSum / sampledPixels) - (avgG * avgG);
            const bVariance = (bSquareSum / sampledPixels) - (avgB * avgB);
            const totalVariance = (rVariance + gVariance + bVariance) / 3;
            const edgeDensity = edgeCount / sampledPixels;

            rowFeatures.push({
                y: y,
                avgR: avgR,
                avgG: avgG,
                avgB: avgB,
                avgBrightness: avgBrightness,
                totalVariance: totalVariance,
                edgeDensity: edgeDensity
            });
        }

        return rowFeatures;
    }

    /**
     * 阶段1：检测颜色区域变化
     */
    detectRegionChanges(rowFeatures, config) {
        const boundaries = [];
        const windowSize = config.windowSize;

        for (let i = windowSize; i < rowFeatures.length - windowSize; i++) {
            // 上方窗口
            const topWindow = rowFeatures.slice(i - windowSize, i);
            const topAvgVariance = topWindow.reduce((sum, r) => sum + r.totalVariance, 0) / windowSize;
            const topAvgBrightness = topWindow.reduce((sum, r) => sum + r.avgBrightness, 0) / windowSize;
            const topAvgEdgeDensity = topWindow.reduce((sum, r) => sum + r.edgeDensity, 0) / windowSize;

            // 下方窗口
            const bottomWindow = rowFeatures.slice(i, i + windowSize);
            const bottomAvgVariance = bottomWindow.reduce((sum, r) => sum + r.totalVariance, 0) / windowSize;
            const bottomAvgBrightness = bottomWindow.reduce((sum, r) => sum + r.avgBrightness, 0) / windowSize;
            const bottomAvgEdgeDensity = bottomWindow.reduce((sum, r) => sum + r.edgeDensity, 0) / windowSize;

            // 计算变化
            const varianceChange = Math.abs(bottomAvgVariance - topAvgVariance) / (topAvgVariance + 1);
            const brightnessChange = Math.abs(bottomAvgBrightness - topAvgBrightness);
            const edgeDensityChange = Math.abs(bottomAvgEdgeDensity - topAvgEdgeDensity) / (topAvgEdgeDensity + 0.001);

            // 判断是否为显著变化
            const isSignificantChange = (
                varianceChange > config.varianceChangeThreshold ||
                brightnessChange > config.brightnessChangeThreshold ||
                edgeDensityChange > config.edgeDensityChangeThreshold
            );

            if (isSignificantChange) {
                // 计算变化强度
                const strength = (
                    Math.min(varianceChange / config.varianceChangeThreshold, 1) * 0.4 +
                    Math.min(brightnessChange / config.brightnessChangeThreshold, 1) * 0.3 +
                    Math.min(edgeDensityChange / config.edgeDensityChangeThreshold, 1) * 0.3
                );

                // 判断变化类型
                let type = 'unknown';
                if (bottomAvgVariance < topAvgVariance && bottomAvgEdgeDensity < topAvgEdgeDensity) {
                    type = 'content_to_separator';  // 内容区 → 分隔线
                } else if (bottomAvgVariance > topAvgVariance && bottomAvgEdgeDensity > topAvgEdgeDensity) {
                    type = 'separator_to_content';  // 分隔线 → 内容区
                }

                boundaries.push({
                    position: i,
                    type: type,
                    varianceChange: varianceChange,
                    brightnessChange: brightnessChange,
                    edgeDensityChange: edgeDensityChange,
                    strength: strength,
                    topAvgVariance: topAvgVariance,
                    bottomAvgVariance: bottomAvgVariance,
                    topAvgBrightness: topAvgBrightness,
                    bottomAvgBrightness: bottomAvgBrightness
                });

                // 跳过一些行避免重复检测
                i += Math.floor(windowSize / 2);
            }
        }

        // 按强度排序
        boundaries.sort((a, b) => b.strength - a.strength);

        return boundaries;
    }

    /**
     * 阶段2.1：在边界附近查找分隔线候选
     */
    findSeparatorCandidates(boundaries, rowFeatures, data, width, config) {
        const candidates = [];
        const processed = new Set();

        for (const boundary of boundaries) {
            const centerY = boundary.position;

            // 避免重复处理
            if (processed.has(centerY)) continue;

            // 在边界附近搜索分隔线区域
            const searchRange = config.maxSeparatorHeight;
            const searchStart = Math.max(0, centerY - searchRange);
            const searchEnd = Math.min(rowFeatures.length, centerY + searchRange);

            // 查找方差最小的连续区域
            let bestStart = centerY;
            let bestEnd = centerY;
            let minAvgVariance = Infinity;

            for (let start = searchStart; start < centerY; start++) {
                for (let end = centerY; end <= searchEnd; end++) {
                    const height = end - start;
                    
                    if (height < config.minSeparatorHeight || height > config.maxSeparatorHeight) {
                        continue;
                    }

                    const region = rowFeatures.slice(start, end);
                    const avgVariance = region.reduce((sum, r) => sum + r.totalVariance, 0) / height;

                    if (avgVariance < minAvgVariance) {
                        minAvgVariance = avgVariance;
                        bestStart = start;
                        bestEnd = end;
                    }
                }
            }

            const height = bestEnd - bestStart;
            
            if (height >= config.minSeparatorHeight && height <= config.maxSeparatorHeight) {
                const middle = Math.floor((bestStart + bestEnd) / 2);

                // 标记已处理的区域
                for (let y = bestStart; y < bestEnd; y++) {
                    processed.add(y);
                }

                candidates.push({
                    start: bestStart,
                    end: bestEnd,
                    middle: middle,
                    height: height,
                    boundaryStrength: boundary.strength,
                    boundaryType: boundary.type
                });
            }
        }

        return candidates;
    }

    /**
     * 阶段2.2：验证候选是否为浅灰色
     */
    validateGraySeparators(candidates, data, width, config) {
        const validCandidates = [];
        const sampleRate = Math.max(1, Math.floor(width / 300));

        for (const candidate of candidates) {
            let totalPixels = 0;
            let grayPixels = 0;
            let rSum = 0, gSum = 0, bSum = 0;
            let brightnessSum = 0;
            let varianceSum = 0;
            let colorDiffSum = 0;

            // 采样分隔线区域
            for (let y = candidate.start; y < candidate.end; y++) {
                for (let x = 0; x < width; x += sampleRate) {
                    const i = (y * width + x) * 4;
                    const r = data[i];
                    const g = data[i + 1];
                    const b = data[i + 2];

                    rSum += r;
                    gSum += g;
                    bSum += b;

                    const brightness = (r + g + b) / 3;
                    brightnessSum += brightness;

                    const colorDiff = Math.max(
                        Math.abs(r - g),
                        Math.abs(g - b),
                        Math.abs(r - b)
                    );
                    colorDiffSum += colorDiff;

                    const variance = (
                        Math.pow(r - brightness, 2) +
                        Math.pow(g - brightness, 2) +
                        Math.pow(b - brightness, 2)
                    ) / 3;
                    varianceSum += variance;

                    // 判断是否为浅灰色像素
                    const isGray = (
                        brightness >= config.grayBrightnessMin &&
                        brightness <= config.grayBrightnessMax &&
                        colorDiff <= config.grayColorDiffMax
                    );

                    if (isGray) {
                        grayPixels++;
                    }

                    totalPixels++;
                }
            }

            const avgR = rSum / totalPixels;
            const avgG = gSum / totalPixels;
            const avgB = bSum / totalPixels;
            const avgBrightness = brightnessSum / totalPixels;
            const avgColorDiff = colorDiffSum / totalPixels;
            const avgVariance = Math.sqrt(varianceSum / totalPixels);
            const grayRatio = grayPixels / totalPixels;

            // 验证是否为浅灰色分隔线
            const isValidGraySeparator = (
                grayRatio >= config.minGrayRatio &&
                avgBrightness >= config.grayBrightnessMin &&
                avgBrightness <= config.grayBrightnessMax &&
                avgColorDiff <= config.grayColorDiffMax &&
                avgVariance <= config.grayVarianceMax
            );

            if (isValidGraySeparator) {
                // 计算得分
                const score = this.calculateScoreV7({
                    grayRatio: grayRatio,
                    avgBrightness: avgBrightness,
                    avgColorDiff: avgColorDiff,
                    avgVariance: avgVariance,
                    height: candidate.height,
                    boundaryStrength: candidate.boundaryStrength
                }, config);

                validCandidates.push({
                    start: candidate.start,
                    end: candidate.end,
                    middle: candidate.middle,
                    height: candidate.height,
                    avgR: avgR,
                    avgG: avgG,
                    avgB: avgB,
                    avgBrightness: avgBrightness,
                    avgColorDiff: avgColorDiff,
                    avgVariance: avgVariance,
                    grayRatio: grayRatio,
                    boundaryStrength: candidate.boundaryStrength,
                    score: score
                });
            }
        }

        // 按得分排序
        validCandidates.sort((a, b) => b.score - a.score);

        return validCandidates;
    }

    /**
     * 计算得分（V7版本）
     */
    calculateScoreV7(features, config) {
        let score = 0;

        // 1. 灰色比例得分 (0-30分)
        score += features.grayRatio * 30;

        // 2. 亮度得分 (0-20分) - 越接近理想亮度越好
        const idealBrightness = (config.grayBrightnessMin + config.grayBrightnessMax) / 2;
        const brightnessScore = 1 - Math.abs(features.avgBrightness - idealBrightness) / 
                                    (config.grayBrightnessMax - config.grayBrightnessMin);
        score += Math.max(0, brightnessScore) * 20;

        // 3. 颜色一致性得分 (0-20分) - 颜色差异越小越好
        const colorConsistencyScore = 1 - features.avgColorDiff / config.grayColorDiffMax;
        score += Math.max(0, colorConsistencyScore) * 20;

        // 4. 均匀性得分 (0-15分) - 方差越小越好
        const uniformityScore = 1 - features.avgVariance / config.grayVarianceMax;
        score += Math.max(0, uniformityScore) * 15;

        // 5. 边界强度得分 (0-10分)
        score += features.boundaryStrength * 10;

        // 6. 高度得分 (0-5分)
        const idealHeight = (config.minSeparatorHeight + config.maxSeparatorHeight) / 2;
        const heightScore = 1 - Math.abs(features.height - idealHeight) / config.maxSeparatorHeight;
        score += Math.max(0, heightScore) * 5;

        return score;
    }

    selectByExpectedPages(candidates, expectedPages, imageHeight, config) {
        const splitPoints = [0];

        if (candidates.length === 0) {
            for (let i = 1; i < expectedPages; i++) {
                splitPoints.push(Math.floor(imageHeight * i / expectedPages));
            }
            splitPoints.push(imageHeight);
            return splitPoints;
        }

        const avgPageHeight = imageHeight / expectedPages;
        const selected = [];

        for (let i = 1; i < expectedPages; i++) {
            const expectedY = Math.floor(avgPageHeight * i);
            const searchRange = avgPageHeight * 0.5;

            let bestCandidate = null;
            let bestCombinedScore = -Infinity;

            for (const candidate of candidates) {
                if (selected.includes(candidate)) continue;

                const distance = Math.abs(candidate.middle - expectedY);

                if (distance < searchRange) {
                    const distanceScore = (1 - distance / searchRange) * 100;
                    const combinedScore = candidate.score * 0.7 + distanceScore * 0.3;

                    if (combinedScore > bestCombinedScore) {
                        bestCombinedScore = combinedScore;
                        bestCandidate = candidate;
                    }
                }
            }

            if (bestCandidate) {
                selected.push(bestCandidate);
            } else {
                let nearestCandidate = null;
                let minDistance = Infinity;

                for (const candidate of candidates) {
                    if (selected.includes(candidate)) continue;

                    const distance = Math.abs(candidate.middle - expectedY);
                    if (distance < minDistance && distance < avgPageHeight * 0.8) {
                        minDistance = distance;
                        nearestCandidate = candidate;
                    }
                }

                if (nearestCandidate) {
                    selected.push(nearestCandidate);
                } else {
                    selected.push({ middle: expectedY, synthetic: true });
                }
            }
        }

        selected.sort((a, b) => a.middle - b.middle);

        for (const region of selected) {
            splitPoints.push(region.middle);
        }

        splitPoints.push(imageHeight);

        return splitPoints;
    }

    selectAutomatically(candidates, imageHeight, config) {
        if (candidates.length === 0) {
            return [0, imageHeight];
        }

        // 分析候选分隔线的分布，估算页数
        const estimatedPages = this.estimatePageCount(candidates, imageHeight);

        // 使用估算的页数来选择分割点
        const splitPoints = this.selectByExpectedPages(candidates, estimatedPages, imageHeight, config);

        // 如果结果太少，尝试降低阈值
        if (splitPoints.length < 3) {
            return this.selectWithLowerThreshold(candidates, imageHeight, config);
        }

        return splitPoints;
    }

    // 根据候选分隔线估算页数
    estimatePageCount(candidates, imageHeight) {
        if (candidates.length === 0) return 2;

        // 获取所有分隔线的位置
        const positions = candidates.map(c => c.middle).sort((a, b) => a - b);

        // 计算相邻分隔线的间距
        const gaps = [];
        let lastPos = 0;
        for (const pos of positions) {
            gaps.push(pos - lastPos);
            lastPos = pos;
        }
        gaps.push(imageHeight - lastPos);

        // 过滤异常间距（太小的可能是误检）
        const validGaps = gaps.filter(g => g > imageHeight * 0.02);

        if (validGaps.length === 0) return 2;

        // 计算中位数间距
        validGaps.sort((a, b) => a - b);
        const medianGap = validGaps[Math.floor(validGaps.length / 2)];

        // 估算页数 = 总高度 / 中位数间距
        let estimatedPages = Math.round(imageHeight / medianGap);

        // 限制在合理范围内
        estimatedPages = Math.max(2, Math.min(estimatedPages, 50));

        return estimatedPages;
    }

    // 使用更低的阈值重试
    selectWithLowerThreshold(candidates, imageHeight, config) {
        const splitPoints = [0];
        let lastPoint = 0;

        // 动态降低阈值
        for (let threshold = 45; threshold >= 20; threshold -= 5) {
            const selected = [];

            for (const candidate of candidates) {
                if (candidate.score >= threshold && candidate.middle - lastPoint >= config.minPageHeight) {
                    selected.push(candidate.middle);
                    lastPoint = candidate.middle;
                }
            }

            // 如果找到足够的分割点，使用这个阈值的结果
            if (selected.length >= 2) {
                splitPoints.push(...selected);
                break;
            }

            // 重置并尝试更低的阈值
            lastPoint = 0;
        }

        splitPoints.push(imageHeight);

        // 如果还是太少，使用等间距分割
        if (splitPoints.length < 3) {
            return this.selectByExpectedPages(candidates, 4, imageHeight, config);
        }

        return splitPoints;
    }

    /**
     * 生成页面信息
     */
    generatePageInfo(splitPoints, imageHeight) {
        const pages = [];
        
        for (let i = 0; i < splitPoints.length - 1; i++) {
            const start = splitPoints[i];
            const end = splitPoints[i + 1];
            const height = end - start;
            const percentage = ((height / imageHeight) * 100).toFixed(1);
            
            pages.push({
                页面: i + 1,
                起始: start,
                结束: end,
                高度: height,
                占比: percentage + '%'
            });
        }

        return pages;
    }
}

if (typeof window !== 'undefined') {
    window.GraySeparatorDetector = GraySeparatorDetector;
}
