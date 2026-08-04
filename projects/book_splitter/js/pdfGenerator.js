class PDFGenerator {
    constructor() {
        this.progressCallback = null;
    }

    async generate(pages, progressCallback = null) {
        this.progressCallback = progressCallback;

        if (!pages || pages.length === 0) {
            throw new Error('没有可导出的页面');
        }

        this.updateProgress(0, '准备生成PDF...');

        try {
            if (typeof window.jspdf === 'undefined' && typeof jsPDF === 'undefined') {
                throw new Error('jsPDF 库未加载，请检查网络连接');
            }

            const { jsPDF } = window.jspdf || window;

            if (!jsPDF) {
                throw new Error('无法访问 jsPDF，请刷新页面重试');
            }

            this.updateProgress(10, '加载第一页...');

            const firstImage = await this.loadImage(pages[0]);
            const imgWidth = firstImage.width;
            const imgHeight = firstImage.height;

            const pdfWidth = 210;
            const pdfHeight = (imgHeight / imgWidth) * pdfWidth;

            const pdf = new jsPDF({
                orientation: pdfHeight > pdfWidth ? 'portrait' : 'landscape',
                unit: 'mm',
                format: [pdfWidth, pdfHeight]
            });

            this.updateProgress(20, '开始添加页面...');

            for (let i = 0; i < pages.length; i++) {
                const progress = 20 + (i / pages.length) * 70;
                this.updateProgress(progress, `添加页面 ${i + 1}/${pages.length}...`);

                if (i > 0) {
                    const currentImage = await this.loadImage(pages[i]);
                    const currentHeight = (currentImage.height / currentImage.width) * pdfWidth;
                    pdf.addPage([pdfWidth, currentHeight]);
                }

                try {
                    pdf.addImage(pages[i], 'PNG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
                } catch (error) {
                    throw new Error(`添加页面 ${i + 1} 失败: ${error.message}`);
                }
            }

            this.updateProgress(95, '生成PDF文件...');

            const pdfBlob = pdf.output('blob');

            if (!pdfBlob || !(pdfBlob instanceof Blob)) {
                throw new Error('PDF生成失败：返回的不是有效的Blob对象');
            }

            this.updateProgress(100, 'PDF生成完成！');

            return pdfBlob;

        } catch (error) {
            throw new Error(`PDF生成失败: ${error.message}`);
        }
    }

    loadImage(dataURL) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error('图片加载失败'));
            img.src = dataURL;
        });
    }

    updateProgress(percent, message) {
        if (this.progressCallback) {
            this.progressCallback(percent, message);
        }
    }
}
