# Scene Splitter - 视频分镜自动分割与AI打标签

基于 PySceneDetect + FFmpeg + AI 模型的视频智能分割系统。

## 功能特性

- 大文件分片上传（支持 2GB+ 视频）
- 视频自动分镜检测（镜头边界检测）
- FFmpeg 视频切割
- AI 关键帧提取与自动打标签
- 标签和语义搜索
- 异步任务处理（Celery + Redis）

## 技术栈

- **后端**: FastAPI + Python
- **任务队列**: Redis + Celery
- **数据库**: SQLite (开发) / PostgreSQL (生产)
- **视频处理**: FFmpeg + PySceneDetect
- **AI 模型**: BLIP (图像描述) + CLIP (零样本分类)
- **前端**: Vue 3 + Bootstrap 5

## 快速开始

### 1. 环境要求

- Python 3.9+
- FFmpeg (已安装并添加到 PATH)
- Redis Server
- 8GB+ RAM (推荐 16GB)
- GPU (可选，用于加速 AI 推理)

### 2. 安装依赖

```bash
cd backend

# 创建虚拟环境
python -m venv venv
source venv/bin/activate  # Linux/Mac
# 或 venv\Scripts\activate  # Windows

# 安装依赖
pip install -r requirements.txt
```

### 3. 配置环境

复制 `.env.example` 为 `.env` 并修改配置：

```env
# 开发模式
DEBUG=true

# Redis 配置
REDIS_HOST=localhost
REDIS_PORT=6379

# Celery 配置
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/0

# AI 模型设置
AI_MODEL_NAME=BLIP
```

### 4. 启动服务

#### 启动 Redis (Windows)

```bash
# 使用 Chocolatey
choco install redis-64

# 或下载 Redis for Windows
# https://github.com/tporadowski/redis/releases
```

#### 启动 Celery Worker

```bash
cd backend
celery -A app.core.celery worker --loglevel=info
```

#### 启动 FastAPI 服务器

```bash
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 5. 访问应用

打开浏览器访问: http://localhost:8000

## 使用说明

### 上传视频

1. 点击 "上传视频" 或拖拽视频文件到上传区域
2. 系统会自动进行分片上传
3. 上传完成后，点击 "查看" 进入视频详情

### 处理视频

1. 在视频详情页，点击 "处理" 按钮
2. 系统会自动：
   - 检测镜头边界 (PySceneDetect)
   - 切割视频片段 (FFmpeg)
   - 提取关键帧
   - AI 分析打标签 (BLIP + CLIP)

### 搜索分镜

1. 点击 "搜索" 进入搜索页面
2. 输入标签或描述关键词
3. 系统会返回匹配的分镜片段

## 项目结构

```
Scene_Splitter/
├── backend/
│   ├── app/
│   │   ├── api/           # API 路由
│   │   ├── core/          # 核心配置 (Celery, Config)
│   │   ├── models/        # 数据库模型
│   │   ├── services/      # 业务逻辑
│   │   │   ├── video_processor.py  # 视频处理
│   │   │   └── ai_analyzer.py     # AI 分析
│   │   ├── tasks/         # Celery 任务
│   │   └── main.py        # FastAPI 应用
│   ├── storage/           # 文件存储
│   │   ├── videos/        # 原始视频
│   │   ├── scenes/        # 切割后的分镜
│   │   └── frames/        # 关键帧图片
│   └── requirements.txt   # Python 依赖
├── index.html             # 前端界面
└── README.md
```

## API 文档

启动服务后访问: http://localhost:8000/docs

### 主要接口

- `POST /api/videos/upload` - 上传视频
- `POST /api/videos/upload/chunk` - 分片上传
- `POST /api/videos/{id}/process` - 开始处理
- `GET /api/videos` - 获取视频列表
- `GET /api/videos/{id}/scenes` - 获取分镜列表
- `GET /api/search/scenes` - 搜索分镜

## 常见问题

### Q: 处理速度很慢怎么办？

A:
- 使用 GPU 加速 AI 推理
- 调整 PySceneDetect 的 threshold 参数减少检测时间
- 使用 H.265 编码替代全程重新编码

### Q: 内存不足？

A:
- 减小同时处理的任务数
- 使用流式处理代替一次性加载
- 增加 swap 空间

### Q: 如何部署到生产环境？

A:
1. 使用 PostgreSQL 替代 SQLite
2. 使用 Nginx 作为反向代理
3. 配置 Celery 为系统服务
4. 使用 MinIO/S3 存储文件
5. 配置 HTTPS

## 许可证

MIT License
