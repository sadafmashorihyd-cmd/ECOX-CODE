import os
os.environ['TF_ENABLE_ONEDNN_OPTS'] = '0'
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'

import sys
import tensorflow as tf
import numpy as np
import cv2
from tensorflow.keras.applications.efficientnet import preprocess_input

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from src.utils.constants import CONFIG


class GradCAMEngine:
    """
    Day 6: Official Grad-CAM Visualization Engine

    Kya karta hai:
    - AI ka decision visual heatmap se explain karta hai
    - Cyberpunk-style overlay banata hai (red = AI ne yahan focus kiya)
    - Constants.py se model path leta hai (Single Source of Truth)
    - Fail-Closed: koi bhi error → None return, crash nahi
    """

    def __init__(self, model_path=None):
        self.model_path  = model_path or CONFIG['MODEL_PATH']
        self.class_names = CONFIG['CLASSES']
        self.model       = None
        self.last_conv   = None
        self._load_model()

    def _load_model(self):
        """Model load karo — Fail-Closed"""
        if not os.path.exists(self.model_path):
            raise FileNotFoundError(
                f"Model not found: {self.model_path}"
            )
        self.model     = tf.keras.models.load_model(
            self.model_path, compile=False
        )
        self.last_conv = self._find_last_conv()
        if self.last_conv is None:
            raise ValueError("No Conv2D layer found in model")
        print(f"GradCAMEngine ready")
        print(f"   Model:      {os.path.basename(self.model_path)}")
        print(f"   Last conv:  {self.last_conv}")
        print(f"   Classes:    {len(self.class_names)}")

    def _find_last_conv(self):
        """Model mein last Conv2D layer dhoondo"""
        for layer in reversed(self.model.layers):
            if isinstance(layer, tf.keras.layers.Conv2D):
                return layer.name
        return None

    def _preprocess(self, img_path):
        """Image load aur preprocess karo"""
        img = cv2.imread(img_path)
        if img is None:
            raise ValueError(f"Image load nahi hui: {img_path}")
        img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        img_res = cv2.resize(img_rgb, CONFIG['IMG_SIZE'])
        arr     = np.expand_dims(img_res, axis=0).astype(np.float32)
        return preprocess_input(arr), img

    def compute_gradcam(self, img_path):
        """
        Grad-CAM heatmap compute karo.
        Returns: (heatmap, original_img, class_name, confidence)
        Fail-Closed: exception = None return
        """
        try:
            img_array, original = self._preprocess(img_path)

            grad_model = tf.keras.models.Model(
                inputs=self.model.inputs,
                outputs=[
                    self.model.get_layer(self.last_conv).output,
                    self.model.output
                ]
            )

            inputs = tf.constant(img_array)
            with tf.GradientTape() as tape:
                tape.watch(inputs)
                conv_outputs, predictions = grad_model(
                    inputs, training=False
                )
                pred_idx    = tf.argmax(predictions[0])
                class_score = predictions[:, pred_idx]

            grads        = tape.gradient(class_score, conv_outputs)
            pooled_grads = tf.reduce_mean(grads, axis=(0, 1, 2))
            conv_out     = conv_outputs[0]
            heatmap      = conv_out @ pooled_grads[..., tf.newaxis]
            heatmap      = tf.squeeze(heatmap)
            heatmap      = tf.maximum(heatmap, 0) / (
                tf.math.reduce_max(heatmap) + 1e-8
            )
            heatmap = heatmap.numpy()

            confidence = float(tf.reduce_max(predictions) * 100)
            class_name = self.class_names[int(pred_idx)]

            return heatmap, original, class_name, confidence

        except Exception as e:
            # Fail-Closed: koi bhi error → None
            print(f"GradCAM error: {e}")
            return None, None, None, 0.0

    def generate_cyberpunk_overlay(self, img_path, save_path=None):
        """
        Cyberpunk-style heatmap overlay banao aur save karo.
        Returns: (overlay_img, class_name, confidence)
        Fail-Closed: exception = None return
        """
        try:
            heatmap, original, class_name, confidence = self.compute_gradcam(
                img_path
            )

            # Fail-Closed: gradcam fail hua to None return
            if heatmap is None:
                return None, None, 0.0

            h, w    = original.shape[:2]
            heatmap = cv2.resize(heatmap, (w, h))
            heatmap = np.uint8(255 * heatmap)

            heatmap_color = cv2.applyColorMap(heatmap, cv2.COLORMAP_JET)
            overlay       = cv2.addWeighted(
                original, 0.6, heatmap_color, 0.4, 0
            )

            # Text overlay
            font = cv2.FONT_HERSHEY_SIMPLEX
            cv2.putText(
                overlay, f"CLASS: {class_name.upper()}",
                (10, 30), font, 0.8, (0, 255, 0), 2
            )
            cv2.putText(
                overlay, f"CONF:  {confidence:.1f}%",
                (10, 60), font, 0.8, (0, 255, 255), 2
            )

            # Save karo
            if save_path is None:
                save_path = 'ecox_cyberpunk_scan.jpg'

            os.makedirs('assets', exist_ok=True)
            cv2.imwrite(save_path, overlay)
            cv2.imwrite(f'assets/{os.path.basename(save_path)}', overlay)

            return overlay, class_name, confidence

        except Exception as e:
            # Fail-Closed
            print(f"Overlay error: {e}")
            return None, None, 0.0


if __name__ == "__main__":
    print("GradCAMEngine test...")
    engine = GradCAMEngine()

    solar_dir = 'dataset/val/solar_panels/'
    if os.path.isdir(solar_dir):
        images = [f for f in os.listdir(solar_dir)
                  if f.lower().endswith(('.jpg', '.jpeg', '.png'))]
        if images:
            img_path = os.path.join(solar_dir, images[0])
            overlay, cls, conf = engine.generate_cyberpunk_overlay(
                img_path, 'test_gradcam.jpg'
            )
            if overlay is not None:
                print(f"PASS: {cls} ({conf:.1f}%)")
                print(f"Saved: test_gradcam.jpg")
            else:
                print("FAIL: overlay generation failed")
    else:
        print("Test skipped: solar_panels val folder not found")