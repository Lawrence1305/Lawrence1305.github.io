# Question Extractor - 试卷题目提取器

## 1. Project Overview

**Project Name:** Question Extractor
**Project Type:** Static Web Application (Single HTML)
**Core Functionality:** 用户上传试卷PDF，自动识别并提取每道题目，保存为图片到用户选择的文件夹
**Target Users:** 教师、学生、教育工作者

## 2. UI/UX Specification

### Layout Structure

```
+------------------------------------------+
|              Header                       |
|         "试卷题目提取器"                   |
+------------------------------------------+
|              Upload Area                  |
|    [点击或拖拽上传 PDF 文件]               |
+------------------------------------------+
|           File Info Panel                 |
|    文件名: xxx.pdf | 页数: X              |
+------------------------------------------+
|           Preview Panel                   |
|    +----------+  +----------+              |
|    | Page 1   |  | Page 2   |   ...       |
|    | 预览缩略 |  | 预览缩略 |              |
|    +----------+  +----------+              |
+------------------------------------------+
|           Detection Settings             |
|    题号格式: [自动检测 ▼]                   |
|    [开始提取题目]                           |
+------------------------------------------+
|           Progress & Results              |
|    进度条                                  |
|    提取结果列表                            |
+------------------------------------------+
|           Actions                         |
|    [选择保存文件夹] [开始保存]               |
+------------------------------------------+
|              Footer                       |
+------------------------------------------+
```

### Visual Design

**Color Palette:**
- Primary: `#2563eb` (蓝色)
- Primary Hover: `#1d4ed8`
- Secondary: `#64748b` (灰色)
- Background: `#f8fafc`
- Card Background: `#ffffff`
- Text Primary: `#1e293b`
- Text Secondary: `#64748b`
- Success: `#22c55e`
- Error: `#ef4444`
- Border: `#e2e8f0`

**Typography:**
- Font Family: `"Noto Sans SC", "Microsoft YaHei", sans-serif`
- Heading: 24px bold
- Subheading: 18px semibold
- Body: 14px regular
- Small: 12px regular

**Spacing:**
- Container max-width: 900px
- Section padding: 24px
- Card padding: 20px
- Gap between elements: 16px

**Visual Effects:**
- Card shadow: `0 1px 3px rgba(0,0,0,0.1)`
- Hover shadow: `0 4px 6px rgba(0,0,0,0.1)`
- Border radius: 8px
- Transitions: 0.2s ease

### Components

1. **Upload Area**
   - 虚线边框拖拽区域
   - 点击上传按钮
   - 支持拖拽上传
   - 状态: default, hover, dragover, processing

2. **File Info Panel**
   - 显示文件名、页数
   - 删除按钮

3. **Page Preview Grid**
   - 每页缩略图预览
   - 页码标注
   - 可点击查看大图

4. **Settings Panel**
   - 题号格式选择（自动检测、阿拉伯数字、中文数字、字母）
   - 开始提取按钮

5. **Progress Panel**
   - 进度条
   - 当前处理状态
   - 提取结果列表（题目名称、页码）

6. **Action Buttons**
   - 选择保存文件夹按钮
   - 开始保存按钮
   - 状态: disabled when no folder selected

## 3. Functionality Specification

### Core Features

1. **PDF Upload**
   - 支持 .pdf 文件上传
   - 拖拽或点击上传
   - 文件大小限制 50MB
   - 显示文件信息

2. **PDF Preview**
   - 使用 pdf.js 解析 PDF
   - 生成每页缩略图预览
   - 支持查看大图

3. **Question Detection**
   - 自动检测题号模式：
     - 阿拉伯数字: 1., 2., 3., ...
     - 中文数字: 一、, 二、, 三、, ...
     - 字母: A., B., C., ... (选择题选项)
   - 分析文本内容定位题目边界
   - 识别题目区域坐标

4. **Question Extraction**
   - 使用 pdf.js 渲染题目区域
   - 使用 html2canvas 导出为图片
   - 图片格式: PNG
   - 图片命名: `{PDF文件名}_Q{n}.png`

5. **Folder Selection**
   - 使用 File System Access API
   - 允许用户选择保存文件夹
   - 兼容不支持的浏览器使用下载方式

6. **Image Saving**
   - 批量保存图片到选定文件夹
   - 显示保存进度

### User Interactions

1. 上传 PDF → 解析并显示预览
2. 选择题号格式（可选，默认自动检测）
3. 点击"开始提取" → 分析并提取题目
4. 点击"选择保存文件夹" → 打开文件夹选择器
5. 点击"开始保存" → 保存所有题目图片

### Edge Cases

- 空PDF: 提示用户
- 无法识别题目: 提示用户手动检查
- 浏览器不支持 File System Access API: 降级为 ZIP 下载
- 大文件处理: 显示加载状态

## 4. Technical Implementation

### Libraries (CDN)

- **pdf.js**: PDF 解析和渲染
- **pdf.worker.js**: PDF.js worker
- **html2canvas**: DOM 转图片

### File Structure

```
projects/Question_Extractor/
├── index.html      # 主页面（单文件应用）
└── SPEC.md         # 规格说明
```

## 5. Acceptance Criteria

1. ✅ 用户可以上传 PDF 文件
2. ✅ 上传后显示 PDF 预览
3. ✅ 可以自动检测题目边界
4. ✅ 提取的题目显示在列表中
5. ✅ 用户可以选择保存文件夹
6. ✅ 图片保存到指定文件夹
7. ✅ 图片命名正确（文件名+题号）
8. ✅ 界面美观，操作流畅
