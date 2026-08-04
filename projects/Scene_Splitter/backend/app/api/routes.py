"""
API Routes
"""
import os
import json
import hashlib
import aiofiles
from pathlib import Path
from typing import List, Optional
from datetime import datetime

from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.database import Video, Scene, Task as TaskModel
from app.models.session import get_db, init_db
from app.tasks.video_tasks import process_video, analyze_single_scene
from pydantic import BaseModel

# Initialize database
init_db()

router = APIRouter()


# ============ Pydantic Models ============

class VideoCreate(BaseModel):
    filename: str
    file_size: int
    chunk_index: int = 0
    total_chunks: int = 1
    chunk_hash: Optional[str] = None


class VideoResponse(BaseModel):
    id: int
    filename: str
    original_filename: str
    file_size: int
    duration: Optional[float] = None
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class SceneResponse(BaseModel):
    id: int
    video_id: int
    start_time: float
    end_time: float
    duration: float
    scene_index: int
    keyframe_path: Optional[str] = None
    tags: Optional[str] = None
    description: Optional[str] = None
    is_processed: bool

    class Config:
        from_attributes = True


class TaskResponse(BaseModel):
    task_id: str
    task_type: str
    status: str
    progress: float
    message: Optional[str] = None

    class Config:
        from_attributes = True


# ============ Video Upload & Management ============

@router.post("/videos/upload", response_model=VideoResponse)
async def upload_video(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """
    Upload a video file (simple version - for small files)
    For large files, use chunked upload endpoint
    """
    # Generate unique filename
    file_ext = os.path.splitext(file.filename)[1]
    temp_filename = f"{datetime.now().strftime('%Y%m%d_%H%M%S')}_{hashlib.md5(file.filename.encode()).hexdigest()[:8]}{file_ext}"

    file_path = settings.VIDEO_STORAGE / temp_filename

    # Save file
    async with aiofiles.open(file_path, "wb") as f:
        content = await file.read()
        await f.write(content)

    # Create database record
    video = Video(
        filename=temp_filename,
        original_filename=file.filename,
        file_path=str(file_path),
        file_size=len(content),
        status="pending"
    )
    db.add(video)
    db.commit()
    db.refresh(video)

    return video


@router.post("/videos/upload/chunk")
async def upload_video_chunk(
    filename: str = Form(...),
    chunk_index: int = Form(...),
    total_chunks: int = Form(...),
    chunk: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """
    Upload video in chunks for large files
    """
    # Create temp directory for chunks
    temp_dir = settings.VIDEO_STORAGE / "temp" / filename
    temp_dir.mkdir(parents=True, exist_ok=True)

    # Save chunk
    chunk_path = temp_dir / f"chunk_{chunk_index:04d}"
    async with aiofiles.open(chunk_path, "wb") as f:
        content = await chunk.read()
        await f.write(content)

    # Check if all chunks uploaded
    if chunk_index == total_chunks - 1:
        # Merge chunks
        final_filename = f"{datetime.now().strftime('%Y%m%d_%H%M%S')}_{filename}"
        final_path = settings.VIDEO_STORAGE / final_filename

        with open(final_path, "wb") as out_file:
            for i in range(total_chunks):
                chunk_file = temp_dir / f"chunk_{i:04d}"
                with open(chunk_file, "rb") as in_file:
                    out_file.write(in_file.read())
                chunk_file.unlink()  # Delete chunk

        # Clean up temp directory
        temp_dir.rmdir()

        # Get file size
        file_size = final_path.stat().st_size

        # Create database record
        video = Video(
            filename=final_filename,
            original_filename=filename,
            file_path=str(final_path),
            file_size=file_size,
            status="pending"
        )
        db.add(video)
        db.commit()
        db.refresh(video)

        return {
            "status": "completed",
            "video": VideoResponse.model_validate(video)
        }

    return {
        "status": "chunk_received",
        "chunk_index": chunk_index,
        "total_chunks": total_chunks
    }


@router.post("/videos/{video_id}/process")
async def process_video_endpoint(
    video_id: int,
    db: Session = Depends(get_db)
):
    """
    Start video processing (scene detection, cutting, AI analysis)
    """
    video = db.query(Video).filter(Video.id == video_id).first()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    if video.status != "pending" and video.status != "failed":
        raise HTTPException(status_code=400, detail="Video already processing or processed")

    # Start Celery task
    task = process_video.delay(video_id)

    # Update video
    video.task_id = task.id
    video.status = "processing"
    db.commit()

    # Create task record
    db_task = TaskModel(
        task_id=task.id,
        task_type="process",
        status="pending",
        progress=0,
        message="Task queued"
    )
    db.add(db_task)
    db.commit()

    return {
        "task_id": task.id,
        "video_id": video_id,
        "status": "processing"
    }


@router.get("/videos", response_model=List[VideoResponse])
async def list_videos(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """
    List all videos
    """
    query = db.query(Video).order_by(Video.created_at.desc())

    if status:
        query = query.filter(Video.status == status)

    videos = query.offset(skip).limit(limit).all()
    return videos


@router.get("/videos/{video_id}", response_model=VideoResponse)
async def get_video(
    video_id: int,
    db: Session = Depends(get_db)
):
    """
    Get video details
    """
    video = db.query(Video).filter(Video.id == video_id).first()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    return video


@router.delete("/videos/{video_id}")
async def delete_video(
    video_id: int,
    db: Session = Depends(get_db)
):
    """
    Delete video and all related data
    """
    video = db.query(Video).filter(Video.id == video_id).first()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    # Delete files
    if video.file_path and os.path.exists(video.file_path):
        os.remove(video.file_path)

    # Delete scenes and their files
    scenes = db.query(Scene).filter(Scene.video_id == video_id).all()
    for scene in scenes:
        if scene.scene_video_path and os.path.exists(scene.scene_video_path):
            os.remove(scene.scene_video_path)
        if scene.keyframe_path and os.path.exists(scene.keyframe_path):
            os.remove(scene.keyframe_path)

    # Delete storage directories
    scene_dir = settings.SCENE_STORAGE / str(video_id)
    if scene_dir.exists():
        for f in scene_dir.iterdir():
            f.unlink()
        scene_dir.rmdir()

    frame_dir = settings.FRAME_STORAGE / str(video_id)
    if frame_dir.exists():
        for f in frame_dir.iterdir():
            f.unlink()
        frame_dir.rmdir()

    # Delete database records
    db.query(Scene).filter(Scene.video_id == video_id).delete()
    db.delete(video)
    db.commit()

    return {"status": "deleted", "video_id": video_id}


# ============ Scenes ============

@router.get("/videos/{video_id}/scenes", response_model=List[SceneResponse])
async def list_scenes(
    video_id: int,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db)
):
    """
    List all scenes for a video
    """
    video = db.query(Video).filter(Video.id == video_id).first()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    scenes = db.query(Scene).filter(
        Scene.video_id == video_id
    ).order_by(Scene.scene_index).offset(skip).limit(limit).all()

    return scenes


@router.get("/scenes/{scene_id}", response_model=SceneResponse)
async def get_scene(
    scene_id: int,
    db: Session = Depends(get_db)
):
    """
    Get scene details
    """
    scene = db.query(Scene).filter(Scene.id == scene_id).first()
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")
    return scene


@router.post("/scenes/{scene_id}/analyze")
async def analyze_scene_endpoint(
    scene_id: int,
    db: Session = Depends(get_db)
):
    """
    Analyze a single scene with AI
    """
    scene = db.query(Scene).filter(Scene.id == scene_id).first()
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")

    # Start Celery task
    task = analyze_single_scene.delay(scene_id)

    return {
        "task_id": task.id,
        "scene_id": scene_id,
        "status": "processing"
    }


@router.get("/scenes/{scene_id}/keyframe")
async def get_scene_keyframe(
    scene_id: int,
    db: Session = Depends(get_db)
):
    """
    Get scene keyframe image
    """
    scene = db.query(Scene).filter(Scene.id == scene_id).first()
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")

    if not scene.keyframe_path or not os.path.exists(scene.keyframe_path):
        raise HTTPException(status_code=404, detail="Keyframe not found")

    return FileResponse(scene.keyframe_path, media_type="image/jpeg")


@router.get("/scenes/{scene_id}/video")
async def get_scene_video(
    scene_id: int,
    db: Session = Depends(get_db)
):
    """
    Get scene video file
    """
    scene = db.query(Scene).filter(Scene.id == scene_id).first()
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")

    if not scene.scene_video_path or not os.path.exists(scene.scene_video_path):
        raise HTTPException(status_code=404, detail="Scene video not found")

    return FileResponse(
        scene.scene_video_path,
        media_type="video/mp4",
        headers={"Accept-Ranges": "bytes"}
    )


# ============ Tasks ============

@router.get("/tasks/{task_id}", response_model=TaskResponse)
async def get_task_status(
    task_id: str,
    db: Session = Depends(get_db)
):
    """
    Get task status
    """
    task = db.query(TaskModel).filter(TaskModel.task_id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


# ============ Search ============

@router.get("/search/scenes")
async def search_scenes(
    q: str = Query(..., min_length=1),
    db: Session = Depends(get_db)
):
    """
    Search scenes by tags or description
    """
    # Simple text search in tags and description
    scenes = db.query(Scene).filter(
        (Scene.tags.like(f"%{q}%")) | (Scene.description.like(f"%{q}%"))
    ).limit(50).all()

    # Also include unprocessed scenes
    all_scenes = db.query(Scene).filter(
        Scene.is_processed == False
    ).limit(50).all()

    # Combine and deduplicate
    scene_ids = set()
    results = []
    for scene in scenes + all_scenes:
        if scene.id not in scene_ids:
            scene_ids.add(scene.id)
            results.append(scene)

    return results


@router.get("/search/tags")
async def get_all_tags(
    db: Session = Depends(get_db)
):
    """
    Get all unique tags from scenes
    """
    scenes = db.query(Scene).filter(Scene.tags.isnot(None)).all()

    all_tags = set()
    for scene in scenes:
        if scene.tags:
            try:
                tags = json.loads(scene.tags)
                all_tags.update(tags)
            except:
                pass

    return sorted(list(all_tags))
