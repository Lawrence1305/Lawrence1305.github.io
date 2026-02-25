/**
 * 灰色分隔线专用检测器（改进版）
 * 严格参考用户指定的页数，提高准确性
 */
class GraySeparatorDetector {
    constructor() {
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.debugMode = false;
        this.debugCallback = null;
    }

    /**
     * 设置调试模式
     */
    setDebugMode(enabled, callback = null) {
        this.debugMode = enabled;
        this.debugCallback = callback;
    }

    /**
     * 调试日志
     */
    debug(message, data = null, type = 'info') {
        if (this.debugMode) {
            const icon = {
                'info': '🔍',
                'success': '✓',
                'warning': '⚠️',
                'error': '❌',
                'header': '═══'
            }[type] || '•';
            
            if (data) {
                console.log(`${icon} ${message}`, data);
            } else {
                console.log(`${icon} ${message}`);
            }
            
            if (this.debugCallback) {
                this.debugCallback(message, data, type);
            }
        }
    }

    /**
     * 检测灰色分隔线
     */
    detect(img, expectedPages = 0, options = {}) {
        this.debug('========== 灰色分隔线检测 (改进版) ==========', null, 'header');
        this.debug(`图片尺寸: ${img.width}x${img.height}px`, null, 'info');
        this.debug(`期望页数: ${expectedPages === 0 ? '自动检测' : expectedPages}`, null, 'info');

        // 默认参数
        const config = {
            minSeparatorHeight: options.minSeparatorHeight || 5,
            maxSeparatorHeight: options.maxSeparatorHeight || 50,
            minPageHeight: options.minPageHeight || Math.floor(img.height * 0.03),
            grayTolerance: options.grayTolerance || 30,  // 灰色容差
            uniformThreshold: options.uniformThreshold || 20,  // 均匀性阈值
            ...options
        };

        this.debug('检测参数', config, 'info');

        // 准备Canvas
        this.canvas.width = img.width;
        this.canvas.height = img.height;
        this.ctx.drawImage(img, 0, 0);

        const imageData = this.ctx.getImageData(0, 0, img.width, img.height);
        const data = imageData.data;

        // 第一步：分析每一行
        this.debug('步骤1: 分析每一行特征...', null, 'info');
        const rowFeatures = this.analyzeRows(data, img.width, img.height);
        
        // 第二步：查找所有可能的分隔线区域
        this.debug('步骤2: 查找分隔线候选区域...', null, 'info');
        const candidates = this.findSeparatorCandidates(rowFeatures, config);
        this.debug(`找到 ${candidates.length} 个候选区域`, null, 'info');

        if (candidates.length > 0) {
            this.debug('候选区域（前20个）', candidates.slice(0, 20).map(c => ({
                位置: c.middle,
                起始: c.start,
                结束: c.end,
                高度: c.height,
                得分: c.score.toFixed(2),
                灰色比例: (c.grayRatio * 100).toFixed(1) + '%',
                均匀度: c.uniformity.toFixed(2)
            })), 'info');
        }

        // 第三步：根据期望页数选择最佳分割点
        this.debug('步骤3: 选择最佳分割点...', null, 'info');
        let splitPoints;
        
        if (expectedPages > 0) {
            // 用户指定了页数，严格按照页数选择
            splitPoints = this.selectByExpectedPages(candidates, expectedPages, img.height, config);
        } else {
            // 自动检测模式
            splitPoints = this.selectAutomatically(candidates, img.height, config);
        }

        this.debug(`最终选择 ${splitPoints.length - 2} 个分割点`, null, 'success');
        this.debug('分割点位置', splitPoints, 'success');

        // 生成页面信息
        const pages = this.generatePageInfo(splitPoints, img.height);
        this.debug('页面分布', pages, 'success');

        this.debug('========== 检测完成 ==========', null, 'header');

        return splitPoints;
    }

    /**
     * 分析每一行的特征
     */
    analyzeRows(data, width, height) {
        const rowFeatures = [];
        const sampleRate = Math.max(1, Math.floor(width / 100)); // 采样率，加快处理速度

        for (let y = 0; y < height; y++) {
            let rSum = 0, gSum = 0, bSum = 0;
            let grayPixelCount = 0;
            let sampledPixels = 0;
            let minBrightness = 255;
            let maxBrightness = 0;
            let varianceSum = 0;

            // 采样这一行
            for (let x = 0; x < width; x += sampleRate) {
                const i = (y * width + x) * 4;
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];

                rSum += r;
                gSum += g;
                bSum += b;

                const brightness = (r + g + b) / 3;
                minBrightness = Math.min(minBrightness, brightness);
                maxBrightness = Math.max(maxBrightness, brightness);

                // 判断是否为灰色像素
                const colorDiff = Math.max(
                    Math.abs(r - g),
                    Math.abs(g - b),
                    Math.abs(r - b)
                );

                if (colorDiff < 30) {
                    grayPixelCount++;
                }

                // 计算方差
                const avgRGB = brightness;
                const variance = (
                    Math.pow(r - avgRGB, 2) +
                    Math.pow(g - avgRGB, 2) +
                    Math.pow(b - avgRGB, 2)
                ) / 3;
                varianceSum += variance;

                sampledPixels++;
            }

            const avgR = rSum / sampledPixels;
            const avgG = gSum / sampledPixels;
            const avgB = bSum / sampledPixels;
            const avgBrightness = (avgR + avgG + avgB) / 3;
            const grayRatio = grayPixelCount / sampledPixels;
            const brightnessRange = maxBrightness - minBrightness;
            const avgVariance = Math.sqrt(varianceSum / sampledPixels);

            // 判断是否为均匀行
            const isUniform = brightnessRange < 30 && avgVariance < 20;
            
            // 判断是否为灰色行
            const isGrayRow = grayRatio > 0.7 && avgBrightness > 80 && avgBrightness < 220;

            rowFeatures.push({
                y: y,
                avgR: avgR,
                avgG: avgG,
                avgB: avgB,
                avgBrightness: avgBrightness,
                grayRatio: grayRatio,
                brightnessRange: brightnessRange,
                avgVariance: avgVariance,
                isUniform: isUniform,
                isGrayRow: isGrayRow
            });
        }

        return rowFeatures;
    }

    /**
     * 查找分隔线候选区域
     */
    findSeparatorCandidates(rowFeatures, config) {
        const candidates = [];
        let inSeparator = false;
        let separatorStart = 0;

        for (let i = 0; i < rowFeatures.length; i++) {
            const row = rowFeatures[i];

            // 进入分隔线区域的条件：灰色且均匀
            if (row.isGrayRow && row.isUniform && !inSeparator) {
                inSeparator = true;
                separatorStart = i;
            }
            // 离开分隔线区域
            else if ((!row.isGrayRow || !row.isUniform) && inSeparator) {
                inSeparator = false;
                const separatorEnd = i;
                const height = separatorEnd - separatorStart;

                // 检查高度是否符合要求
                if (height >= config.minSeparatorHeight && height <= config.maxSeparatorHeight) {
                    const middle = Math.floor((separatorStart + separatorEnd) / 2);

                    // 计算这个区域的特征
                    let avgGrayRatio = 0;
                    let avgUniformity = 0;
                    let avgBrightness = 0;

                    for (let j = separatorStart; j < separatorEnd; j++) {
                        avgGrayRatio += rowFeatures[j].grayRatio;
                        avgUniformity += (rowFeatures[j].isUniform ? 1 : 0);
                        avgBrightness += rowFeatures[j].avgBrightness;
                    }

                    avgGrayRatio /= height;
                    avgUniformity /= height;
                    avgBrightness /= height;

                    // 计算得分
                    const score = this.calculateScore({
                        grayRatio: avgGrayRatio,
                        uniformity: avgUniformity,
                        brightness: avgBrightness,
                        height: height
                    }, config);

                    candidates.push({
                        start: separatorStart,
                        end: separatorEnd,
                        middle: middle,
                        height: height,
                        grayRatio: avgGrayRatio,
                        uniformity: avgUniformity,
                        avgBrightness: avgBrightness,
                        score: score
                    });
                }
            }
        }

        // 按得分排序
        candidates.sort((a, b) => b.score - a.score);

        return candidates;
    }

    /**
     * 计算候选区域的得分
     */
    calculateScore(features, config) {
        let score = 0;

        // 灰色比例得分 (0-40分)
        score += features.grayRatio * 40;

        // 均匀性得分 (0-30分)
        score += features.uniformity * 30;

        // 亮度得分 (0-20分) - 偏好中等亮度
        const brightnessPenalty = Math.abs(features.brightness - 150) / 150;
        score += (1 - brightnessPenalty) * 20;

        // 高度得分 (0-10分) - 偏好较小的高度
        const heightScore = Math.max(0, 1 - features.height / config.maxSeparatorHeight);
        score += heightScore * 10;

        return score;
    }

    /**
     * 根据期望页数选择分割点
     */
    selectByExpectedPages(candidates, expectedPages, imageHeight, config) {
        this.debug(`用户期望 ${expectedPages} 个页面，需要 ${expectedPages - 1} 个分割点`, null, 'info');

        const splitPoints = [0];
        const needSeparators = expectedPages - 1;

        if (candidates.length === 0) {
            this.debug('⚠️ 没有找到候选区域，使用均匀分割', null, 'warning');
            // 均匀分割
            for (let i = 1; i < expectedPages; i++) {
                splitPoints.push(Math.floor(imageHeight * i / expectedPages));
            }
            splitPoints.push(imageHeight);
            return splitPoints;
        }

        if (candidates.length < needSeparators) {
            this.debug(`⚠️ 候选区域不足 (找到${candidates.length}个，需要${needSeparators}个)`, null, 'warning');
        }

        // 策略：选择得分最高的N个候选区域
        const selected = [];
        
        for (const candidate of candidates) {
            // 检查是否与已选择的区域太近
            const tooClose = selected.some(s => Math.abs(s.middle - candidate.middle) < config.minPageHeight);
            
            if (!tooClose) {
                selected.push(candidate);
                
                if (selected.length >= needSeparators) {
                    break;
                }
            }
        }

        // 如果还不够，使用均匀分割补充
        if (selected.length < needSeparators) {
            this.debug(`⚠️ 只找到 ${selected.length} 个有效分割点，使用混合策略`, null, 'warning');
            
            // 计算平均页面高度
            const avgPageHeight = imageHeight / expectedPages;
            
            // 在缺失的位置添加分割点
            for (let i = 1; i < expectedPages; i++) {
                const expectedY = Math.floor(avgPageHeight * i);
                
                // 检查这个位置附近是否已有分割点
                const hasNearby = selected.some(s => Math.abs(s.middle - expectedY) < avgPageHeight * 0.3);
                
                if (!hasNearby) {
                    // 在这个位置附近找最佳候选
                    let bestCandidate = null;
                    let minDistance = Infinity;
                    
                    for (const candidate of candidates) {
                        const distance = Math.abs(candidate.middle - expectedY);
                        if (distance < minDistance && distance < avgPageHeight * 0.4) {
                            minDistance = distance;
                            bestCandidate = candidate;
                        }
                    }
                    
                    if (bestCandidate && !selected.includes(bestCandidate)) {
                        selected.push(bestCandidate);
                    } else {
                        // 没有找到合适的候选，使用预期位置
                        selected.push({
                            middle: expectedY,
                            start: expectedY - 5,
                            end: expectedY + 5,
                            score: 0,
                            synthetic: true
                        });
                    }
                }
            }
        }

        // 按位置排序
        selected.sort((a, b) => a.middle - b.middle);

        // 只取需要的数量
        const finalSelected = selected.slice(0, needSeparators);

        for (const region of finalSelected) {
            splitPoints.push(region.middle);
            this.debug(`选择分割点: ${region.middle} (得分: ${region.score.toFixed(2)})`, null, 'success');
        }

        splitPoints.push(imageHeight);

        return splitPoints;
    }

    /**
     * 自动检测模式
     */
    selectAutomatically(candidates, imageHeight, config) {
        this.debug('自动检测模式', null, 'info');

        const splitPoints = [0];
        const minScore = 60; // 最低得分阈值

        let lastPoint = 0;

        for (const candidate of candidates) {
            // 检查得分和距离
            if (candidate.score >= minScore && 
                candidate.middle - lastPoint >= config.minPageHeight) {
                
                splitPoints.push(candidate.middle);
                lastPoint = candidate.middle;
                
                this.debug(`选择分割点: ${candidate.middle} (得分: ${candidate.score.toFixed(2)})`, null, 'success');
            }
        }

        splitPoints.push(imageHeight);

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
