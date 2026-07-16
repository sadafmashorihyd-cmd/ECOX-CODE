"""
visualize_ai.py
✅ P39 FIXED: duplicate removed
✅ P40 FIXED: EfficientNet layer
✅ P41 FIXED: correct model
✅ P42 FIXED: preprocess_input
✅ P43 FIXED: Real Grad-CAM
"""
import os
from gradcam_engine import GradCAMEngine


def visualize(img_path, save_path='ecox_cyberpunk_scan.jpg'):
    engine = GradCAMEngine()
    overlay, class_name, confidence = engine.generate_cyberpunk_overlay(
        img_path, save_path
    )
    return overlay, class_name, confidence


if __name__ == "__main__":
    solar_dir = 'dataset/val/solar_panels/'
    img       = os.path.join(solar_dir, os.listdir(solar_dir)[0])
    visualize(img)