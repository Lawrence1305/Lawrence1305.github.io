"""
Database Models
"""
from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text, Boolean
from sqlalchemy.orm import relationship, declarative_base

Base = declarative_base()


class Video(Base):
    """Video model"""
    __tablename__ = "videos"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String(255), nullable=False)
    original_filename = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_size = Column(Integer, nullable=False)
    duration = Column(Float, nullable=True)  # Duration in seconds
    width = Column(Integer, nullable=True)
    height = Column(Integer, nullable=True)
    fps = Column(Float, nullable=True)

    # Processing status
    status = Column(String(50), default="pending")  # pending, processing, completed, failed
    task_id = Column(String(100), nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    scenes = relationship("Scene", back_populates="video", cascade="all, delete-orphan")


class Scene(Base):
    """Scene/Shot model"""
    __tablename__ = "scenes"

    id = Column(Integer, primary_key=True, index=True)
    video_id = Column(Integer, ForeignKey("videos.id"), nullable=False)

    # Scene boundaries (in seconds)
    start_time = Column(Float, nullable=False)
    end_time = Column(Float, nullable=False)
    duration = Column(Float, nullable=False)

    # Scene metadata
    scene_index = Column(Integer, nullable=False)  # Index within the video

    # Keyframe
    keyframe_path = Column(String(500), nullable=True)

    # AI Tags
    tags = Column(Text, nullable=True)  # JSON string of tags
    description = Column(Text, nullable=True)  # AI generated description

    # Scene video path
    scene_video_path = Column(String(500), nullable=True)

    # Processing status
    is_processed = Column(Boolean, default=False)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    video = relationship("Video", back_populates="scenes")


class Task(Base):
    """Task tracking model"""
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(String(100), unique=True, index=True, nullable=False)
    task_type = Column(String(50), nullable=False)  # upload, process, analyze
    status = Column(String(50), default="pending")  # pending, started, completed, failed
    progress = Column(Float, default=0.0)  # 0-100
    message = Column(Text, nullable=True)
    result = Column(Text, nullable=True)  # JSON string of result

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
