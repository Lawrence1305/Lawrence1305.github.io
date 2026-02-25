/**
 * PDF生成器
 * 将分割后的图片页面导出为PDF
 */
class PDFGenerator {
    constructor() {
        this.progressCallback = null;
    }

    /**
     * 生成PDF
     * @param {Array} pages - 页面数据URL数组
     * @param {Function} progressCallback - 进度回调
     * @returns {Promise<Blob>} PDF Blob对象
     */
    async generate(pages, progressCallback = null) {
        this.progressCallback = progressCallback;

        if (!pages || pages.length === 0) {
            throw new Error('没有可导出的页面');
        }

        this.updateProgress(0, '准备生成PDF...');

        try {
            // 检查 jsPDF 是否可用
            if (typeof window.jspdf === 'undefined' && typeof jsPDF === 'undefined') {
                throw new Error('jsPDF 库未加载，请检查网络连接');
            }

            // 获取 jsPDF 构造函数
            const { jsPDF } = window.jspdf || window;

            if (!jsPDF) {
                throw new Error('无法访问 jsPDF，请刷新页面重试');
            }

            this.updateProgress(10, '加载第一页...');

            // 加载第一页以获取尺寸
            const firstImage = await this.loadImage(pages[0]);
            const imgWidth = firstImage.width;
            const imgHeight = firstImage.height;

            // 计算PDF页面尺寸（单位：mm）
            // A4: 210 x 297 mm
            const pdfWidth = 210;
            const pdfHeight = (imgHeight / imgWidth) * pdfWidth;

            console.log('PDF尺寸:', { pdfWidth, pdfHeight, imgWidth, imgHeight });

            // 创建PDF文档
            const pdf = new jsPDF({
                orientation: pdfHeight > pdfWidth ? 'portrait' : 'landscape',
                unit: 'mm',
                format: [pdfWidth, pdfHeight]
            });

            this.updateProgress(20, '开始添加页面...');

            // 添加所有页面
            for (let i = 0; i < pages.length; i++) {
                const progress = 20 + (i / pages.length) * 70;
                this.updateProgress(progress, `添加页面 ${i + 1}/${pages.length}...`);

                // 如果不是第一页，添加新页面
                if (i > 0) {
                    // 加载当前页面以获取尺寸
                    const currentImage = await this.loadImage(pages[i]);
                    const currentHeight = (currentImage.height / currentImage.width) * pdfWidth;
                    
                    pdf.addPage([pdfWidth, currentHeight]);
                }

                // 添加图片到PDF
                try {
                    pdf.addImage(
                        pages[i],
                        'PNG',
                        0,
                        0,
                        pdfWidth,
                        i === 0 ? pdfHeight : (await this.loadImage(pages[i])).height / (await this.loadImage(pages[i])).width * pdfWidth,
                        undefined,
                        'FAST'
                    );
                } catch (error) {
                    console.error(`添加页面 ${i + 1} 失败:`, error);
                    throw new Error(`添加页面 ${i + 1} 失败: ${error.message}`);
                }

                console.log(`✓ 页面 ${i + 1} 已添加`);
            }

            this.updateProgress(95, '生成PDF文件...');

            // 生成PDF Blob
            const pdfBlob = pdf.output('blob');

            if (!pdfBlob || !(pdfBlob instanceof Blob)) {
                throw new Error('PDF生成失败：返回的不是有效的Blob对象');
            }

            console.log('PDF Blob生成成功:', pdfBlob);
            console.log('Blob大小:', (pdfBlob.size / 1024 / 1024).toFixed(2), 'MB');

            this.updateProgress(100, 'PDF生成完成！');

            return pdfBlob;

        } catch (error) {
            console.error('PDF生成错误:', error);
            throw new Error(`PDF生成失败: ${error.message}`);
        }
    }

    /**
     * 加载图片
     */
    loadImage(dataURL) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error('图片加载失败'));
            img.src = dataURL;
        });
    }

    /**
     * 更新进度
     */
    updateProgress(percent, message) {
        if (this.progressCallback) {
            this.progressCallback(percent, message);
        }
    }
}
