"""
Application Configuration
"""
from pydantic_settings import BaseSettings
from pathlib import Path


class Settings(BaseSettings):
    """Application settings"""

    # App
    APP_NAME: str = "Scene Splitter API"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True

    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    # Upload
    MAX_UPLOAD_SIZE: int = 2 * 1024 * 1024 * 1024  # 2GB
    CHUNK_SIZE: int = 10 * 1024 * 1024  # 10MB chunks

    # Storage Paths
    BASE_DIR: Path = Path(__file__).parent.parent
    VIDEO_STORAGE: Path = BASE_DIR / "storage" / "videos"
    SCENE_STORAGE: Path = BASE_DIR / "storage" / "scenes"
    FRAME_STORAGE: Path = BASE_DIR / "storage" / "frames"

    # Database
    DATABASE_URL: str = "sqlite:///./scene_splitter.db"

    # Redis
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    REDIS_DB: int = 0

    # Celery
    CELERY_BROKER_URL: str = "redis://localhost:6379/0"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/0"

    # AI Model Settings
    AI_MODEL_NAME: str = "BLIP"  # or "CLIP"
    CLIP_MODEL: str = "openai/clip-vit-base-patch32"

    # Scene Detection Settings
    SCENE_THRESHOLD: float = 30.0  # ContentDetector threshold
    MIN_SCENE_LENGTH: float = 1.0  # Minimum scene length in seconds

    class Config:
        env_file = ".env"
        extra = "allow"


settings = Settings()

# Ensure storage directories exist
settings.VIDEO_STORAGE.mkdir(parents=True, exist_ok=True)
settings.SCENE_STORAGE.mkdir(parents=True, exist_ok=True)
settings.FRAME_STORAGE.mkdir(parents=True, exist_ok=True)
