class ImageProcessor {
    constructor() {
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

    async process(file, sensitivity, progressCallback, detectionMode = 'auto') {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    try {
                        const canvas = document.createElement('canvas');
                        canvas.width = img.width;
                        canvas.height = img.height;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0);

                        const imageData = ctx.getImageData(0, 0, img.width, img.height);
                        const data = imageData.data;

                        progressCallback(30, '分析图像...');

                        const splitPoints = this.detectSplitPoints(data, img.width, img.height, sensitivity, detectionMode);

                        progressCallback(60, '裁剪页面...');

                        const pages = this.splitImage(img, splitPoints);

                        progressCallback(100, '完成');
                        resolve(pages);
                    } catch (error) {
                        reject(error);
                    }
                };
                img.onerror = () => reject(new Error('图片加载失败'));
                img.src = e.target.result;
            };
            reader.onerror = () => reject(new Error('文件读取失败'));
            reader.readAsDataURL(file);
        });
    }

    detectSplitPoints(data, width, height, sensitivity, mode) {
        const s = sensitivity / 10;  // 归一化到 1-10 范围，等价旧版
        switch (mode) {
            case 'gradient':
                return this.detectByGradient(data, width, height, s);
            case 'edge':
                return this.detectByEdge(data, width, height, s);
            case 'projection':
                return this.detectByProjection(data, width, height, s);
            case 'color':
                return this.detectByColorChange(data, width, height, s);
            case 'hybrid':
                return this.detectByHybrid(data, width, height, s);
            case 'auto':
            default:
                return this.detectByBrightness(data, width, height, s);
        }
    }

    // 原始亮度阈值检测
    detectByBrightness(data, width, height, sensitivity) {
        const splitPoints = [0];
        // 灵敏度越高，阈值越低，检测越灵敏
        const brightnessThreshold = 210 - sensitivity * 5; // 范围: 160-205

        let prevBrightness = null;
        let transitions = [];

        for (let y = 0; y < height; y++) {
            const avgBrightness = this.getRowBrightness(data, width, y);

            if (prevBrightness !== null) {
                if (avgBrightness > brightnessThreshold && prevBrightness < brightnessThreshold ||
                    avgBrightness < brightnessThreshold && prevBrightness > brightnessThreshold) {
                    transitions.push(y);
                }
            }
            prevBrightness = avgBrightness;
        }

        return this.filterSplitPoints(transitions, splitPoints, height, sensitivity);
    }

    // 梯度变化检测
    detectByGradient(data, width, height, sensitivity) {
        const splitPoints = [0];
        // 灵敏度越高，阈值越低，检测越灵敏
        const threshold = 30 - sensitivity * 2.5; // 范围: 5-27.5
        const minGap = Math.max(3, height / (20 + sensitivity * 2)); // 灵敏度越高，间距要求越小

        let prevBrightness = null;
        let transitions = [];

        for (let y = 0; y < height; y++) {
            const avgBrightness = this.getRowBrightness(data, width, y);

            if (prevBrightness !== null) {
                const gradient = Math.abs(avgBrightness - prevBrightness);
                if (gradient > threshold / 10) {
                    transitions.push({ y, gradient });
                }
            }
            prevBrightness = avgBrightness;
        }

        // 聚类相近的转换点
        const clustered = this.clusterTransitions(transitions, minGap);

        for (const t of clustered) {
            if (t.y - splitPoints[splitPoints.length - 1] > minGap) {
                splitPoints.push(t.y);
            }
        }

        splitPoints.push(height);
        return splitPoints;
    }

    // 边缘检测 (Sobel算子)
    detectByEdge(data, width, height, sensitivity) {
        const splitPoints = [0];
        // 灵敏度越高，阈值越低，检测越灵敏
        const threshold = 15 - sensitivity * 1.2; // 范围: 3-13
        // 灵敏度越高，间距要求越小
        const minGapRatio = 30 - sensitivity * 2;

        // 计算每行的边缘强度
        const edgeStrengths = [];
        for (let y = 1; y < height - 1; y++) {
            let edgeSum = 0;
            for (let x = 1; x < width - 1; x++) {
                // 简化Sobel: 上下像素差异
                const iAbove = ((y - 1) * width + x) * 4;
                const iBelow = ((y + 1) * width + x) * 4;

                const brightnessAbove = (data[iAbove] + data[iAbove + 1] + data[iAbove + 2]) / 3;
                const brightnessBelow = (data[iBelow] + data[iBelow + 1] + data[iBelow + 2]) / 3;

                edgeSum += Math.abs(brightnessBelow - brightnessAbove);
            }
            edgeStrengths.push({ y, strength: edgeSum / width });
        }

        // 找边缘峰值
        const peaks = this.findPeaks(edgeStrengths, threshold, height);

        for (const peak of peaks) {
            if (peak - splitPoints[splitPoints.length - 1] > height / minGapRatio) {
                splitPoints.push(peak);
            }
        }

        splitPoints.push(height);
        return splitPoints;
    }

    // 垂直投影检测
    detectByProjection(data, width, height, sensitivity) {
        // 计算每列的黑色像素比例（假设页面间有白色间隙）
        const colProjections = [];
        for (let x = 0; x < width; x++) {
            let darkPixels = 0;
            for (let y = 0; y < height; y++) {
                const i = (y * width + x) * 4;
                const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
                if (brightness > 220) darkPixels++;
            }
            colProjections.push(darkPixels / height);
        }

        // 找低投影区域（白色间隙）
        const lowRegions = [];
        let inLowRegion = false;
        let regionStart = 0;

        for (let x = 0; x < width; x++) {
            if (colProjections[x] < 0.3 && !inLowRegion) {
                inLowRegion = true;
                regionStart = x;
            } else if (colProjections[x] >= 0.3 && inLowRegion) {
                inLowRegion = false;
                const regionWidth = x - regionStart;
                if (regionWidth > width * 0.02) {
                    lowRegions.push({ start: regionStart, end: x, width: regionWidth });
                }
            }
        }

        // 如果找到垂直白色间隙，使用列投影
        if (lowRegions.length >= 2) {
            const rowProjections = [];
            for (let y = 0; y < height; y++) {
                let whitePixels = 0;
                for (let x = 0; x < width; x++) {
                    const i = (y * width + x) * 4;
                    const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
                    if (brightness > 200) whitePixels++;
                }
                rowProjections.push(whitePixels / width);
            }

            let transitions = [];
            // 灵敏度越高，阈值越低
            const diffThreshold = 0.3 - sensitivity * 0.025; // 范围: 0.05-0.25

            for (let y = 1; y < height; y++) {
                const diff = Math.abs(rowProjections[y] - rowProjections[y - 1]);
                if (diff > diffThreshold) {
                    transitions.push(y);
                }
            }

            return this.filterSplitPoints(transitions, [0], height, sensitivity);
        }

        // 回退到亮度检测
        return this.detectByBrightness(data, width, height, 5);
    }

    // 颜色变化检测
    detectByColorChange(data, width, height, sensitivity) {
        const splitPoints = [0];
        // 灵敏度越高，阈值越低，检测越灵敏
        const colorThreshold = 50 - sensitivity * 4; // 范围: 10-46

        let prevColor = null;
        let transitions = [];

        for (let y = 0; y < height; y++) {
            const color = this.getRowColor(data, width, y);

            if (prevColor) {
                const colorDiff = this.colorDistance(color, prevColor);
                if (colorDiff > colorThreshold) {
                    transitions.push(y);
                }
            }
            prevColor = color;
        }

        return this.filterSplitPoints(transitions, splitPoints, height, sensitivity);
    }

    // 混合检测 - 结合多种方法
    detectByHybrid(data, width, height, sensitivity) {
        // 获取多种检测结果
        const brightnessResult = this.detectByBrightness(data, width, height, sensitivity);
        const gradientResult = this.detectByGradient(data, width, height, sensitivity);
        const edgeResult = this.detectByEdge(data, width, height, sensitivity);

        // 合并结果（投票机制）
        const allPoints = new Set();

        [brightnessResult, gradientResult, edgeResult].forEach(result => {
            result.forEach(p => allPoints.add(p));
        });

        const pointCounts = {};
        allPoints.forEach(point => {
            pointCounts[point] = 0;
            [brightnessResult, gradientResult, edgeResult].forEach(result => {
                // 检查是否接近某个点
                for (const p of result) {
                    if (Math.abs(p - point) < height / 30) {
                        pointCounts[point]++;
                        break;
                    }
                }
            });
        });

        // 保留被至少两种方法支持的点
        const splitPoints = [0];
        let lastPoint = 0;

        const sortedPoints = Array.from(allPoints).sort((a, b) => a - b);
        for (const point of sortedPoints) {
            if (pointCounts[point] >= 2 && point - lastPoint > height / 20) {
                splitPoints.push(point);
                lastPoint = point;
            }
        }

        splitPoints.push(height);
        return splitPoints;
    }

    // 辅助方法：获取行亮度
    getRowBrightness(data, width, row) {
        let brightnessSum = 0;
        const sampleRate = Math.max(1, Math.floor(width / 100));

        for (let x = 0; x < width; x += sampleRate) {
            const i = (row * width + x) * 4;
            brightnessSum += (data[i] + data[i + 1] + data[i + 2]) / 3;
        }

        return brightnessSum / Math.ceil(width / sampleRate);
    }

    // 辅助方法：获取行颜色
    getRowColor(data, width, row) {
        let rSum = 0, gSum = 0, bSum = 0;
        const sampleRate = Math.max(1, Math.floor(width / 50));

        for (let x = 0; x < width; x += sampleRate) {
            const i = (row * width + x) * 4;
            rSum += data[i];
            gSum += data[i + 1];
            bSum += data[i + 2];
        }

        const count = Math.ceil(width / sampleRate);
        return { r: rSum / count, g: gSum / count, b: bSum / count };
    }

    // 辅助方法：计算颜色距离
    colorDistance(c1, c2) {
        return Math.sqrt(
            Math.pow(c1.r - c2.r, 2) +
            Math.pow(c1.g - c2.g, 2) +
            Math.pow(c1.b - c2.b, 2)
        );
    }

    // 辅助方法：聚类转换点
    clusterTransitions(transitions, minGap) {
        if (transitions.length === 0) return [];

        const clustered = [];
        let current = { y: transitions[0].y, gradient: transitions[0].gradient };

        for (let i = 1; i < transitions.length; i++) {
            if (transitions[i].y - current.y < minGap) {
                current.gradient = Math.max(current.gradient, transitions[i].gradient);
            } else {
                clustered.push(current);
                current = { y: transitions[i].y, gradient: transitions[i].gradient };
            }
        }
        clustered.push(current);

        return clustered;
    }

    // 辅助方法：找峰值
    findPeaks(values, threshold, height) {
        const peaks = [];
        const windowSize = Math.max(3, Math.floor(height / 100));

        for (let i = windowSize; i < values.length - windowSize; i++) {
            const current = values[i].strength;
            let isPeak = true;

            for (let j = 1; j <= windowSize; j++) {
                if (values[i - j].strength >= current || values[i + j].strength >= current) {
                    isPeak = false;
                    break;
                }
            }

            if (isPeak && current > threshold) {
                peaks.push(values[i].y);
            }
        }

        return peaks;
    }

    // 辅助方法：过滤分割点
    filterSplitPoints(transitions, splitPoints, height, sensitivity = 5) {
        if (transitions.length > 0) {
            // 灵敏度越高，minGap越小，允许检测到更多分割点
            const minGap = height / (15 + sensitivity); // 范围: height/25 - height/16
            let lastY = 0;
            for (const y of transitions) {
                if (y - lastY > minGap) {
                    splitPoints.push(y);
                    lastY = y;
                }
            }
        }

        splitPoints.push(height);
        return splitPoints;
    }

    splitImage(image, splitPoints) {
        if (!splitPoints || splitPoints.length === 0) {
            return [this.imageToDataURL(image, 0, 0, image.width, image.height)];
        }

        const pages = [];
        for (let i = 0; i < splitPoints.length - 1; i++) {
            const y = splitPoints[i];
            const h = splitPoints[i + 1] - y;
            if (h > 0) {
                pages.push(this.imageToDataURL(image, 0, y, image.width, h));
            }
        }
        return pages;
    }

    imageToDataURL(image, x, y, width, height) {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(image, x, y, width, height, 0, 0, width, height);
        return canvas.toDataURL('image/png');
    }
}

if (typeof window !== 'undefined') {
    window.ImageProcessor = ImageProcessor;
}
