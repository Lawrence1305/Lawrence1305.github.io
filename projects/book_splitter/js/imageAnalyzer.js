class ImageAnalyzer {
    constructor() {
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');
    }

    /**
     * 验证图片是否正常加载
     */
    async validateImage(img, debugCallback) {
        const log = (msg, data, type) => {
            if (debugCallback) debugCallback(msg, data, type);
        };

        log('正在验证图片...', null, 'info');

        // 创建小尺寸测试
        const testCanvas = document.createElement('canvas');
        const testCtx = testCanvas.getContext('2d');
        testCanvas.width = Math.min(100, img.width);
        testCanvas.height = Math.min(100, img.height);

        try {
            testCtx.drawImage(img, 0, 0, testCanvas.width, testCanvas.height);
            const testData = testCtx.getImageData(0, 0, testCanvas.width, testCanvas.height);
            
            // 检查是否全黑
            let hasColor = false;
            for (let i = 0; i < testData.data.length; i += 4) {
                if (testData.data[i] > 0 || testData.data[i+1] > 0 || testData.data[i+2] > 0) {
                    hasColor = true;
                    break;
                }
            }

            if (!hasColor) {
                log('❌ 图片验证失败: 图片数据全黑', null, 'error');
                log('可能原因:', [
                    {原因: '图片文件损坏', 解决方案: '重新导出图片'},
                    {原因: '浏览器不支持此格式', 解决方案: '转换为标准JPG/PNG'},
                    {原因: 'Canvas渲染失败', 解决方案: '尝试缩小图片尺寸'}
                ], 'error');
                return false;
            }

            log('✓ 图片验证通过', null, 'success');
            
            // 显示采样像素
            const samplePixels = [];
            for (let i = 0; i < Math.min(5, testData.data.length); i += 4) {
                samplePixels.push({
                    位置: Math.floor(i/4),
                    R: testData.data[i],
                    G: testData.data[i+1],
                    B: testData.data[i+2],
                    A: testData.data[i+3]
                });
            }
            log('采样像素值', samplePixels, 'info');

            return true;
        } catch (error) {
            log(`❌ 图片验证失败: ${error.message}`, null, 'error');
            return false;
        }
    }

    /**
     * 分析图片并生成可视化报告
     */
    async analyze(file, debugCallback) {
        const log = (msg, data, type) => {
            if (debugCallback) debugCallback(msg, data, type);
        };

        log('========== 开始分析图片 ==========', null, 'header');

        // 加载图片
        const img = await this.loadImage(file);
        log(`图片尺寸: ${img.width}x${img.height}px`, null, 'info');
        log(`文件大小: ${(file.size / 1024 / 1024).toFixed(2)} MB`, null, 'info');
        log(`文件类型: ${file.type}`, null, 'info');

        // 验证图片
        const isValid = await this.validateImage(img, debugCallback);
        if (!isValid) {
            log('========== 分析终止 ==========', null, 'header');
            throw new Error('图片验证失败，无法继续分析');
        }

        // 检查图片尺寸是否过大
        const totalPixels = img.width * img.height;
        const maxPixels = 200000000; // 2亿像素限制
        
        if (totalPixels > maxPixels) {
            log(`⚠️ 警告: 图片像素过多 (${(totalPixels/1000000).toFixed(1)}M 像素)`, null, 'warning');
            log('建议: 先缩小图片尺寸再处理', null, 'warning');
        }

        // 尝试设置Canvas
        try {
            this.canvas.width = img.width;
            this.canvas.height = img.height;
            log(`Canvas尺寸设置: ${this.canvas.width}x${this.canvas.height}`, null, 'success');
        } catch (error) {
            log(`❌ Canvas设置失败: ${error.message}`, null, 'error');
            throw new Error('图片太大，浏览器无法处理。请缩小图片后重试。');
        }

        // 绘制图片
        try {
            this.ctx.drawImage(img, 0, 0);
            log('✓ 图片已绘制到Canvas', null, 'success');
        } catch (error) {
            log(`❌ 图片绘制失败: ${error.message}`, null, 'error');
            throw new Error('图片绘制失败，可能是内存不足');
        }

        // 获取图片数据
        let imageData;
        try {
            imageData = this.ctx.getImageData(0, 0, img.width, img.height);
            log(`✓ 成功获取图片数据 (${(imageData.data.length / 1024 / 1024).toFixed(2)} MB)`, null, 'success');
        } catch (error) {
            log(`❌ 获取图片数据失败: ${error.message}`, null, 'error');
            throw new Error('无法读取图片数据，可能是内存不足');
        }

        const data = imageData.data;

        log('正在分析像素数据...', null, 'info');

        // 智能采样
        const sampleRate = Math.min(10, Math.max(1, Math.floor(img.height / 10000)));
        log(`采样率: 每 ${sampleRate} 行`, null, 'info');

        const analysis = {
            rows: [],
            stats: {
                minBrightness: 255,
                maxBrightness: 0,
                avgBrightness: 0,
                minVariance: Infinity,
                maxVariance: 0,
                avgVariance: 0,
                totalRows: 0
            }
        };

        let totalBrightness = 0;
        let totalVariance = 0;
        let sampleCount = 0;

        const batchSize = 1000;
        let processedRows = 0;

        for (let y = 0; y < img.height; y += sampleRate) {
            let rSum = 0, gSum = 0, bSum = 0;
            let brightnessSum = 0;
            let colorVariance = 0;
            let grayCount = 0;
            let whiteCount = 0;
            let blackCount = 0;

            for (let x = 0; x < img.width; x++) {
                const i = (y * img.width + x) * 4;
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
                colorVariance += colorDiff;

                if (colorDiff < 30 && brightness > 100 && brightness < 230) {
                    grayCount++;
                }
                if (brightness > 240) {
                    whiteCount++;
                }
                if (brightness < 15) {
                    blackCount++;
                }
            }

            const avgR = rSum / img.width;
            const avgG = gSum / img.width;
            const avgB = bSum / img.width;
            const avgBrightness = brightnessSum / img.width;
            const avgVariance = colorVariance / img.width;
            const grayRatio = grayCount / img.width;
            const whiteRatio = whiteCount / img.width;
            const blackRatio = blackCount / img.width;

            analysis.rows.push({
                y: y,
                r: avgR,
                g: avgG,
                b: avgB,
                brightness: avgBrightness,
                variance: avgVariance,
                grayRatio: grayRatio,
                whiteRatio: whiteRatio,
                blackRatio: blackRatio
            });

            analysis.stats.minBrightness = Math.min(analysis.stats.minBrightness, avgBrightness);
            analysis.stats.maxBrightness = Math.max(analysis.stats.maxBrightness, avgBrightness);
            analysis.stats.minVariance = Math.min(analysis.stats.minVariance, avgVariance);
            analysis.stats.maxVariance = Math.max(analysis.stats.maxVariance, avgVariance);

            totalBrightness += avgBrightness;
            totalVariance += avgVariance;
            sampleCount++;
            processedRows++;

            if (processedRows % batchSize === 0) {
                await new Promise(resolve => setTimeout(resolve, 0));
                log(`已分析 ${processedRows}/${Math.ceil(img.height / sampleRate)} 行 (${((processedRows / Math.ceil(img.height / sampleRate)) * 100).toFixed(1)}%)`, null, 'info');
            }
        }

        analysis.stats.avgBrightness = totalBrightness / sampleCount;
        analysis.stats.avgVariance = totalVariance / sampleCount;
        analysis.stats.totalRows = sampleCount;

        log('✓ 像素分析完成', null, 'success');

        // 输出统计信息
        const statsTable = [{
            指标: '亮度范围',
            最小值: analysis.stats.minBrightness.toFixed(2),
            最大值: analysis.stats.maxBrightness.toFixed(2),
            平均值: analysis.stats.avgBrightness.toFixed(2),
            差值: (analysis.stats.maxBrightness - analysis.stats.minBrightness).toFixed(2)
        }, {
            指标: '颜色方差',
            最小值: analysis.stats.minVariance.toFixed(2),
            最大值: analysis.stats.maxVariance.toFixed(2),
            平均值: analysis.stats.avgVariance.toFixed(2),
            差值: (analysis.stats.maxVariance - analysis.stats.minVariance).toFixed(2)
        }];

        log('图片统计信息', statsTable, 'info');

        // 检查图片是否有效
        if (analysis.stats.maxBrightness === 0 && analysis.stats.minBrightness === 0) {
            log('❌ 图片数据异常: 所有像素值为0', null, 'error');
            const diagnosis = [{
                问题: 'Canvas读取失败',
                可能原因: '1. 图片格式不兼容\n2. 浏览器内存不足\n3. 图片文件损坏',
                建议: '1. 将图片转换为标准JPG格式\n2. 缩小图片尺寸\n3. 使用其他浏览器尝试'
            }];
            log('诊断结果', diagnosis, 'error');
            return analysis;
        }

        // 检测可能的分隔线
        log('正在检测可能的分隔区域...', null, 'info');
        const possibleSeparators = this.detectPossibleSeparators(analysis);
        
        if (possibleSeparators.length > 0) {
            log(`✓ 检测到 ${possibleSeparators.length} 个可能的分隔区域`, null, 'success');
            
            const displaySeparators = possibleSeparators.slice(0, 20);
            log('分隔区域详情 (前20个)', displaySeparators, 'success');
            
            if (possibleSeparators.length > 20) {
                log(`还有 ${possibleSeparators.length - 20} 个分隔区域未显示`, null, 'info');
            }
        } else {
            log('未检测到明显的分隔区域', null, 'warning');
            const diagnosis = this.diagnose(analysis);
            log('诊断结果', diagnosis, 'warning');
        }

        log('========== 分析完成 ==========', null, 'header');

        return analysis;
    }

    /**
     * 诊断图片问题
     */
    diagnose(analysis) {
        const diagnosis = [];
        const stats = analysis.stats;

        if (stats.maxBrightness - stats.minBrightness < 10) {
            diagnosis.push({
                问题: '亮度变化极小',
                原因: '图片可能是纯色或接近纯色',
                建议: '检查图片是否正确加载'
            });
        }

        if (stats.avgVariance < 5) {
            diagnosis.push({
                问题: '颜色方差极小',
                原因: '图片颜色非常均匀',
                建议: '可能需要手动标记分割点'
            });
        }

        const avgGrayRatio = analysis.rows.reduce((sum, r) => sum + r.grayRatio, 0) / analysis.rows.length;
        const avgWhiteRatio = analysis.rows.reduce((sum, r) => sum + r.whiteRatio, 0) / analysis.rows.length;

        if (avgWhiteRatio > 0.95) {
            diagnosis.push({
                问题: '图片几乎全白',
                原因: `白色像素占比 ${(avgWhiteRatio * 100).toFixed(1)}%`,
                建议: '检查图片是否为空白页或加载失败'
            });
        }

        if (avgGrayRatio < 0.01) {
            diagnosis.push({
                问题: '几乎没有灰色区域',
                原因: `灰色像素占比 ${(avgGrayRatio * 100).toFixed(2)}%`,
                建议: '分隔线可能不是灰色，或者非常细'
            });
        }

        if (diagnosis.length === 0) {
            diagnosis.push({
                问题: '未知',
                原因: '图片特征不明显',
                建议: '尝试调整检测参数或手动标记'
            });
        }

        return diagnosis;
    }

    /**
     * 检测可能的分隔线
     */
    detectPossibleSeparators(analysis) {
        const separators = [];
        const rows = analysis.rows;

        if (rows.length < 3) return separators;

        for (let i = 1; i < rows.length - 1; i++) {
            const prev = rows[i - 1];
            const curr = rows[i];
            const next = rows[i + 1];

            const brightnessDiff = Math.abs(curr.brightness - prev.brightness);
            const varianceDiff = Math.abs(curr.variance - prev.variance);
            const isGrayArea = curr.grayRatio > 0.1;
            const isWhiteArea = curr.whiteRatio > 0.9;
            const isDarkerArea = curr.brightness < analysis.stats.avgBrightness * 0.9;
            const isHighVariance = curr.variance > analysis.stats.avgVariance * 1.5;

            if (brightnessDiff > 5 || varianceDiff > 2 || isGrayArea || isDarkerArea || isHighVariance) {
                separators.push({
                    位置: curr.y,
                    亮度: curr.brightness.toFixed(2),
                    亮度变化: brightnessDiff.toFixed(2),
                    方差: curr.variance.toFixed(2),
                    方差变化: varianceDiff.toFixed(2),
                    灰色比例: (curr.grayRatio * 100).toFixed(2) + '%',
                    白色比例: (curr.whiteRatio * 100).toFixed(1) + '%',
                    类型: isGrayArea ? '灰色区' : (isDarkerArea ? '暗区' : (isHighVariance ? '高方差' : '突变点'))
                });
            }
        }

        return separators;
    }

    /**
     * 加载图片
     */
    async loadImage(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => resolve(img);
                img.onerror = () => reject(new Error('图片加载失败'));
                img.src = e.target.result;
            };
            reader.onerror = () => reject(new Error('文件读取失败'));
            reader.readAsDataURL(file);
        });
    }
}
