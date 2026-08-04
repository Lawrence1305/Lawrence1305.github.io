"""
Celery Configuration
"""
from celery import Celery
from celery.schedules import crontab
from app.core.config import settings

# Create Celery app
celery_app = Celery(
    "scene_splitter",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=["app.tasks.video_tasks"]
)

# Celery configuration
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=7200,  # 2 hours max
    task_soft_time_limit=6600,  # 1h50m soft limit
    worker_prefetch_multiplier=1,
    worker_max_tasks_per_child=10,
)

# Periodic tasks (if needed)
celery_app.conf.beat_schedule = {}
