"""
Celery Tasks for Video Processing
"""
import os
import json
import logging
from celery import Task
from pathlib import Path

from app.core.celery import celery_app
from app.core.config import settings
from app.models.database import Video, Scene, Task as TaskModel
from app.models.session import SessionLocal
from app.services.video_processor import VideoProcessor, SceneDetector
from app.services.ai_analyzer import ai_analyzer

logger = logging.getLogger(__name__)


def get_db_session():
    """Get database session for tasks"""
    db = SessionLocal()
    try:
        return db
    finally:
        pass


def update_task_progress(task_id: str, progress: float, message: str, status: str = "started"):
    """Update task progress in database"""
    db = get_db_session()
    try:
        task = db.query(TaskModel).filter(TaskModel.task_id == task_id).first()
        if task:
            task.progress = progress
            task.message = message
            task.status = status
            if status == "completed":
                task.completed_at = __import__("datetime").datetime.utcnow()
            db.commit()
    except Exception as e:
        logger.error(f"Error updating task: {e}")
    finally:
        db.close()


@celery_app.task(bind=True, name="app.tasks.process_video")
def process_video(self, video_id: int):
    """
    Main task: Process video - detect scenes, cut videos, analyze with AI
    """
    db = get_db_session()
    task_id = self.request.id

    try:
        # Get video from database
        video = db.query(Video).filter(Video.id == video_id).first()
        if not video:
            raise ValueError(f"Video {video_id} not found")

        # Update status
        video.status = "processing"
        db.commit()

        update_task_progress(task_id, 10, "Starting video processing...", "started")

        # Step 1: Get video info if not already available
        if not video.duration:
            update_task_progress(task_id, 20, "Analyzing video metadata...")
            video_info = VideoProcessor.get_video_info(video.file_path)
            video.duration = video_info["duration"]
            video.width = video_info["width"]
            video.height = video_info["height"]
            video.fps = video_info["fps"]
            db.commit()

        # Step 2: Detect scenes
        update_task_progress(task_id, 30, "Detecting scene boundaries...")
        detector = SceneDetector()
        scenes = detector.detect_scenes(video.file_path)

        if not scenes:
            # If no scenes detected, create one scene for the whole video
            scenes = [(0, video.duration)]

        # Create scene records
        total_scenes = len(scenes)
        for idx, (start, end) in enumerate(scenes):
            scene = Scene(
                video_id=video.id,
                start_time=start,
                end_time=end,
                duration=end - start,
                scene_index=idx
            )
            db.add(scene)
        db.commit()

        update_task_progress(task_id, 50, f"Detected {total_scenes} scenes, cutting videos...")

        # Step 3: Cut videos and extract keyframes
        video_dir = settings.SCENE_STORAGE / str(video.id)
        video_dir.mkdir(parents=True, exist_ok=True)

        frame_dir = settings.FRAME_STORAGE / str(video.id)
        frame_dir.mkdir(parents=True, exist_ok=True)

        scenes = db.query(Scene).filter(Scene.video_id == video.id).order_by(Scene.scene_index).all()
        total = len(scenes)

        for idx, scene in enumerate(scenes):
            scene_num = idx + 1
            progress = 50 + int((scene_num / total) * 30)

            # Cut video segment
            output_video_path = video_dir / f"scene_{scene.scene_index:04d}.mp4"
            success = VideoProcessor.cut_video(
                video.file_path,
                str(output_video_path),
                scene.start_time,
                scene.end_time
            )

            if success:
                scene.scene_video_path = str(output_video_path)

                # Extract keyframe (at 25% of the scene)
                keyframe_time = scene.start_time + (scene.duration * 0.25)
                keyframe_path = frame_dir / f"scene_{scene.scene_index:04d}.jpg"

                VideoProcessor.extract_keyframe(
                    video.file_path,
                    keyframe_time,
                    str(keyframe_path)
                )

                if keyframe_path.exists():
                    scene.keyframe_path = str(keyframe_path)

            update_task_progress(
                task_id,
                progress,
                f"Processing scene {scene_num}/{total}..."
            )

        db.commit()

        # Step 4: AI Analysis
        update_task_progress(task_id, 85, "Analyzing scenes with AI...")

        scenes = db.query(Scene).filter(Scene.video_id == video.id).all()
        total = len(scenes)

        for idx, scene in enumerate(scenes):
            scene_num = idx + 1
            progress = 85 + int((scene_num / total) * 10)

            if scene.keyframe_path and os.path.exists(scene.keyframe_path):
                # Analyze with AI
                analysis = ai_analyzer.analyze_scene(scene.keyframe_path)

                if analysis["caption"]:
                    scene.description = analysis["caption"]
                if analysis["tags"]:
                    scene.tags = json.dumps(analysis["tags"])
                scene.is_processed = True

            update_task_progress(
                task_id,
                progress,
                f"Analyzing scene {scene_num}/{total}..."
            )

        db.commit()

        # Complete
        video.status = "completed"
        db.commit()

        update_task_progress(task_id, 100, "Video processing completed!", "completed")

        return {
            "video_id": video_id,
            "total_scenes": total_scenes,
            "status": "completed"
        }

    except Exception as e:
        logger.error(f"Error processing video: {e}")
        if video:
            video.status = "failed"
            db.commit()
        update_task_progress(task_id, 0, str(e), "failed")
        raise


@celery_app.task(name="app.tasks.analyze_single_scene")
def analyze_single_scene(scene_id: int):
    """
    Task to analyze a single scene with AI (for manual retry)
    """
    db = get_db_session()

    try:
        scene = db.query(Scene).filter(Scene.id == scene_id).first()
        if not scene:
            raise ValueError(f"Scene {scene_id} not found")

        if scene.keyframe_path and os.path.exists(scene.keyframe_path):
            analysis = ai_analyzer.analyze_scene(scene.keyframe_path)

            if analysis["caption"]:
                scene.description = analysis["caption"]
            if analysis["tags"]:
                scene.tags = json.dumps(analysis["tags"])
            scene.is_processed = True
            db.commit()

        return {"scene_id": scene_id, "status": "analyzed"}

    except Exception as e:
        logger.error(f"Error analyzing scene: {e}")
        raise
    finally:
        db.close()
