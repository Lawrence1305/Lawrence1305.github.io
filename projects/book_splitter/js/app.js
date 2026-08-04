class ImageSplitterApp {
    constructor() {
        this.currentFile = null;
        this.processedPages = [];
        this.initElements();
        this.bindEvents();
    }

    initElements() {
        // 文件上传
        this.dropZone = document.getElementById('dropZone');
        this.fileInput = document.getElementById('fileInput');
        this.fileInfo = document.getElementById('fileInfo');
        this.fileName = document.getElementById('fileName');
        this.fileSize = document.getElementById('fileSize');
        this.previewImage = document.getElementById('previewImage');

        // 选项区域
        this.optionsSection = document.getElementById('optionsSection');
        this.detectionMode = document.getElementById('detectionMode');
        this.expectedPagesInput = document.getElementById('expectedPages');
        this.sensitivitySlider = document.getElementById('sensitivity');
        this.sensitivityValue = document.getElementById('sensitivityValue');
        this.showDebug = document.getElementById('showDebug');
        this.processBtn = document.getElementById('processBtn');
        this.analyzeBtn = document.getElementById('analyzeBtn');

        // 进度条
        this.progressSection = document.getElementById('progressSection');
        this.progressBar = document.getElementById('progressBar');
        this.progressText = document.getElementById('progressText');

        // 预览区域
        this.previewSection = document.getElementById('previewSection');
        this.previewGrid = document.getElementById('previewGrid');
        this.pageCount = document.getElementById('pageCount');

        // 导出按钮
        this.exportPdfBtn = document.getElementById('exportPdfBtn');
        this.exportImagesBtn = document.getElementById('exportImagesBtn');

        // 调试面板
        this.debugPanel = document.getElementById('debugPanel');
        this.debugLog = document.getElementById('debugLog');

        // 浮动按钮
        this.floatButtons = document.getElementById('floatButtons');
        this.toTopBtn = document.getElementById('toTopBtn');
        this.toOptionsBtn = document.getElementById('toOptionsBtn');
        this.toBottomBtn = document.getElementById('toBottomBtn');
    }

    bindEvents() {
        // 点击上传区域
        this.dropZone.addEventListener('click', () => {
            this.fileInput.click();
        });

        // 文件选择
        this.fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.handleFile(e.target.files[0]);
            }
        });

        // 拖拽事件
        this.dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.dropZone.style.borderColor = '#667eea';
            this.dropZone.style.background = '#f7fafc';
        });

        this.dropZone.addEventListener('dragleave', () => {
            this.dropZone.style.borderColor = '#cbd5e0';
            this.dropZone.style.background = 'white';
        });

        this.dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            this.dropZone.style.borderColor = '#cbd5e0';
            this.dropZone.style.background = 'white';

            if (e.dataTransfer.files.length > 0) {
                this.handleFile(e.dataTransfer.files[0]);
            }
        });

        // 灵敏度滑块
        if (this.sensitivitySlider) {
            this.sensitivitySlider.addEventListener('input', (e) => {
                this.sensitivityValue.textContent = e.target.value;
            });
        }

        // 调试开关
        if (this.showDebug) {
            this.showDebug.addEventListener('change', (e) => {
                this.debugPanel.style.display = e.target.checked ? 'block' : 'none';
                if (e.target.checked) this.addDebugLog('调试模式已启用', null, 'success');
            });
        }

        // 处理按钮
        if (this.processBtn) {
            this.processBtn.addEventListener('click', () => {
                this.processImage();
            });
        }

        // 分析按钮
        if (this.analyzeBtn) {
            this.analyzeBtn.addEventListener('click', () => {
                this.analyzeImage();
            });
        }

        // 导出按钮
        if (this.exportPdfBtn) {
            this.exportPdfBtn.addEventListener('click', () => this.exportPDF());
        }

        if (this.exportImagesBtn) {
            this.exportImagesBtn.addEventListener('click', () => this.exportImages());
        }

        // 检测模式切换
        if (this.detectionMode) {
            this.detectionMode.addEventListener('change', (e) => {
                const mode = e.target.value;
                const expectedPagesGroup = document.getElementById('expectedPagesGroup');
                if (expectedPagesGroup) {
                    expectedPagesGroup.style.display = (mode === 'gray' || mode === 'grayV2') ? 'block' : 'none';
                }
            });
        }

        // 导出文件名输入框
        this.exportFilenameInput = document.getElementById('exportFilename');

        // 浮动按钮事件
        if (this.toTopBtn) this.toTopBtn.addEventListener('click', () => this.scrollToTop());
        if (this.toBottomBtn) this.toBottomBtn.addEventListener('click', () => this.scrollToBottom());
        if (this.toOptionsBtn) this.toOptionsBtn.addEventListener('click', () => this.scrollToOptions());

        // 监听滚动事件
        window.addEventListener('scroll', () => this.handleScroll());
        this.handleScroll();
    }

    handleFile(file) {
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            alert('请选择图片文件！');
            return;
        }

        this.currentFile = file;

        // 显示文件信息
        this.fileName.textContent = file.name;
        this.fileSize.textContent = this.formatFileSize(file.size);
        this.fileInfo.style.display = 'block';

        // 显示预览
        const reader = new FileReader();
        reader.onload = (e) => {
            this.previewImage.src = e.target.result;
            this.previewImage.style.display = 'block';
        };
        reader.readAsDataURL(file);

        // 显示选项
        this.optionsSection.style.display = 'block';

        // 隐藏之前的结果
        this.progressSection.style.display = 'none';
        this.previewSection.style.display = 'none';

        this.addDebugLog(`文件已加载: ${file.name}`, null, 'success');
    }

    formatFileSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    }

    addDebugLog(message, data = null, type = 'info') {
        if (!this.showDebug || !this.showDebug.checked) return;
        if (!this.debugLog) return;

        const timestamp = new Date().toLocaleTimeString('zh-CN', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });

        const icon = { 'info': '🔍', 'success': '✓', 'warning': '⚠️', 'error': '❌', 'header': '═══' }[type] || '•';

        let logEntry = `[${timestamp}] ${icon} ${message}`;

        if (data) {
            if (Array.isArray(data)) {
                logEntry += '\n' + this.formatTable(data);
            } else if (typeof data === 'object') {
                logEntry += '\n' + JSON.stringify(data, null, 2);
            } else {
                logEntry += '\n' + data;
            }
        }

        const logElement = document.createElement('div');
        logElement.className = `log-entry log-${type}`;
        logElement.textContent = logEntry;

        this.debugLog.appendChild(logElement);
        this.debugLog.scrollTop = this.debugLog.scrollHeight;
    }

    formatTable(data) {
        if (!data || data.length === 0) return '';

        const keys = Object.keys(data[0]);
        const colWidths = {};

        keys.forEach(key => {
            colWidths[key] = Math.max(key.length, ...data.map(row => String(row[key]).length));
        });

        let table = keys.map(key => key.padEnd(colWidths[key])).join('\t') + '\n';

        data.forEach(row => {
            table += keys.map(key => String(row[key]).padEnd(colWidths[key])).join('\t') + '\n';
        });

        return table;
    }

    updateProgress(percent, message) {
        if (this.progressSection) this.progressSection.style.display = 'block';
        if (this.progressBar) this.progressBar.style.width = percent + '%';
        if (this.progressText) this.progressText.textContent = message;
    }

    async analyzeImage() {
        if (!this.currentFile) {
            alert('请先上传图片！');
            return;
        }

        try {
            const analyzer = new ImageAnalyzer();
            await analyzer.analyze(this.currentFile, (msg, data, type) => {
                this.addDebugLog(msg, data, type);
            });

            this.addDebugLog('分析报告已生成，请查看上方详细信息', null, 'success');

        } catch (error) {
            alert('分析失败: ' + error.message);
            this.addDebugLog(`分析失败: ${error.message}`, null, 'error');
        }
    }

    async processImage() {
        if (!this.currentFile) {
            alert('请先上传图片！');
            return;
        }

        this.processBtn.disabled = true;
        this.processBtn.textContent = '处理中...';
        this.updateProgress(0, '准备处理...');

        try {
            const sensitivity = this.sensitivitySlider ? parseInt(this.sensitivitySlider.value) : 50;  // default 50
            const detectionMode = this.detectionMode ? this.detectionMode.value : 'gray';
            const expectedPages = this.expectedPagesInput ? parseInt(this.expectedPagesInput.value) || 0 : 0;

            this.addDebugLog('========== 开始处理 ==========', null, 'header');
            this.addDebugLog(`检测模式: ${detectionMode}`, null, 'info');
            this.addDebugLog(`灵敏度: ${sensitivity}`, null, 'info');
            this.addDebugLog(`期望页数: ${expectedPages === 0 ? '自动检测' : expectedPages}`, null, 'info');

            let pages;

            if (detectionMode === 'grayV2') {
                this.addDebugLog('使用灰色分隔线检测器 V2', null, 'info');

                const detector = new GraySeparatorDetectorV2();
                detector.setDebugMode(this.showDebug ? this.showDebug.checked : false, (msg, data, type) => {
                    this.addDebugLog(msg, data, type);
                });

                this.updateProgress(10, '加载图片...');
                const img = await this.loadImage(this.currentFile);

                this.updateProgress(30, '检测灰色分隔线 V2...');

                const splitPoints = detector.detect(img, expectedPages, {
                    sensitivity: sensitivity
                });

                if (splitPoints.length <= 2) {
                    this.addDebugLog('V2 检测未找到分割点', null, 'warning');
                    throw new Error('V2 未检测到灰色分隔线，请尝试其他检测模式或调整灵敏度');
                }

                this.updateProgress(60, `检测到 ${splitPoints.length - 2} 个分割点，开始裁剪...`);

                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');

                if (!ctx) {
                    throw new Error('无法创建 Canvas Context');
                }

                canvas.width = img.width;
                canvas.height = img.height;
                ctx.drawImage(img, 0, 0);

                const allPages = [];
                for (let i = 0; i < splitPoints.length - 1; i++) {
                    const startY = splitPoints[i];
                    const endY = splitPoints[i + 1];
                    const height = endY - startY;

                    if (height <= 0) {
                        this.addDebugLog(`跳过无效页面 ${i + 1}: 高度 = ${height}`, null, 'warning');
                        continue;
                    }

                    const pageCanvas = document.createElement('canvas');
                    const pageCtx = pageCanvas.getContext('2d');

                    if (!pageCtx) {
                        this.addDebugLog(`无法创建页面 ${i + 1} 的 Canvas`, null, 'warning');
                        continue;
                    }

                    pageCanvas.width = img.width;
                    pageCanvas.height = height;

                    try {
                        pageCtx.drawImage(canvas, 0, startY, img.width, height, 0, 0, img.width, height);

                        allPages.push({
                            canvas: pageCanvas,
                            dataURL: pageCanvas.toDataURL('image/png'),
                            startY: startY,
                            endY: endY,
                            height: height,
                            index: i
                        });
                    } catch (error) {
                        this.addDebugLog(`裁剪页面 ${i + 1} 失败: ${error.message}`, null, 'warning');
                        continue;
                    }

                    const progress = 60 + (i / (splitPoints.length - 1)) * 20;
                    this.updateProgress(progress, `裁剪页面 ${i + 1}/${splitPoints.length - 1}...`);
                }

                if (allPages.length === 0) {
                    throw new Error('裁剪失败：没有生成任何有效页面');
                }

                this.addDebugLog(`裁剪完成，共 ${allPages.length} 个片段`, null, 'success');

                this.updateProgress(85, '过滤分隔线页面...');
                const filteredPages = this.filterSeparatorPages(allPages, img.height);

                if (filteredPages.length === 0) {
                    this.addDebugLog('过滤后没有剩余页面，使用原始裁剪结果', null, 'warning');
                    pages = allPages.map(p => p.dataURL);
                } else {
                    this.addDebugLog(`过滤后剩余 ${filteredPages.length} 个有效页面`, null, 'success');
                    pages = filteredPages.map(p => p.dataURL);
                }
            } else if (detectionMode === 'gray') {
                this.addDebugLog('使用灰色分隔线检测器', null, 'info');

                const detector = new GraySeparatorDetector();
                detector.setDebugMode(this.showDebug ? this.showDebug.checked : false, (msg, data, type) => {
                    this.addDebugLog(msg, data, type);
                });

                this.updateProgress(10, '加载图片...');
                const img = await this.loadImage(this.currentFile);

                this.updateProgress(30, '检测灰色分隔线...');

                // 灵敏度影响检测参数：灵敏度越高越容易检测到分隔线
                // sensitivity: 1(最严格) -> 100(最宽松)
                const s = sensitivity / 10;   // 归一化到旧版 1-10 范围
                const sf = sensitivity / 100; // 归一化到 0.01-1.0

                const splitPoints = detector.detect(img, expectedPages, {
                    // 最小分隔线高度：灵敏度越高允许越小的分隔线
                    minSeparatorHeight: Math.max(1, Math.floor(5 - s * 0.4)),
                    // 最大分隔线高度：灵敏度越高允许越大的分隔线
                    maxSeparatorHeight: 30 + s * 15,
                    // 灰色比例阈值：灵敏度越高越宽松
                    minGrayRatio: 0.7 - sf * 0.3,
                    // 颜色差异阈值：灵敏度越高越宽松
                    grayColorDiffMax: 15 + s * 4,
                    // 亮度范围：灵敏度越高范围越宽
                    grayBrightnessMin: 170 - s * 3,
                    grayBrightnessMax: 230 + s * 3,
                    // 方差阈值：灵敏度越高越宽松
                    grayVarianceMax: 10 + s * 3,
                    // 边界变化阈值：灵敏度越高越容易检测到变化
                    varianceChangeThreshold: 0.5 - sf * 0.35,
                    brightnessChangeThreshold: 15 - s * 1.2,
                    edgeDensityChangeThreshold: 0.5 - sf * 0.35,
                    // 最小页面高度
                    minPageHeight: Math.floor(img.height * 0.015)
                });

                if (splitPoints.length <= 2) {
                    this.addDebugLog('⚠️ 灰色分隔线检测未找到分割点', null, 'warning');
                    throw new Error('未检测到灰色分隔线，请尝试其他检测模式或调整灵敏度');
                }

                this.updateProgress(60, `检测到 ${splitPoints.length - 2} 个分割点，开始裁剪...`);

                // 裁剪页面
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');

                if (!ctx) {
                    throw new Error('无法创建 Canvas Context');
                }

                canvas.width = img.width;
                canvas.height = img.height;
                ctx.drawImage(img, 0, 0);

                const allPages = [];
                for (let i = 0; i < splitPoints.length - 1; i++) {
                    const startY = splitPoints[i];
                    const endY = splitPoints[i + 1];
                    const height = endY - startY;

                    if (height <= 0) {
                        this.addDebugLog(`⚠️ 跳过无效页面 ${i + 1}: 高度 = ${height}`, null, 'warning');
                        continue;
                    }

                    const pageCanvas = document.createElement('canvas');
                    const pageCtx = pageCanvas.getContext('2d');

                    if (!pageCtx) {
                        this.addDebugLog(`⚠️ 无法创建页面 ${i + 1} 的 Canvas`, null, 'warning');
                        continue;
                    }

                    pageCanvas.width = img.width;
                    pageCanvas.height = height;

                    try {
                        pageCtx.drawImage(canvas, 0, startY, img.width, height, 0, 0, img.width, height);

                        allPages.push({
                            canvas: pageCanvas,
                            dataURL: pageCanvas.toDataURL('image/png'),
                            startY: startY,
                            endY: endY,
                            height: height,
                            index: i
                        });
                    } catch (error) {
                        this.addDebugLog(`⚠️ 裁剪页面 ${i + 1} 失败: ${error.message}`, null, 'warning');
                        continue;
                    }

                    const progress = 60 + (i / (splitPoints.length - 1)) * 20;
                    this.updateProgress(progress, `裁剪页面 ${i + 1}/${splitPoints.length - 1}...`);
                }

                if (allPages.length === 0) {
                    throw new Error('裁剪失败：没有生成任何有效页面');
                }

                this.addDebugLog(`裁剪完成，共 ${allPages.length} 个片段`, null, 'success');

                // 过滤掉分隔线页面
                this.updateProgress(85, '过滤分隔线页面...');
                const filteredPages = this.filterSeparatorPages(allPages, img.height);

                if (filteredPages.length === 0) {
                    this.addDebugLog('⚠️ 过滤后没有剩余页面，使用原始裁剪结果', null, 'warning');
                    pages = allPages.map(p => p.dataURL);
                } else {
                    this.addDebugLog(`过滤后剩余 ${filteredPages.length} 个有效页面`, null, 'success');
                    pages = filteredPages.map(p => p.dataURL);
                }
            } else {
                this.addDebugLog(`使用 ${this.getDetectionModeName(detectionMode)}`, null, 'info');

                const processor = new ImageProcessor();
                processor.setDebugMode(this.showDebug ? this.showDebug.checked : false, (msg, data, type) => {
                    this.addDebugLog(msg, data, type);
                });

                pages = await processor.process(
                    this.currentFile,
                    sensitivity,
                    (progress, message) => {
                        this.updateProgress(progress, message);
                    },
                    detectionMode
                );
            }

            if (pages.length === 0) {
                throw new Error('未能检测到有效的页面');
            }

            this.updateProgress(100, `处理完成! 共 ${pages.length} 个页面`);
            this.addDebugLog(`✓ 成功处理 ${pages.length} 个页面`, null, 'success');

            this.displayPreview(pages);

        } catch (error) {
            alert('处理失败: ' + error.message);
            this.addDebugLog(`❌ 处理失败: ${error.message}`, null, 'error');
            this.updateProgress(0, '处理失败');
        } finally {
            this.processBtn.disabled = false;
            this.processBtn.textContent = '开始处理';
        }
    }


    filterSeparatorPages(pages, totalHeight) {
        const minValidPageHeight = Math.floor(totalHeight * 0.02);
        const maxSeparatorHeight = 100;

        const filterResults = [];

        for (const page of pages) {
            if (!page || !page.canvas) continue;

            const analysis = this.analyzePageContent(page.canvas);
            if (!analysis) continue;

            const isTooShort = page.height < minValidPageHeight;
            const isGraySeparator = analysis.grayRatio > 0.6 && analysis.avgColorVariance < 20 && page.height < maxSeparatorHeight;
            const isUniformGray = analysis.isUniform && analysis.avgBrightness > 100 && analysis.avgBrightness < 200 && page.height < maxSeparatorHeight;

            const isSeparator = isTooShort || isGraySeparator || isUniformGray;

            filterResults.push({
                页面: page.index + 1,
                高度: page.height,
                起始: page.startY,
                结束: page.endY,
                灰色比例: ((analysis.grayRatio || 0) * 100).toFixed(1) + '%',
                颜色方差: (analysis.avgColorVariance || 0).toFixed(2),
                平均亮度: (analysis.avgBrightness || 0).toFixed(2),
                是否均匀: analysis.isUniform ? '是' : '否',
                判定: isSeparator ? '❌ 分隔线' : '✓ 有效页面'
            });

            if (isSeparator) page.filtered = true;
        }

        this.addDebugLog('页面过滤结果', filterResults, 'info');

        const validPages = pages.filter(p => !p.filtered);
        this.addDebugLog(`过滤掉 ${pages.length - validPages.length} 个分隔线页面`, null, 'success');

        return validPages;
    }

    analyzePageContent(canvas) {
        try {
            if (!canvas || !canvas.getContext) return this.getDefaultAnalysis();

            const ctx = canvas.getContext('2d');
            if (!ctx) return this.getDefaultAnalysis();

            const width = canvas.width;
            const height = canvas.height;

            if (width === 0 || height === 0) return this.getDefaultAnalysis();

            const imageData = ctx.getImageData(0, 0, width, height);
            const data = imageData.data;

            let rSum = 0, gSum = 0, bSum = 0;
            let grayPixelCount = 0;
            let colorVarianceSum = 0;
            let brightnessSum = 0;
            let minBrightness = 255;
            let maxBrightness = 0;

            const pixelCount = width * height;
            const sampleRate = Math.max(1, Math.floor(pixelCount / 100000));
            let sampledCount = 0;

            for (let i = 0; i < data.length; i += 4 * sampleRate) {
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];

                if (r === undefined || g === undefined || b === undefined) continue;

                rSum += r;
                gSum += g;
                bSum += b;

                const brightness = (r + g + b) / 3;
                brightnessSum += brightness;
                minBrightness = Math.min(minBrightness, brightness);
                maxBrightness = Math.max(maxBrightness, brightness);

                const avgRGB = brightness;
                const variance = (Math.pow(r - avgRGB, 2) + Math.pow(g - avgRGB, 2) + Math.pow(b - avgRGB, 2)) / 3;
                colorVarianceSum += variance;

                const colorDiff = Math.max(Math.abs(r - g), Math.abs(g - b), Math.abs(r - b));

                if (colorDiff < 30 && brightness > 100 && brightness < 230) grayPixelCount++;

                sampledCount++;
            }

            if (sampledCount === 0) return this.getDefaultAnalysis();

            const avgBrightness = brightnessSum / sampledCount;
            const avgColorVariance = Math.sqrt(colorVarianceSum / sampledCount);
            const grayRatio = grayPixelCount / sampledCount;
            const brightnessRange = maxBrightness - minBrightness;
            const isUniform = brightnessRange < 30 && avgColorVariance < 15;

            return {
                avgR: rSum / sampledCount,
                avgG: gSum / sampledCount,
                avgB: bSum / sampledCount,
                avgBrightness,
                avgColorVariance,
                grayRatio,
                brightnessRange,
                isUniform,
                minBrightness,
                maxBrightness
            };
        } catch (error) {
            return this.getDefaultAnalysis();
        }
    }

    getDefaultAnalysis() {
        return { avgR: 0, avgG: 0, avgB: 0, avgBrightness: 0, avgColorVariance: 0, grayRatio: 0, brightnessRange: 0, isUniform: false, minBrightness: 0, maxBrightness: 0 };
    }

    getDetectionModeName(mode) {
        const names = {
            'auto': '自动亮度检测',
            'gradient': '梯度变化检测',
            'edge': '边缘检测',
            'projection': '投影检测',
            'color': '颜色变化检测',
            'hybrid': '混合检测'
        };
        return names[mode] || '自动检测';
    }

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

    displayPreview(pages) {
        this.processedPages = pages;
        this.previewGrid.innerHTML = '';
        this.pageCount.textContent = pages.length;

        pages.forEach((pageDataURL, index) => {
            const item = document.createElement('div');
            item.className = 'preview-item';

            const img = document.createElement('img');
            img.src = pageDataURL;
            img.alt = `页面 ${index + 1}`;

            const label = document.createElement('p');
            label.textContent = `页面 ${index + 1}`;

            item.appendChild(img);
            item.appendChild(label);
            this.previewGrid.appendChild(item);
        });

        this.previewSection.style.display = 'block';
        this.addDebugLog('预览已生成', null, 'success');
    }

    async exportPDF() {
        if (this.processedPages.length === 0) {
            alert('没有可导出的页面！');
            return;
        }

        try {
            let filename = this.exportFilenameInput ? this.exportFilenameInput.value.trim() : '';

            if (!filename) {
                filename = prompt('请输入PDF文件名（不需要输入.pdf后缀）:', `split_pages_${new Date().toISOString().slice(0,10)}`);
                if (filename === null) return;
                filename = filename.trim();
            }

            if (!filename) filename = `split_pages_${Date.now()}`;
            filename = filename.replace(/[<>:"/\\|?*]/g, '_');
            if (!filename.toLowerCase().endsWith('.pdf')) filename += '.pdf';

            if (this.exportPdfBtn) {
                this.exportPdfBtn.disabled = true;
                this.exportPdfBtn.textContent = '生成中...';
            }

            const generator = new PDFGenerator();
            const pdfBlob = await generator.generate(this.processedPages, (progress, message) => {
                this.updateProgress(progress, message);
            });

            if (!pdfBlob || !(pdfBlob instanceof Blob)) {
                throw new Error('PDF生成失败：返回的不是有效的Blob对象');
            }

            const url = URL.createObjectURL(pdfBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;

            document.body.appendChild(a);
            a.click();

            setTimeout(() => {
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }, 100);

            this.addDebugLog(`✓ PDF导出成功: ${filename}`, null, 'success');
            alert(`PDF导出成功！\n文件名: ${filename}`);

        } catch (error) {
            alert('PDF导出失败: ' + error.message);
            this.addDebugLog(`PDF导出失败: ${error.message}`, null, 'error');
        } finally {
            if (this.exportPdfBtn) {
                this.exportPdfBtn.disabled = false;
                this.exportPdfBtn.textContent = '📥 导出为PDF';
            }
        }
    }

    async exportImages() {
        if (this.processedPages.length === 0) {
            alert('没有可导出的页面！');
            return;
        }

        try {
            let filenamePrefix = this.exportFilenameInput ? this.exportFilenameInput.value.trim() : '';

            if (!filenamePrefix) {
                filenamePrefix = prompt('请输入文件名前缀（将自动添加页码）:', `page_${new Date().toISOString().slice(0,10)}`);
                if (filenamePrefix === null) return;
                filenamePrefix = filenamePrefix.trim();
            }

            if (!filenamePrefix) filenamePrefix = `page_${Date.now()}`;
            filenamePrefix = filenamePrefix.replace(/[<>:"/\\|?*]/g, '_');

            if (this.exportImagesBtn) {
                this.exportImagesBtn.disabled = true;
                this.exportImagesBtn.textContent = '导出中...';
            }

            const pageNumWidth = this.processedPages.length.toString().length;

            for (let i = 0; i < this.processedPages.length; i++) {
                const progress = ((i + 1) / this.processedPages.length) * 100;
                this.updateProgress(progress, `导出图片 ${i + 1}/${this.processedPages.length}...`);

                const pageNum = (i + 1).toString().padStart(pageNumWidth, '0');
                const filename = `${filenamePrefix}_${pageNum}.png`;

                const a = document.createElement('a');
                a.href = this.processedPages[i];
                a.download = filename;

                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);

                await new Promise(resolve => setTimeout(resolve, 200));

                this.addDebugLog(`✓ 已导出: ${filename}`, null, 'success');
            }

            this.updateProgress(100, '导出完成！');
            alert(`成功导出 ${this.processedPages.length} 张图片！\n文件名格式: ${filenamePrefix}_01.png`);

        } catch (error) {
            alert('图片导出失败: ' + error.message);
            this.addDebugLog(`图片导出失败: ${error.message}`, null, 'error');
        } finally {
            if (this.exportImagesBtn) {
                this.exportImagesBtn.disabled = false;
                this.exportImagesBtn.textContent = '🖼️ 导出为图片';
            }
        }
    }

    scrollToTop() {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        if (this.toTopBtn) {
            this.toTopBtn.classList.add('bounce');
            setTimeout(() => this.toTopBtn.classList.remove('bounce'), 600);
        }
    }

    scrollToBottom() {
        window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
        if (this.toBottomBtn) {
            this.toBottomBtn.classList.add('bounce');
            setTimeout(() => this.toBottomBtn.classList.remove('bounce'), 600);
        }
    }

    scrollToOptions() {
        if (this.optionsSection) {
            const rect = this.optionsSection.getBoundingClientRect();
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            const targetPosition = rect.top + scrollTop - 20;

            window.scrollTo({ top: targetPosition, behavior: 'smooth' });

            if (this.toOptionsBtn) {
                this.toOptionsBtn.classList.add('bounce');
                setTimeout(() => this.toOptionsBtn.classList.remove('bounce'), 600);
            }

            this.optionsSection.style.transition = 'all 0.3s';
            this.optionsSection.style.boxShadow = '0 0 20px rgba(102, 126, 234, 0.5)';
            setTimeout(() => this.optionsSection.style.boxShadow = '', 1000);
        }
    }

    handleScroll() {
        if (!this.floatButtons) return;

        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const scrollHeight = document.documentElement.scrollHeight;
        const clientHeight = document.documentElement.clientHeight;

        if (this.toTopBtn) this.toTopBtn.classList.add('show');
        if (this.toBottomBtn) this.toBottomBtn.classList.add('show');
        if (this.toOptionsBtn && this.optionsSection && this.optionsSection.style.display !== 'none') {
            this.toOptionsBtn.classList.add('show');
        }

        if (this.toTopBtn) this.toTopBtn.style.opacity = scrollTop < 100 ? '0.4' : '1';

        const distanceToBottom = scrollHeight - scrollTop - clientHeight;
        if (this.toBottomBtn) this.toBottomBtn.style.opacity = distanceToBottom < 100 ? '0.4' : '1';
    }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');

    if (!dropZone) {
        alert('页面加载错误：找不到上传区域元素，请检查 HTML 文件');
        return;
    }

    if (!fileInput) {
        alert('页面加载错误：找不到文件输入元素，请检查 HTML 文件');
        return;
    }

    try {
        window.app = new ImageSplitterApp();
    } catch (error) {
        alert('应用初始化失败: ' + error.message);
    }
});
