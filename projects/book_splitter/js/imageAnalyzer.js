class ImageAnalyzer {
    constructor() {
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');
    }

    async analyze(file, debugCallback) {
        const log = (msg, data, type) => {
            if (debugCallback) debugCallback(msg, data, type);
        };

        const img = await this.loadImage(file);

        this.canvas.width = img.width;
        this.canvas.height = img.height;
        this.ctx.drawImage(img, 0, 0);

        const imageData = this.ctx.getImageData(0, 0, img.width, img.height);
        const data = imageData.data;

        const analysis = { rows: [], stats: { minBrightness: 255, maxBrightness: 0, avgBrightness: 0 } };
        const sampleRate = Math.min(10, Math.max(1, Math.floor(img.height / 10000)));

        let totalBrightness = 0, sampleCount = 0;

        for (let y = 0; y < img.height; y += sampleRate) {
            let rSum = 0, gSum = 0, bSum = 0, brightnessSum = 0;

            for (let x = 0; x < img.width; x++) {
                const i = (y * img.width + x) * 4;
                rSum += data[i];
                gSum += data[i + 1];
                bSum += data[i + 2];
                brightnessSum += (data[i] + data[i + 1] + data[i + 2]) / 3;
            }

            const avgBrightness = brightnessSum / img.width;
            analysis.rows.push({ y, brightness: avgBrightness });
            analysis.stats.minBrightness = Math.min(analysis.stats.minBrightness, avgBrightness);
            analysis.stats.maxBrightness = Math.max(analysis.stats.maxBrightness, avgBrightness);
            totalBrightness += avgBrightness;
            sampleCount++;
        }

        analysis.stats.avgBrightness = totalBrightness / sampleCount;

        log('分析完成', null, 'success');
        return analysis;
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
}
