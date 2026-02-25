/**
 * 主应用类
 */
class ImageSplitterApp {
    constructor() {
        this.currentFile = null;
        this.processedPages = [];
        this.initElements();
        this.bindEvents();
    }

    /**
     * 初始化DOM元素引用
     */
    initElements() {
        console.log('初始化元素...');
        
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

        // 浮动按钮（新增）
        this.floatButtons = document.getElementById('floatButtons');
        this.toTopBtn = document.getElementById('toTopBtn');
        this.toOptionsBtn = document.getElementById('toOptionsBtn');
        this.toBottomBtn = document.getElementById('toBottomBtn');

        // 验证关键元素
        console.log('dropZone:', this.dropZone);
        console.log('fileInput:', this.fileInput);
        console.log('processBtn:', this.processBtn);
        
        if (!this.dropZone || !this.fileInput) {
            console.error('❌ 关键元素缺失');
        } else {
            console.log('✓ 关键元素初始化完成');
        }
    }

    /**
     * 绑定事件
     */
    bindEvents() {
        console.log('绑定事件...');
        
        if (!this.dropZone || !this.fileInput) {
            console.error('❌ 无法绑定事件：关键元素缺失');
            return;
        }

        // 点击上传区域
        this.dropZone.addEventListener('click', (e) => {
            console.log('点击上传区域');
            this.fileInput.click();
        });

        // 文件选择
        this.fileInput.addEventListener('change', (e) => {
            console.log('文件选择事件触发');
            if (e.target.files.length > 0) {
                console.log('选择的文件:', e.target.files[0]);
                this.handleFile(e.target.files[0]);
            }
        });

        // 拖拽事件
        this.dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.dropZone.style.borderColor = '#667eea';
            this.dropZone.style.background = '#f7fafc';
        });

        this.dropZone.addEventListener('dragleave', (e) => {
            this.dropZone.style.borderColor = '#cbd5e0';
            this.dropZone.style.background = 'white';
        });

        this.dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            console.log('文件拖放事件触发');
            this.dropZone.style.borderColor = '#cbd5e0';
            this.dropZone.style.background = 'white';
            
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                console.log('拖放的文件:', files[0]);
                this.handleFile(files[0]);
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
                if (e.target.checked) {
                    this.debugPanel.style.display = 'block';
                    this.addDebugLog('调试模式已启用', null, 'success');
                } else {
                    this.debugPanel.style.display = 'none';
                }
            });
        }

        // 处理按钮
        if (this.processBtn) {
            this.processBtn.addEventListener('click', () => {
                console.log('点击处理按钮');
                this.processImage();
            });
        }

        // 分析按钮
        if (this.analyzeBtn) {
            this.analyzeBtn.addEventListener('click', () => {
                console.log('点击分析按钮');
                this.analyzeImage();
            });
        }

        // 导出按钮
        if (this.exportPdfBtn) {
            this.exportPdfBtn.addEventListener('click', () => {
                this.exportPDF();
            });
        }

        if (this.exportImagesBtn) {
            this.exportImagesBtn.addEventListener('click', () => {
                this.exportImages();
            });
        }

        // 检测模式切换
        if (this.detectionMode) {
            this.detectionMode.addEventListener('change', (e) => {
                const mode = e.target.value;
                console.log('切换检测模式:', mode);
                this.addDebugLog(`切换检测模式: ${mode}`, null, 'info');
                
                const expectedPagesGroup = document.getElementById('expectedPagesGroup');
                if (expectedPagesGroup) {
                    expectedPagesGroup.style.display = (mode === 'gray') ? 'block' : 'none';
                }
            });
        }
        // 导出文件名输入框（新增）
        this.exportFilenameInput = document.getElementById('exportFilename');

        // 浮动按钮事件（新增）
        if (this.toTopBtn) {
            this.toTopBtn.addEventListener('click', () => {
                this.scrollToTop();
            });
        }

        if (this.toBottomBtn) {
            this.toBottomBtn.addEventListener('click', () => {
                this.scrollToBottom();
            });
        }

        if (this.toOptionsBtn) {
            this.toOptionsBtn.addEventListener('click', () => {
                this.scrollToOptions();
            });
        }

        // 监听滚动事件，控制浮动按钮显示
        window.addEventListener('scroll', () => {
            this.handleScroll();
        });
        // 初始显示所有按钮
        if (this.toTopBtn) this.toTopBtn.classList.add('show');
        if (this.toBottomBtn) this.toBottomBtn.classList.add('show');
        if (this.toOptionsBtn) this.toOptionsBtn.classList.add('show');
        // 初始检查
        this.handleScroll();
        console.log('✓ 事件绑定完成');
    }

    /**
     * 处理文件
     */
    handleFile(file) {
        console.log('handleFile 被调用:', file);
        
        if (!file) {
            console.error('文件为空');
            return;
        }

        if (!file.type.startsWith('image/')) {
            alert('请选择图片文件！');
            console.error('文件类型错误:', file.type);
            return;
        }

        console.log('文件验证通过，开始处理...');
        this.currentFile = file;

        // 显示文件信息
        this.fileName.textContent = file.name;
        this.fileSize.textContent = this.formatFileSize(file.size);
        this.fileInfo.style.display = 'block';

        // 显示预览
        const reader = new FileReader();
        reader.onload = (e) => {
            console.log('文件读取完成');
            this.previewImage.src = e.target.result;
            this.previewImage.style.display = 'block';
        };
        reader.onerror = (e) => {
            console.error('文件读取失败:', e);
        };
        reader.readAsDataURL(file);

        // 显示选项
        this.optionsSection.style.display = 'block';
        
        // 隐藏之前的结果
        this.progressSection.style.display = 'none';
        this.previewSection.style.display = 'none';

        this.addDebugLog(`文件已加载: ${file.name}`, null, 'success');
        console.log('✓ 文件处理完成');
    }

    /**
     * 格式化文件大小
     */
    formatFileSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    }

    /**
     * 添加调试日志
     */
    addDebugLog(message, data = null, type = 'info') {
        if (!this.showDebug || !this.showDebug.checked) return;
        if (!this.debugLog) return;

        const timestamp = new Date().toLocaleTimeString('zh-CN', { 
            hour12: false, 
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit',
            fractionalSecondDigits: 3
        });

        const icon = {
            'info': '🔍',
            'success': '✓',
            'warning': '⚠️',
            'error': '❌',
            'header': '═══'
        }[type] || '•';

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

        // 同时输出到控制台
        console.log(logEntry, data || '');
    }

    /**
     * 格式化表格数据
     */
    formatTable(data) {
        if (!data || data.length === 0) return '';

        const keys = Object.keys(data[0]);
        const colWidths = {};

        // 计算列宽
        keys.forEach(key => {
            colWidths[key] = Math.max(
                key.length,
                ...data.map(row => String(row[key]).length)
            );
        });

        // 生成表头
        let table = keys.map(key => key.padEnd(colWidths[key])).join('\t') + '\n';
        
        // 生成数据行
        data.forEach(row => {
            table += keys.map(key => String(row[key]).padEnd(colWidths[key])).join('\t') + '\n';
        });

        return table;
    }

    /**
     * 更新进度
     */
    updateProgress(percent, message) {
        if (this.progressSection) {
            this.progressSection.style.display = 'block';
        }
        if (this.progressBar) {
            this.progressBar.style.width = percent + '%';
        }
        if (this.progressText) {
            this.progressText.textContent = message;
        }
    }

    /**
     * 分析图片
     */
    async analyzeImage() {
        if (!this.currentFile) {
            alert('请先上传图片！');
            return;
        }

        console.log('开始分析图片...');
        this.addDebugLog('开始分析图片...', null, 'info');

        try {
            const analyzer = new ImageAnalyzer();
            const analysis = await analyzer.analyze(this.currentFile, (msg, data, type) => {
                this.addDebugLog(msg, data, type);
            });

            console.log('分析完成:', analysis);
            this.addDebugLog('分析报告已生成，请查看上方详细信息', null, 'success');

        } catch (error) {
            console.error('分析失败:', error);
            alert('分析失败: ' + error.message);
            this.addDebugLog(`分析失败: ${error.message}`, null, 'error');
        }
    }

    /**
     * 处理图片
     */
    async processImage() {
        if (!this.currentFile) {
            alert('请先上传图片！');
            return;
        }

        console.log('开始处理图片...');
        
        this.processBtn.disabled = true;
        this.processBtn.textContent = '处理中...';
        this.updateProgress(0, '准备处理...');

        try {
            // 安全获取参数
            const sensitivity = this.sensitivitySlider ? parseInt(this.sensitivitySlider.value) : 5;
            const detectionMode = this.detectionMode ? this.detectionMode.value : 'gray';
            const expectedPages = this.expectedPagesInput ? parseInt(this.expectedPagesInput.value) || 0 : 0;

            console.log('处理参数:', { sensitivity, detectionMode, expectedPages });

            this.addDebugLog('========== 开始处理 ==========', null, 'header');
            this.addDebugLog(`检测模式: ${detectionMode}`, null, 'info');
            this.addDebugLog(`灵敏度: ${sensitivity}`, null, 'info');
            this.addDebugLog(`期望页数: ${expectedPages === 0 ? '自动检测' : expectedPages}`, null, 'info');

            let pages;

            if (detectionMode === 'gray') {
                // 使用灰色分隔线检测器
                console.log('使用灰色分隔线检测器');
                this.addDebugLog('使用灰色分隔线检测器', null, 'info');
                
                const detector = new GraySeparatorDetector();
                detector.setDebugMode(this.showDebug ? this.showDebug.checked : false, (msg, data, type) => {
                    this.addDebugLog(msg, data, type);
                });

                this.updateProgress(10, '加载图片...');
                const img = await this.loadImage(this.currentFile);

                this.updateProgress(30, '检测灰色分隔线...');
                const splitPoints = detector.detect(img, expectedPages, {
                    minSeparatorHeight: Math.max(3, 11 - sensitivity),
                    maxSeparatorHeight: Math.min(100, sensitivity * 10),
                    uniformRegionHeight: 10,
                    minPageHeight: Math.floor(img.height * 0.03)
                });

                console.log('检测到的分割点:', splitPoints);

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

                    // 验证高度
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
                        pageCtx.drawImage(
                            canvas,
                            0, startY,
                            img.width, height,
                            0, 0,
                            img.width, height
                        );

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
                // 使用原有的检测方法
                console.log('使用传统检测方法');
                this.addDebugLog('使用传统检测方法', null, 'info');
                
                const processor = new ImageProcessor();
                processor.setDebugMode(this.showDebug ? this.showDebug.checked : false, (msg, data, type) => {
                    this.addDebugLog(msg, data, type);
                });

                const useGradient = (detectionMode === 'gradient');
                pages = await processor.process(
                    this.currentFile,
                    sensitivity,
                    (progress, message) => {
                        this.updateProgress(progress, message);
                    },
                    useGradient
                );
            }

            if (pages.length === 0) {
                throw new Error('未能检测到有效的页面');
            }

            this.updateProgress(100, `处理完成! 共 ${pages.length} 个页面`);
            this.addDebugLog(`✓ 成功处理 ${pages.length} 个页面`, null, 'success');

            // 显示预览
            this.displayPreview(pages);

        } catch (error) {
            console.error('处理错误:', error);
            alert('处理失败: ' + error.message);
            this.addDebugLog(`❌ 处理失败: ${error.message}`, null, 'error');
            this.updateProgress(0, '处理失败');
        } finally {
            this.processBtn.disabled = false;
            this.processBtn.textContent = '开始处理';
        }
    }


    /**
     * 过滤掉分隔线页面
     */
    filterSeparatorPages(pages, totalHeight) {
        this.addDebugLog('开始过滤分隔线页面...', null, 'info');
        
        const minValidPageHeight = Math.floor(totalHeight * 0.02); // 最小有效页面高度：总高度的2%
        const maxSeparatorHeight = 100; // 分隔线最大高度
        
        const filterResults = [];
        
        for (const page of pages) {
            // 安全检查
            if (!page || !page.canvas) {
                console.error('页面数据无效:', page);
                continue;
            }

            const analysis = this.analyzePageContent(page.canvas);
            
            // 安全检查分析结果
            if (!analysis) {
                console.error('页面分析失败:', page);
                continue;
            }
            
            // 判断是否为分隔线页面的条件：
            const isTooShort = page.height < minValidPageHeight;
            const isGraySeparator = 
                analysis.grayRatio > 0.6 && 
                analysis.colorVariance < 20 && 
                page.height < maxSeparatorHeight;
            const isUniformGray = 
                analysis.isUniform && 
                analysis.avgBrightness > 100 && 
                analysis.avgBrightness < 200 &&
                page.height < maxSeparatorHeight;
            
            const isSeparator = isTooShort || isGraySeparator || isUniformGray;
            
            filterResults.push({
                页面: page.index + 1,
                高度: page.height,
                起始: page.startY,
                结束: page.endY,
                灰色比例: ((analysis.grayRatio || 0) * 100).toFixed(1) + '%',
                颜色方差: (analysis.colorVariance || 0).toFixed(2),
                平均亮度: (analysis.avgBrightness || 0).toFixed(2),
                是否均匀: analysis.isUniform ? '是' : '否',
                判定: isSeparator ? '❌ 分隔线' : '✓ 有效页面'
            });
            
            if (!isSeparator) {
                // 保留有效页面
                continue;
            } else {
                // 标记为过滤
                page.filtered = true;
            }
        }
        
        this.addDebugLog('页面过滤结果', filterResults, 'info');
        
        // 返回未被过滤的页面
        const validPages = pages.filter(p => !p.filtered);
        
        this.addDebugLog(`过滤掉 ${pages.length - validPages.length} 个分隔线页面`, null, 'success');
        
        return validPages;
    }


    /**
     * 分析页面内容
     */
    analyzePageContent(canvas) {
        try {
            // 安全检查
            if (!canvas || !canvas.getContext) {
                console.error('Canvas 无效');
                return this.getDefaultAnalysis();
            }

            const ctx = canvas.getContext('2d');
            if (!ctx) {
                console.error('无法获取 Canvas Context');
                return this.getDefaultAnalysis();
            }

            const width = canvas.width;
            const height = canvas.height;

            if (width === 0 || height === 0) {
                console.error('Canvas 尺寸无效:', width, height);
                return this.getDefaultAnalysis();
            }

            const imageData = ctx.getImageData(0, 0, width, height);
            const data = imageData.data;
            
            let rSum = 0, gSum = 0, bSum = 0;
            let grayPixelCount = 0;
            let colorVarianceSum = 0;
            let brightnessSum = 0;
            let minBrightness = 255;
            let maxBrightness = 0;
            
            const pixelCount = width * height;
            
            // 采样分析（如果图片太大，只采样部分像素）
            const sampleRate = Math.max(1, Math.floor(pixelCount / 100000));
            let sampledCount = 0;
            
            for (let i = 0; i < data.length; i += 4 * sampleRate) {
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];
                
                // 安全检查像素值
                if (r === undefined || g === undefined || b === undefined) {
                    continue;
                }
                
                rSum += r;
                gSum += g;
                bSum += b;
                
                const brightness = (r + g + b) / 3;
                brightnessSum += brightness;
                minBrightness = Math.min(minBrightness, brightness);
                maxBrightness = Math.max(maxBrightness, brightness);
                
                // 计算颜色方差
                const avgRGB = brightness;
                const variance = (
                    Math.pow(r - avgRGB, 2) +
                    Math.pow(g - avgRGB, 2) +
                    Math.pow(b - avgRGB, 2)
                ) / 3;
                colorVarianceSum += variance;
                
                // 判断是否为灰色像素
                const colorDiff = Math.max(
                    Math.abs(r - g),
                    Math.abs(g - b),
                    Math.abs(r - b)
                );
                
                if (colorDiff < 30 && brightness > 100 && brightness < 230) {
                    grayPixelCount++;
                }
                
                sampledCount++;
            }
            
            // 防止除以零
            if (sampledCount === 0) {
                console.error('没有采样到任何像素');
                return this.getDefaultAnalysis();
            }
            
            const avgR = rSum / sampledCount;
            const avgG = gSum / sampledCount;
            const avgB = bSum / sampledCount;
            const avgBrightness = brightnessSum / sampledCount;
            const avgColorVariance = Math.sqrt(colorVarianceSum / sampledCount);
            const grayRatio = grayPixelCount / sampledCount;
            const brightnessRange = maxBrightness - minBrightness;
            
            // 判断是否均匀
            const isUniform = brightnessRange < 30 && avgColorVariance < 15;
            
            return {
                avgR: avgR || 0,
                avgG: avgG || 0,
                avgB: avgB || 0,
                avgBrightness: avgBrightness || 0,
                avgColorVariance: avgColorVariance || 0,
                grayRatio: grayRatio || 0,
                brightnessRange: brightnessRange || 0,
                isUniform: isUniform || false,
                minBrightness: minBrightness || 0,
                maxBrightness: maxBrightness || 0
            };
            
        } catch (error) {
            console.error('分析页面内容时出错:', error);
            return this.getDefaultAnalysis();
        }
    }

    /**
     * 获取默认分析结果（当分析失败时使用）
     */
    getDefaultAnalysis() {
        return {
            avgR: 0,
            avgG: 0,
            avgB: 0,
            avgBrightness: 0,
            avgColorVariance: 0,
            grayRatio: 0,
            brightnessRange: 0,
            isUniform: false,
            minBrightness: 0,
            maxBrightness: 0
        };
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

    /**
     * 显示预览
     */
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

    /**
     * 导出为PDF
     */
    async exportPDF() {
        if (this.processedPages.length === 0) {
            alert('没有可导出的页面！');
            return;
        }

        try {
            // 获取用户输入的文件名
            let filename = this.exportFilenameInput ? this.exportFilenameInput.value.trim() : '';
            
            // 如果没有输入，弹出对话框询问
            if (!filename) {
                filename = prompt('请输入PDF文件名（不需要输入.pdf后缀）:', `split_pages_${new Date().toISOString().slice(0,10)}`);
                
                // 用户取消
                if (filename === null) {
                    return;
                }
                
                filename = filename.trim();
            }
            
            // 如果还是空的，使用默认名称
            if (!filename) {
                filename = `split_pages_${Date.now()}`;
            }
            
            // 移除文件名中的非法字符
            filename = filename.replace(/[<>:"/\\|?*]/g, '_');
            
            // 确保文件名以.pdf结尾
            if (!filename.toLowerCase().endsWith('.pdf')) {
                filename += '.pdf';
            }

            this.addDebugLog(`准备导出PDF: ${filename}`, null, 'info');
            
            // 禁用按钮
            if (this.exportPdfBtn) {
                this.exportPdfBtn.disabled = true;
                this.exportPdfBtn.textContent = '生成中...';
            }

            const generator = new PDFGenerator();
            const pdfBlob = await generator.generate(this.processedPages, (progress, message) => {
                this.updateProgress(progress, message);
            });

            // 验证 Blob
            if (!pdfBlob || !(pdfBlob instanceof Blob)) {
                throw new Error('PDF生成失败：返回的不是有效的Blob对象');
            }

            console.log('准备下载PDF, Blob大小:', pdfBlob.size);

            // 创建下载链接
            const url = URL.createObjectURL(pdfBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            
            // 触发下载
            document.body.appendChild(a);
            a.click();
            
            // 清理
            setTimeout(() => {
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }, 100);

            this.addDebugLog(`✓ PDF导出成功: ${filename}`, null, 'success');
            alert(`PDF导出成功！\n文件名: ${filename}`);

        } catch (error) {
            console.error('PDF导出失败:', error);
            alert('PDF导出失败: ' + error.message);
            this.addDebugLog(`PDF导出失败: ${error.message}`, null, 'error');
        } finally {
            // 恢复按钮
            if (this.exportPdfBtn) {
                this.exportPdfBtn.disabled = false;
                this.exportPdfBtn.textContent = '📥 导出为PDF';
            }
        }
    }


    /**
     * 导出为图片
     */
    async exportImages() {
        if (this.processedPages.length === 0) {
            alert('没有可导出的页面！');
            return;
        }

        try {
            // 获取用户输入的文件名前缀
            let filenamePrefix = this.exportFilenameInput ? this.exportFilenameInput.value.trim() : '';
            
            // 如果没有输入，弹出对话框询问
            if (!filenamePrefix) {
                filenamePrefix = prompt('请输入文件名前缀（将自动添加页码）:', `page_${new Date().toISOString().slice(0,10)}`);
                
                // 用户取消
                if (filenamePrefix === null) {
                    return;
                }
                
                filenamePrefix = filenamePrefix.trim();
            }
            
            // 如果还是空的，使用默认名称
            if (!filenamePrefix) {
                filenamePrefix = `page_${Date.now()}`;
            }
            
            // 移除文件名中的非法字符
            filenamePrefix = filenamePrefix.replace(/[<>:"/\\|?*]/g, '_');

            this.addDebugLog(`准备导出 ${this.processedPages.length} 张图片`, null, 'info');
            
            // 禁用按钮
            if (this.exportImagesBtn) {
                this.exportImagesBtn.disabled = true;
                this.exportImagesBtn.textContent = '导出中...';
            }

            // 计算页码宽度（用于补零）
            const pageNumWidth = this.processedPages.length.toString().length;

            // 逐个下载图片
            for (let i = 0; i < this.processedPages.length; i++) {
                const progress = ((i + 1) / this.processedPages.length) * 100;
                this.updateProgress(progress, `导出图片 ${i + 1}/${this.processedPages.length}...`);

                // 生成文件名，页码补零
                const pageNum = (i + 1).toString().padStart(pageNumWidth, '0');
                const filename = `${filenamePrefix}_${pageNum}.png`;

                // 创建下载链接
                const a = document.createElement('a');
                a.href = this.processedPages[i];
                a.download = filename;
                
                // 触发下载
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);

                // 添加延迟，避免浏览器阻止多个下载
                await new Promise(resolve => setTimeout(resolve, 200));

                this.addDebugLog(`✓ 已导出: ${filename}`, null, 'success');
            }

            this.updateProgress(100, '导出完成！');
            alert(`成功导出 ${this.processedPages.length} 张图片！\n文件名格式: ${filenamePrefix}_01.png`);

        } catch (error) {
            console.error('图片导出失败:', error);
            alert('图片导出失败: ' + error.message);
            this.addDebugLog(`图片导出失败: ${error.message}`, null, 'error');
        } finally {
            // 恢复按钮
            if (this.exportImagesBtn) {
                this.exportImagesBtn.disabled = false;
                this.exportImagesBtn.textContent = '🖼️ 导出为图片';
            }
        }
    }


    /**
     * 滚动到顶部
     */
    scrollToTop() {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
        
        // 添加弹跳动画
        if (this.toTopBtn) {
            this.toTopBtn.classList.add('bounce');
            setTimeout(() => {
                this.toTopBtn.classList.remove('bounce');
            }, 600);
        }
    }

    /**
     * 滚动到底部
     */
    scrollToBottom() {
        window.scrollTo({
            top: document.documentElement.scrollHeight,
            behavior: 'smooth'
        });
        
        // 添加弹跳动画
        if (this.toBottomBtn) {
            this.toBottomBtn.classList.add('bounce');
            setTimeout(() => {
                this.toBottomBtn.classList.remove('bounce');
            }, 600);
        }
    }

    /**
     * 滚动到操作区
     */
    scrollToOptions() {
        if (this.optionsSection) {
            const rect = this.optionsSection.getBoundingClientRect();
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            const targetPosition = rect.top + scrollTop - 20; // 留20px边距
            
            window.scrollTo({
                top: targetPosition,
                behavior: 'smooth'
            });
            
            // 添加弹跳动画
            if (this.toOptionsBtn) {
                this.toOptionsBtn.classList.add('bounce');
                setTimeout(() => {
                    this.toOptionsBtn.classList.remove('bounce');
                }, 600);
            }
            
            // 高亮操作区（可选）
            if (this.optionsSection) {
                this.optionsSection.style.transition = 'all 0.3s';
                this.optionsSection.style.boxShadow = '0 0 20px rgba(102, 126, 234, 0.5)';
                setTimeout(() => {
                    this.optionsSection.style.boxShadow = '';
                }, 1000);
            }
        }
    }

    /**
     * 处理滚动事件，控制浮动按钮显示（简化版）
     */
    handleScroll() {
        if (!this.floatButtons) return;

        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const scrollHeight = document.documentElement.scrollHeight;
        const clientHeight = document.documentElement.clientHeight;

        // 始终显示所有按钮
        if (this.toTopBtn) this.toTopBtn.classList.add('show');
        if (this.toBottomBtn) this.toBottomBtn.classList.add('show');
        if (this.toOptionsBtn && this.optionsSection && this.optionsSection.style.display !== 'none') {
            this.toOptionsBtn.classList.add('show');
        }

        // 可选：根据位置调整透明度（视觉提示）
        if (scrollTop < 100) {
            // 在顶部时，淡化"返回顶部"按钮
            if (this.toTopBtn) {
                this.toTopBtn.style.opacity = '0.4';
            }
        } else {
            if (this.toTopBtn) {
                this.toTopBtn.style.opacity = '1';
            }
        }

        const distanceToBottom = scrollHeight - scrollTop - clientHeight;
        if (distanceToBottom < 100) {
            // 接近底部时，淡化"跳转到底部"按钮
            if (this.toBottomBtn) {
                this.toBottomBtn.style.opacity = '0.4';
            }
        } else {
            if (this.toBottomBtn) {
                this.toBottomBtn.style.opacity = '1';
            }
        }
    }

}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM 加载完成，开始初始化应用...');
    
    // 检查关键元素是否存在
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    
    if (!dropZone) {
        console.error('❌ 找不到 dropZone 元素！');
        alert('页面加载错误：找不到上传区域元素，请检查 HTML 文件');
        return;
    }
    
    if (!fileInput) {
        console.error('❌ 找不到 fileInput 元素！');
        alert('页面加载错误：找不到文件输入元素，请检查 HTML 文件');
        return;
    }
    
    console.log('✓ 关键元素检查通过');
    
    try {
        window.app = new ImageSplitterApp();
        console.log('✓ 应用初始化成功');
    } catch (error) {
        console.error('❌ 应用初始化失败:', error);
        alert('应用初始化失败: ' + error.message);
    }
});
