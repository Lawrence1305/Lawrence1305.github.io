/**
 * 图片处理器 - 负责图片分割
 */
class ImageProcessor {
    constructor() {
        console.log('ImageProcessor 初始化');
    }

    /**
     * 分割图片
     * @param {Image} image - 原始图片
     * @param {Array} splitPoints - 分割点数组 [{start, end}, ...]
     * @returns {Promise<Array>} - 返回分割后的图片数据URL数组
     */
    async splitImage(image, splitPoints) {
        console.log('开始分割图片，分割点数量:', splitPoints.length);
        
        if (!splitPoints || splitPoints.length === 0) {
            console.log('没有分割点，返回整张图片');
            return [this.imageToDataURL(image, 0, 0, image.width, image.height)];
        }

        const pages = [];
        
        // 遍历每个分割区域
        for (let i = 0; i < splitPoints.length; i++) {
            const region = splitPoints[i];
            const y = region.start;
            const height = region.end - region.start;
            
            console.log(`分割第 ${i + 1} 页: y=${y}, height=${height}`);
            
            // 创建该区域的图片
            const pageDataURL = this.imageToDataURL(image, 0, y, image.width, height);
            pages.push(pageDataURL);
        }

        console.log(`✓ 分割完成，共 ${pages.length} 页`);
        return pages;
    }

    /**
     * 将图片区域转换为 Data URL
     * @param {Image} image - 原始图片
     * @param {number} x - 起始 x 坐标
     * @param {number} y - 起始 y 坐标
     * @param {number} width - 宽度
     * @param {number} height - 高度
     * @returns {string} - Data URL
     */
    imageToDataURL(image, x, y, width, height) {
        // 创建临时 canvas
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        
        // 绘制图片的指定区域
        ctx.drawImage(
            image,
            x, y, width, height,  // 源图片的区域
            0, 0, width, height   // 目标 canvas 的区域
        );
        
        // 转换为 Data URL
        return canvas.toDataURL('image/png');
    }

    /**
     * 获取图片的像素数据
     * @param {Image} image - 图片对象
     * @returns {ImageData} - 图片像素数据
     */
    getImageData(image) {
        const canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        
        const ctx = canvas.getContext('2d');
        ctx.drawImage(image, 0, 0);
        
        return ctx.getImageData(0, 0, image.width, image.height);
    }

    /**
     * 验证分割点
     * @param {Array} splitPoints - 分割点数组
     * @param {number} imageHeight - 图片高度
     * @returns {boolean} - 是否有效
     */
    validateSplitPoints(splitPoints, imageHeight) {
        if (!splitPoints || splitPoints.length === 0) {
            return false;
        }

        for (let i = 0; i < splitPoints.length; i++) {
            const region = splitPoints[i];
            
            // 检查区域是否有效
            if (region.start < 0 || region.end > imageHeight) {
                console.error(`无效的分割区域 ${i}:`, region);
                return false;
            }
            
            if (region.start >= region.end) {
                console.error(`无效的分割区域 ${i}: start >= end`, region);
                return false;
            }
            
            // 检查区域高度
            const height = region.end - region.start;
            if (height < 10) {
                console.warn(`分割区域 ${i} 太小: ${height}px`, region);
            }
        }

        return true;
    }

    /**
     * 合并相邻的分割点
     * @param {Array} splitPoints - 分割点数组
     * @param {number} minGap - 最小间隔（像素）
     * @returns {Array} - 合并后的分割点数组
     */
    mergeSplitPoints(splitPoints, minGap = 10) {
        if (!splitPoints || splitPoints.length <= 1) {
            return splitPoints;
        }

        const merged = [];
        let current = { ...splitPoints[0] };

        for (let i = 1; i < splitPoints.length; i++) {
            const next = splitPoints[i];
            
            // 如果间隔太小，合并
            if (next.start - current.end < minGap) {
                current.end = next.end;
            } else {
                merged.push(current);
                current = { ...next };
            }
        }

        merged.push(current);
        
        console.log(`合并分割点: ${splitPoints.length} -> ${merged.length}`);
        return merged;
    }

    /**
     * 过滤太小的页面
     * @param {Array} splitPoints - 分割点数组
     * @param {number} minHeight - 最小高度（像素）
     * @returns {Array} - 过滤后的分割点数组
     */
    filterSmallPages(splitPoints, minHeight = 50) {
        if (!splitPoints || splitPoints.length === 0) {
            return splitPoints;
        }

        const filtered = splitPoints.filter(region => {
            const height = region.end - region.start;
            return height >= minHeight;
        });

        if (filtered.length < splitPoints.length) {
            console.log(`过滤小页面: ${splitPoints.length} -> ${filtered.length}`);
        }

        return filtered;
    }

    /**
     * 调整分割点以避免重叠
     * @param {Array} splitPoints - 分割点数组
     * @returns {Array} - 调整后的分割点数组
     */
    adjustSplitPoints(splitPoints) {
        if (!splitPoints || splitPoints.length <= 1) {
            return splitPoints;
        }

        const adjusted = [];
        
        for (let i = 0; i < splitPoints.length; i++) {
            const region = { ...splitPoints[i] };
            
            // 确保不与前一个区域重叠
            if (i > 0 && region.start < adjusted[i - 1].end) {
                region.start = adjusted[i - 1].end;
            }
            
            // 确保区域有效
            if (region.start < region.end) {
                adjusted.push(region);
            }
        }

        return adjusted;
    }
}

// 确保类在全局作用域中可用
if (typeof window !== 'undefined') {
    window.ImageProcessor = ImageProcessor;
}
