"""
AI Analysis Service
Handles image captioning and tagging using BLIP/CLIP models
"""
import os
import json
import logging
from pathlib import Path
from typing import List, Dict, Optional

import torch
from PIL import Image
from transformers import BlipProcessor, BlipForConditionalGeneration, CLIPModel, CLIPProcessor

from app.core.config import settings

logger = logging.getLogger(__name__)


class AIAnalyzer:
    """AI-powered image analysis for scene tagging"""

    def __init__(self, model_type: str = "BLIP"):
        self.model_type = model_type.upper()
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self._model = None
        self._processor = None
        self._clip_model = None
        self._clip_processor = None

        # Common scene tags for classification
        self.scene_tags = [
            "indoor", "outdoor", "person", "vehicle", "nature", "building",
            "city", "forest", "beach", "mountain", "room", "street",
            "office", "home", "restaurant", "store", "park", "sky",
            "water", "night", "day", "sunset", "sunrise", "cloudy",
            "conversation", "action", "sports", "music", "dance",
            "food", "technology", "animal", "bird", "cat", "dog"
        ]

    @property
    def model(self):
        """Lazy load BLIP model"""
        if self._model is None:
            logger.info(f"Loading {self.model_type} model...")
            if self.model_type == "BLIP":
                self._processor = BlipProcessor.from_pretrained(
                    "Salesforce/blip-image-captioning-base"
                )
                self._model = BlipForConditionalGeneration.from_pretrained(
                    "Salesforce/blip-image-captioning-base"
                )
            else:
                raise ValueError(f"Unknown model type: {self.model_type}")

            self._model.to(self.device)
            self._model.eval()
            logger.info(f"{self.model_type} model loaded on {self.device}")

        return self._model

    @property
    def processor(self):
        """Get processor"""
        if self._processor is None:
            _ = self.model  # Trigger lazy loading
        return self._processor

    @property
    def clip_model(self):
        """Lazy load CLIP model for semantic search"""
        if self._clip_model is None:
            logger.info("Loading CLIP model...")
            self._clip_processor = CLIPProcessor.from_pretrained(settings.CLIP_MODEL)
            self._clip_model = CLIPModel.from_pretrained(settings.CLIP_MODEL)
            self._clip_model.to(self.device)
            self._clip_model.eval()
            logger.info(f"CLIP model loaded on {self.device}")
        return self._clip_model

    @property
    def clip_processor(self):
        """Get CLIP processor"""
        if self._clip_processor is None:
            _ = self.clip_model
        return self._clip_processor

    def generate_caption(self, image_path: str) -> str:
        """
        Generate a natural language description of the image
        """
        try:
            image = Image.open(image_path).convert("RGB")

            inputs = self.processor(
                image,
                return_tensors="pt"
            ).to(self.device)

            with torch.no_grad():
                output = self.model.generate(
                    **inputs,
                    max_new_tokens=100,
                    num_beams=5,
                    do_sample=True,
                    temperature=0.7
                )

            caption = self.processor.decode(
                output[0],
                skip_special_tokens=True
            )
            return caption

        except Exception as e:
            logger.error(f"Error generating caption: {e}")
            return ""

    def extract_tags(self, image_path: str, top_k: int = 5) -> List[str]:
        """
        Extract tags using CLIP zero-shot classification
        """
        try:
            image = Image.open(image_path).convert("RGB")

            # Prepare inputs
            inputs = self.clip_processor(
                text=self.scene_tags,
                images=image,
                return_tensors="pt",
                padding=True
            ).to(self.device)

            with torch.no_grad():
                outputs = self.clip_model(**inputs)
                logits_per_image = outputs.logits_per_image
                probs = logits_per_image.softmax(dim=1)

            # Get top-k tags
            top_indices = probs[0].argsort(descending=True)[:top_k]
            tags = [self.scene_tags[idx] for idx in top_indices]

            return tags

        except Exception as e:
            logger.error(f"Error extracting tags: {e}")
            return []

    def analyze_scene(
        self,
        keyframe_path: str,
        generate_caption: bool = True,
        extract_tags: bool = True
    ) -> Dict:
        """
        Complete scene analysis: caption + tags
        """
        result = {
            "caption": "",
            "tags": [],
            "error": None
        }

        try:
            if not os.path.exists(keyframe_path):
                result["error"] = "Keyframe not found"
                return result

            if generate_caption:
                caption = self.generate_caption(keyframe_path)
                result["caption"] = caption
                logger.info(f"Generated caption: {caption}")

            if extract_tags:
                tags = self.extract_tags(keyframe_path)
                result["tags"] = tags
                logger.info(f"Extracted tags: {tags}")

        except Exception as e:
            logger.error(f"Error in scene analysis: {e}")
            result["error"] = str(e)

        return result


# Global analyzer instance
ai_analyzer = AIAnalyzer()
