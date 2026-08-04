"""
Video Processing Service
Handles video metadata extraction, scene detection, and video cutting
"""
import os
import json
import ffmpeg
import logging
from pathlib import Path
from typing import List, Dict, Optional, Tuple
from datetime import timedelta

from app.core.config import settings

logger = logging.getLogger(__name__)


class VideoProcessor:
    """Video processing utilities"""

    @staticmethod
    def get_video_info(video_path: str) -> Dict:
        """
        Extract video metadata using ffmpeg
        Returns: dict with duration, width, height, fps, codec
        """
        try:
            probe = ffmpeg.probe(video_path)
            video_stream = next(
                (s for s in probe["streams"] if s["codec_type"] == "video"),
                None
            )

            if not video_stream:
                raise ValueError("No video stream found")

            return {
                "duration": float(probe["format"]["duration"]),
                "width": int(video_stream["width"]),
                "height": int(video_stream["height"]),
                "fps": eval(video_stream.get("r_frame_rate", "0/1")),
                "codec": video_stream.get("codec_name", "unknown"),
                "bitrate": int(probe["format"].get("bit_rate", 0)),
            }
        except Exception as e:
            logger.error(f"Error getting video info: {e}")
            raise

    @staticmethod
    def extract_keyframe(video_path: str, timestamp: float, output_path: str) -> bool:
        """
        Extract a single keyframe at given timestamp
        """
        try:
            (
                ffmpeg
                .input(video_path, ss=timestamp)
                .output(output_path, vframes=1, format="image2", vcodec="mjpeg")
                .overwrite_output()
                .run(capture_stdout=True, capture_stderr=True)
            )
            return True
        except ffmpeg.Error as e:
            logger.error(f"Error extracting keyframe: {e.stderr.decode()}")
            return False

    @staticmethod
    def cut_video(
        video_path: str,
        output_path: str,
        start_time: float,
        end_time: float,
        codec: str = "copy"
    ) -> bool:
        """
        Cut video segment without re-encoding (stream copy)
        """
        try:
            duration = end_time - start_time

            if codec == "copy":
                # Stream copy - fast, no re-encoding
                (
                    ffmpeg
                    .input(video_path, ss=start_time, t=duration)
                    .output(output_path, c="copy")
                    .overwrite_output()
                    .run(capture_stdout=True, capture_stderr=True)
                )
            else:
                # Re-encode with H.264
                (
                    ffmpeg
                    .input(video_path, ss=start_time, t=duration)
                    .output(
                        output_path,
                        vcodec="libx264",
                        acodec="aac",
                        preset="fast",
                        crf=23
                    )
                    .overwrite_output()
                    .run(capture_stdout=True, capture_stderr=True)
                )
            return True
        except ffmpeg.Error as e:
            logger.error(f"Error cutting video: {e.stderr.decode()}")
            return False

    @staticmethod
    def generate_thumbnail(video_path: str, output_path: str, timestamp: float = 0) -> bool:
        """
        Generate a thumbnail image from video
        """
        try:
            (
                ffmpeg
                .input(video_path, ss=timestamp)
                .output(
                    output_path,
                    vframes=1,
                    format="image2",
                    vcodec="mjpeg",
                    **{"q:v": 2}  # High quality
                )
                .overwrite_output()
                .run(capture_stdout=True, capture_stderr=True)
            )
            return True
        except ffmpeg.Error as e:
            logger.error(f"Error generating thumbnail: {e.stderr.decode()}")
            return False


class SceneDetector:
    """Scene detection using PySceneDetect"""

    def __init__(self, threshold: float = None):
        from scenedetect import VideoManager, SceneManager
        from scenedetect.detectors import ContentDetector

        self.VideoManager = VideoManager
        self.SceneManager = SceneManager
        self.ContentDetector = ContentDetector
        self.threshold = threshold or settings.SCENE_THRESHOLD

    def detect_scenes(self, video_path: str) -> List[Tuple[float, float]]:
        """
        Detect scene boundaries in video
        Returns: List of (start_time, end_time) tuples in seconds
        """
        video_manager = self.VideoManager([video_path])
        scene_manager = self.SceneManager()

        # Add content detector with threshold
        scene_manager.add_detector(
            self.ContentDetector(threshold=self.threshold)
        )

        # Set downscale factor for faster processing
        video_manager.set_downscale_factor()

        # Start detection
        video_manager.start()
        scene_manager.detect_scenes(frame_source=video_manager)

        # Get scene list
        scene_list = scene_manager.get_scene_list()

        # Filter out very short scenes
        min_length = settings.MIN_SCENE_LENGTH
        filtered_scenes = []
        for scene in scene_list:
            start, end = scene
            start_sec = start.get_seconds()
            end_sec = end.get_seconds()
            if end_sec - start_sec >= min_length:
                filtered_scenes.append((start_sec, end_sec))

        logger.info(f"Detected {len(filtered_scenes)} scenes in {video_path}")
        return filtered_scenes
